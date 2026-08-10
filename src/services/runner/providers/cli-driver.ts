import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { mkdirSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import type { ThreadAccessLevel, ThreadProvider } from '../../db/repositories/threads.js'
import type { ProviderStreamEvent, ProviderTurnInput, ProviderTurnResult, ProviderUsage, ResolvedMcpDef } from './provider-types.js'
import { ProviderError } from './provider-types.js'
import { runHttpTurn as runMinimaxHttpTurn } from './minimax-driver.js'
import { runHttpTurn as runGlmHttpTurn } from './glm-driver.js'
import { runHttpTurn as runGrokHttpTurn } from './grok-driver.js'
import type { ComposerImageInput } from './composer-images.js'
import { sanitizeProcessError } from '../../process-error.js'
import { buildPtyEnv } from '../../terminal/pty-env.js'
import { ensurePermissionHookScript } from '../permission-hook.js'

/** Mesmo contrato de vault/worktrees/db: override de teste, senão Electron userData. */
function resolveUserData(): string {
  const override = process.env.ENGRENACODE_USER_DATA
  if (override) {
    mkdirSync(override, { recursive: true })
    return override
  }
  return app.getPath('userData')
}

/** Artefatos efêmeros do turno (mcp-config, imagens) — fora de os.tmpdir(). */
function resolveTurnArtifactsDir(): string {
  const dir = join(resolveUserData(), 'tmp')
  mkdirSync(dir, { recursive: true })
  return dir
}

export type {
  ProviderStreamEvent,
  PermissionDecision,
  ProviderTurnInput,
  ProviderTurnResult,
  ProviderUsage,
} from './provider-types.js'
export { ProviderError } from './provider-types.js'

type ProviderKind = 'cli' | 'http'

const PROVIDER_KIND: Record<ThreadProvider, ProviderKind> = {
  claude: 'cli',
  codex: 'cli',
  kimi: 'cli',
  minimax: 'http',
  glm: 'http',
  grok: 'http',
}

const HTTP_TURN_BY_PROVIDER: Partial<Record<ThreadProvider, typeof runMinimaxHttpTurn>> = {
  minimax: runMinimaxHttpTurn,
  glm: runGlmHttpTurn,
  grok: runGrokHttpTurn,
}

/** Env var injetada no spawn quando o provider roda com API key (Claude modo api-key, Codex). */
const API_KEY_ENV_VAR: Partial<Record<ThreadProvider, string>> = {
  claude: 'ANTHROPIC_API_KEY',
  codex: 'CODEX_API_KEY',
}

const BINARY_BY_PROVIDER: Partial<Record<ThreadProvider, string>> = {
  claude: 'claude',
  codex: 'codex',
  kimi: 'kimi',
}

/** Injetável para testes — produção usa `spawn` real. */
type SpawnFn = typeof spawn
let spawnImpl: SpawnFn = spawn
export function setSpawnForTesting(fn: SpawnFn): void {
  spawnImpl = fn
}
export function resetSpawnForTesting(): void {
  spawnImpl = spawn
}

/**
 * `--effort` (confirmado via doc oficial Claude Code, code.claude.com/docs/en/model-config
 * §"Adjust effort level") aceita `low|medium|high|xhigh|max`; o catálogo F16 usa `extra-high`
 * (alinhado ao rótulo de subagents) — mapeado para `xhigh` só na hora de montar o flag.
 * Aplicado uniformemente a claude/codex/kimi (mesma simplificação já existente em `buildArgs`,
 * que trata os 3 binários CLI com o mesmo shape de argumentos).
 */
const REASONING_FLAG_VALUE: Record<string, string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  'extra-high': 'xhigh',
  max: 'max',
}

const MIME_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Materializa anexos em ficheiros temporários (spec F16 §3.2) — cwd do provider não é confiável p/ escrita solta. */
function writeTempImages(images: ComposerImageInput[]): { paths: string[]; cleanup: () => void } {
  const artifactsDir = resolveTurnArtifactsDir()
  const paths = images.map((img) => {
    const ext = MIME_EXTENSION[img.mimeType] ?? 'bin'
    const path = join(artifactsDir, `engrenacode-image-${randomUUID()}.${ext}`)
    writeFileSync(path, Buffer.from(img.dataBase64, 'base64'), { mode: 0o600 })
    return path
  })

  const cleanup = (): void => {
    for (const path of paths) {
      try {
        unlinkSync(path)
      } catch {
        /* já removido ou nunca criado */
      }
    }
  }

  return { paths, cleanup }
}

function appendImageReferences(prompt: string, paths: string[]): string {
  if (paths.length === 0) return prompt
  const lines = paths.map((p) => `- ${p}`).join('\n')
  return `${prompt}\n\nImagens anexadas (leia os arquivos abaixo):\n${lines}`
}

/**
 * `supervised` sem hook confirmado ao vivo (claude-code 2.1.226): `'manual'`/`'dontAsk'` negam
 * toda tool com `decision_reason_type: "mode"` **antes** de qualquer `PreToolUse` hook rodar — o
 * hook chega a disparar, mas o veredito de modo já decidiu, `permissionDecision: "allow"` do hook
 * é ignorado. `'auto'` é a única combinação onde o hook (`--settings`, ver
 * `buildPermissionSettingsFile`) tem autoridade real de allow/deny — sem `'auto'`, o hook vira
 * decoração. `'default'` (valor antigo) nem é choice válido nesta versão do CLI.
 */
function permissionModeFlag(accessLevel: ThreadAccessLevel, hasPermissionHook: boolean): string {
  if (accessLevel === 'full-access') return 'bypassPermissions'
  if (accessLevel === 'auto-accept-edits') return 'acceptEdits'
  // supervised sem hook disponível (provider sem suporte, broker não montado): sem gate real
  // possível, mas falha fechado — nunca vira 'auto' (permissivo) por omissão.
  return hasPermissionHook ? 'auto' : 'manual'
}

/** JSON `mcpServers` (spec §5.6) — schema oficial da Claude Code CLI (`--mcp-config`), assumido também para Codex/Kimi. */
function buildMcpConfigFile(mcpServers: ResolvedMcpDef[]): string | undefined {
  if (mcpServers.length === 0) return undefined

  const entries: Record<string, unknown> = {}
  for (const def of mcpServers) {
    if (def.transport === 'stdio') {
      entries[def.name] = { command: def.command, args: def.args ?? [], env: def.env ?? {} }
    } else {
      entries[def.name] = { type: def.transport, url: def.url, headers: def.headers ?? {} }
    }
  }

  const path = join(resolveTurnArtifactsDir(), `engrenacode-mcp-${randomUUID()}.json`)
  writeFileSync(path, JSON.stringify({ mcpServers: entries }), { mode: 0o600 })
  return path
}

/**
 * `--settings` com hook `PreToolUse` (spec `PermissionBroker`) — só pra Claude em modo
 * `supervised`: `--permission-mode default` sozinho exige aprovação interativa via stdin, que
 * não existe no spawn headless (`-p`). O hook (`permission-hook.ts`) segura cada tool call até a
 * UI decidir, via `POST /permission` no `permission-broker.ts` do dispatch.
 */
function buildPermissionSettingsFile(port: number, token: string): string {
  const hookScriptPath = ensurePermissionHookScript()
  const command = `${JSON.stringify(process.execPath)} ${JSON.stringify(hookScriptPath)} --port ${port} --token ${token}`
  // `--settings` (formato de settings.json) exige o hooks aninhado sob "hooks" — confirmado ao
  // vivo contra claude-code 2.1.226; sem esse wrapper o PreToolUse nunca dispara (a doc pública
  // mostra a forma "direta" sem wrapper, mas essa versão instalada não aceita).
  const settings = {
    hooks: {
      PreToolUse: [
        {
          matcher: '*',
          hooks: [{ type: 'command', command, timeout: 600 }],
        },
      ],
    },
  }
  const path = join(resolveTurnArtifactsDir(), `engrenacode-permission-settings-${randomUUID()}.json`)
  writeFileSync(path, JSON.stringify(settings), { mode: 0o600 })
  return path
}

function buildArgs(input: ProviderTurnInput, mcpConfigPath: string | undefined, permissionSettingsPath: string | undefined): string[] {
  const args = ['-p', input.prompt, '--output-format', 'stream-json', '--include-partial-messages', '--verbose']
  if (input.model) args.push('--model', input.model)
  if (input.reasoningLevel) {
    const effort = REASONING_FLAG_VALUE[input.reasoningLevel] ?? input.reasoningLevel
    args.push('--effort', effort)
  }
  if (input.systemPrompt) args.push('--append-system-prompt', input.systemPrompt)
  // Claude headless: `--resume <session_id>` continua a conversa no disco (~/.claude/projects/…).
  // Codex/Kimi não usam este flag neste driver — só Claude reporta `session_id` no stream-json.
  if (input.provider === 'claude' && input.resumeSessionId) {
    args.push('--resume', input.resumeSessionId)
  }
  args.push('--permission-mode', permissionModeFlag(input.accessLevel, permissionSettingsPath !== undefined))
  if (mcpConfigPath) args.push('--mcp-config', mcpConfigPath)
  if (permissionSettingsPath) args.push('--settings', permissionSettingsPath)
  return args
}

interface ContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: unknown
  is_error?: boolean
}

function isErrorBlock(block: ContentBlock): boolean {
  return block.is_error === true
}

/** Parseia uma linha stream-json (Claude Code CLI / SDK) e traduz para ProviderStreamEvent[]. */
function parseLine(line: string): ProviderStreamEvent[] {
  const trimmed = line.trim()
  if (trimmed === '') return []

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return []
  }

  const events: ProviderStreamEvent[] = []
  const type = payload.type

  if (type === 'stream_event') {
    const event = payload.event as Record<string, unknown> | undefined
    if (event?.type === 'content_block_delta') {
      const delta = event.delta as Record<string, unknown> | undefined
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
        events.push({ type: 'text-delta', text: delta.text })
      }
    }
    return events
  }

  if (type === 'assistant') {
    const message = payload.message as Record<string, unknown> | undefined
    const content = (message?.content as ContentBlock[] | undefined) ?? []
    for (const block of content) {
      if (block.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string') {
        events.push({ type: 'tool-start', id: block.id, name: block.name, params: block.input ?? null })
      }
    }
    return events
  }

  if (type === 'user') {
    const message = payload.message as Record<string, unknown> | undefined
    const content = (message?.content as ContentBlock[] | undefined) ?? []
    for (const block of content) {
      if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
        events.push({
          type: 'tool-result',
          id: block.tool_use_id,
          status: isErrorBlock(block) ? 'error' : 'completed',
          result: block.content ?? null,
        })
      }
    }
    return events
  }

  return events
}

function extractFinalText(payload: Record<string, unknown>): string | null {
  if (typeof payload.result === 'string') return payload.result
  return null
}

/**
 * Extrai `usage` do evento `result` (Claude: `ResultMessage.usage`, confirmado via doc oficial
 * Anthropic — `input_tokens`/`output_tokens`/`cache_read_input_tokens`/`cache_creation_input_tokens`).
 * Mesmo parser aplicado a Codex/Kimi (spec F11 §3.2); `usage` ausente = `undefined`, não quebra o turno.
 */
function extractUsage(payload: Record<string, unknown>): ProviderUsage | undefined {
  const usage = payload.usage as Record<string, unknown> | undefined
  if (!usage) return undefined

  const inputTokens = usage.input_tokens
  const outputTokens = usage.output_tokens
  if (typeof inputTokens !== 'number' || typeof outputTokens !== 'number') return undefined

  const cacheReadTokens = typeof usage.cache_read_input_tokens === 'number' ? usage.cache_read_input_tokens : null
  const cacheCreationTokens =
    typeof usage.cache_creation_input_tokens === 'number' ? usage.cache_creation_input_tokens : null

  return { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens }
}

/** `total_cost_usd` do `ResultMessage` — só válido quando numérico finito ≥0 (spec F11 §3.2). */
function extractCostUsd(payload: Record<string, unknown>): number | null | undefined {
  const raw = payload.total_cost_usd
  if (raw === null) return null
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw
  return undefined
}

/** `session_id` em eventos stream-json (system init / result) — opaco, string não-vazia. */
function extractSessionId(payload: Record<string, unknown>): string | null {
  const raw = payload.session_id
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

export async function runCliTurn(input: ProviderTurnInput): Promise<ProviderTurnResult> {
  if (PROVIDER_KIND[input.provider] === 'http') {
    const httpTurn = HTTP_TURN_BY_PROVIDER[input.provider]
    if (httpTurn) return httpTurn(input)
  }

  const binary = BINARY_BY_PROVIDER[input.provider]
  if (binary === undefined) {
    throw new ProviderError('provider_not_supported', `Provider "${input.provider}" não tem um binário CLI configurado.`)
  }
  const mcpConfigPath = buildMcpConfigFile(input.mcpServers ?? [])
  const permissionSettingsPath =
    input.provider === 'claude' && input.accessLevel === 'supervised' && input.permissionPort !== undefined && input.permissionToken
      ? buildPermissionSettingsFile(input.permissionPort, input.permissionToken)
      : undefined
  const tempImages = input.images && input.images.length > 0 ? writeTempImages(input.images) : null
  const effectiveInput: ProviderTurnInput = tempImages
    ? { ...input, prompt: appendImageReferences(input.prompt, tempImages.paths) }
    : input
  const args = buildArgs(effectiveInput, mcpConfigPath, permissionSettingsPath)

  const envVar = API_KEY_ENV_VAR[input.provider]
  // Allowlist espelha PTY (PATH/HOME/…) — não herdar process.env inteiro (secrets do host).
  const env = buildPtyEnv(process.env)
  if (envVar !== undefined && input.apiKey) {
    env[envVar] = input.apiKey
  }
  // Hook script roda via binário do próprio EngrenaCode como interpretador Node puro (mesmo
  // truque de `subagent-mcp-server.ts`) — não exige Node instalado no sistema do usuário.
  if (permissionSettingsPath) env.ELECTRON_RUN_AS_NODE = '1'

  const cleanupMcpConfig = (): void => {
    if (!mcpConfigPath) return
    try { unlinkSync(mcpConfigPath) } catch { /* já removido ou nunca criado */ }
  }
  const cleanupPermissionSettings = (): void => {
    if (!permissionSettingsPath) return
    try { unlinkSync(permissionSettingsPath) } catch { /* já removido ou nunca criado */ }
  }
  const cleanupTempImages = (): void => tempImages?.cleanup()

  return new Promise((resolve, reject) => {
    try {
      const child = spawnImpl(binary, args, { cwd: input.cwd, env })
      const rl = createInterface({ input: child.stdout })
      let finalText = ''
      let sawResult = false
      let stderrBuf = ''
      let resultUsage: ProviderUsage | undefined
      let resultCostUsd: number | null | undefined
      let resultSessionId: string | null = null

      input.signal?.addEventListener('abort', () => {
        child.kill()
      })

      rl.on('line', (line) => {
        for (const event of parseLine(line)) input.onEvent(event)

        try {
          const payload = JSON.parse(line.trim()) as Record<string, unknown>
          const sid = extractSessionId(payload)
          if (sid) resultSessionId = sid
          if (payload.type === 'result') {
            sawResult = true
            const text = extractFinalText(payload)
            if (text !== null) finalText = text
            resultUsage = extractUsage(payload)
            resultCostUsd = extractCostUsd(payload)
            if (payload.is_error === true) {
              reject(
                new ProviderError('provider_turn_error', String(payload.result ?? 'Erro no provider.'), {
                  usage: resultUsage,
                  costUsd: resultCostUsd,
                })
              )
            }
          }
        } catch {
          // linha não é JSON de nível superior — ignora
        }
      })

      child.stderr.on('data', (chunk) => {
        stderrBuf += chunk.toString()
      })

      child.on('error', (err) => {
        cleanupMcpConfig()
        cleanupPermissionSettings()
        cleanupTempImages()
        reject(
          new ProviderError(
            'provider_spawn_failed',
            sanitizeProcessError(`Não foi possível iniciar o provider "${binary}": ${err.message}`)
          )
        )
      })

      child.on('close', (code) => {
        cleanupMcpConfig()
        cleanupPermissionSettings()
        cleanupTempImages()
        if (sawResult) {
          resolve({ text: finalText, usage: resultUsage, costUsd: resultCostUsd, sessionId: resultSessionId })
          return
        }
        if (code !== 0) {
          reject(
            new ProviderError(
              'provider_turn_error',
              sanitizeProcessError(stderrBuf.trim()) || `Provider "${binary}" encerrou com código ${code}.`
            )
          )
          return
        }
        resolve({ text: finalText, usage: resultUsage, costUsd: resultCostUsd, sessionId: resultSessionId })
      })
    } catch (err) {
      cleanupMcpConfig()
      cleanupPermissionSettings()
      cleanupTempImages()
      const message = err instanceof Error ? err.message : String(err)
      reject(
        new ProviderError(
          'provider_spawn_failed',
          sanitizeProcessError(`Não foi possível iniciar o provider "${binary}": ${message}`)
        )
      )
    }
  })
}

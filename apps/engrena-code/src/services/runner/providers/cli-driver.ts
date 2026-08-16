import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { ThreadProvider } from '../../db/repositories/threads.js'
import type { ProviderTurnInput, ProviderTurnResult, ProviderUsage, ResolvedMcpDef } from './provider-types.js'
import { ProviderError } from './provider-types.js'
import { runHttpTurn as runMinimaxHttpTurn } from './minimax-driver.js'
import { runHttpTurn as runGlmHttpTurn } from './glm-driver.js'
import { runHttpTurn as runGrokHttpTurn } from './grok-driver.js'
import type { ComposerImageInput } from './composer-images.js'
import { sanitizeProcessError } from '../../process-error.js'
import { buildPtyEnv } from '../../terminal/pty-env.js'
import { resolveTurnArtifactsDir } from './turn-artifacts.js'
import {
  claudeResumeArgs,
  permissionModeFlag,
  permissionSettingsArgs,
  setupPermissionBroker,
} from './claude/adapter.js'
import { assertPermissionContract } from './permission-contract.js'
import { parseStreamJsonLine } from './stream-json-parse.js'
import { killProcessTree } from '../process-kill.js'
import { appendStderrCapped } from '../buffer-cap.js'
import {
  recordProviderProcessExited,
  recordProviderProcessSpawned,
  recordStderrBufBytes,
} from '../../runtime-metrics.js'

export type {
  ProviderStreamEvent,
  PermissionDecision,
  ProviderTurnInput,
  ProviderTurnResult,
  ProviderUsage,
} from './provider-types.js'
export { ProviderError } from './provider-types.js'

/**
 * Reexports do adaptador do Claude: `buildPermissionHookCommand` e a injeção do builder de
 * settings nasceram aqui e continuam sendo importados deste módulo por testes e call sites.
 */
export {
  buildPermissionHookCommand,
  resetPermissionSettingsBuilderForTesting,
  setPermissionSettingsBuilderForTesting,
} from './claude/adapter.js'

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
 * Núcleo comum dos três binários CLI (claude/codex/kimi): o shape de argumentos é o mesmo, e o
 * que só o Claude entende vem de `claude/adapter.ts` — nunca de um `if (provider === 'claude')`
 * espalhado aqui.
 */
function buildArgs(input: ProviderTurnInput, mcpConfigPath: string | undefined, permissionSettingsPath: string | undefined): string[] {
  const args = ['-p', input.prompt, '--output-format', 'stream-json', '--include-partial-messages', '--verbose']
  if (input.model) args.push('--model', input.model)
  if (input.reasoningLevel) {
    const effort = REASONING_FLAG_VALUE[input.reasoningLevel] ?? input.reasoningLevel
    args.push('--effort', effort)
  }
  if (input.systemPrompt) args.push('--append-system-prompt', input.systemPrompt)
  args.push(...claudeResumeArgs(input))
  args.push('--permission-mode', permissionModeFlag(input.accessLevel, permissionSettingsPath !== undefined))
  if (mcpConfigPath) args.push('--mcp-config', mcpConfigPath)
  // Sem isto, `acceptEdits` (auto-accept-edits) libera edição de arquivo mas nega tool MCP: o agente
  // não consegue nem perguntar ao usuário e cai para pedir aprovação em prosa, sem botão nenhum.
  if (input.alwaysAllowedTools && input.alwaysAllowedTools.length > 0) {
    args.push('--allowedTools', ...input.alwaysAllowedTools)
  }
  args.push(...permissionSettingsArgs(permissionSettingsPath))
  return args
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
  // Único ponto do driver que toca o broker: quem sabe se este turno merece `--settings` é o
  // adaptador do Claude.
  const permissionBroker = setupPermissionBroker(input)
  const permissionSettings = permissionBroker?.settings
  const permissionSettingsPath = permissionBroker?.path
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
  // Ponto único de limpeza: o gate de contrato aborta antes do `new Promise`, e sem isto os três
  // temporários (settings, mcp-config, imagens) vazariam por ficarem presos ao ciclo do spawn.
  const cleanupTurnArtifacts = (): void => {
    cleanupMcpConfig()
    cleanupPermissionSettings()
    cleanupTempImages()
  }

  // Gate A02: regressão de contrato vira erro visível antes do turno, em vez do agente pedindo
  // aprovação em prosa sobre um botão que nunca apareceu na tela.
  const contract = assertPermissionContract({
    provider: input.provider,
    accessLevel: input.accessLevel,
    permissionSettingsPath,
    permissionSettings,
    args,
    env,
    platform: process.platform,
  })
  if (!contract.ok) {
    cleanupTurnArtifacts()
    throw new ProviderError('permission_contract_violation', contract.message)
  }

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
      // Só conta quem realmente virou processo no SO; spawn falho não tem PID nem árvore a matar.
      const hasPid = typeof child.pid === 'number'
      let countedExit = false
      if (hasPid) recordProviderProcessSpawned()
      const noteExit = (): void => {
        if (!hasPid || countedExit) return
        countedExit = true
        recordProviderProcessExited()
      }

      const abortTree = (): void => {
        const pid = child.pid
        if (typeof pid === 'number' && Number.isInteger(pid) && pid > 0) {
          // Windows: taskkill /T; POSIX: group or walk children — never kill by process name.
          killProcessTree({ pid })
          return
        }
        child.kill()
      }
      if (input.signal?.aborted) {
        abortTree()
      } else {
        input.signal?.addEventListener('abort', abortTree, { once: true })
      }

      rl.on('line', (line) => {
        // try/catch próprio: um throw aqui subiria pelo handler do readline e derrubaria o turno.
        // Separado do try abaixo de propósito — lá o catch significa "linha não é JSON de nível
        // superior"; fundir os dois perderia o sinal de falha real de parse/dispatch.
        try {
          for (const event of parseStreamJsonLine(line)) input.onEvent(event)
        } catch (err) {
          // Nunca logar a linha crua (pode conter command/secrets do tool_input).
          console.error(
            '[cli-driver] Falha ao parsear/despachar linha stream-json:',
            sanitizeProcessError(err instanceof Error ? err.message : String(err))
          )
        }

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
        stderrBuf = appendStderrCapped(stderrBuf, chunk.toString())
        recordStderrBufBytes(Buffer.byteLength(stderrBuf, 'utf8'))
      })

      child.on('error', (err) => {
        noteExit()
        cleanupTurnArtifacts()
        reject(
          new ProviderError(
            'provider_spawn_failed',
            sanitizeProcessError(`Não foi possível iniciar o provider "${binary}": ${err.message}`)
          )
        )
      })

      child.on('close', (code) => {
        noteExit()
        cleanupTurnArtifacts()
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
      cleanupTurnArtifacts()
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

import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { ThreadAccessLevel, ThreadProvider } from '../../db/repositories/threads.js'
import type { ProviderStreamEvent, ProviderTurnInput, ProviderTurnResult, ResolvedMcpDef } from './provider-types.js'
import { ProviderError } from './provider-types.js'
import { runHttpTurn } from './minimax-driver.js'

export type { ProviderStreamEvent, PermissionDecision, ProviderTurnInput, ProviderTurnResult } from './provider-types.js'
export { ProviderError } from './provider-types.js'

type ProviderKind = 'cli' | 'http'

const PROVIDER_KIND: Record<ThreadProvider, ProviderKind> = {
  claude: 'cli',
  codex: 'cli',
  kimi: 'cli',
  minimax: 'http',
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

function permissionModeFlag(accessLevel: ThreadAccessLevel): string {
  if (accessLevel === 'full-access') return 'bypassPermissions'
  if (accessLevel === 'auto-accept-edits') return 'acceptEdits'
  return 'default'
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

  const path = join(tmpdir(), `engrenacode-mcp-${randomUUID()}.json`)
  writeFileSync(path, JSON.stringify({ mcpServers: entries }), { mode: 0o600 })
  return path
}

function buildArgs(input: ProviderTurnInput, mcpConfigPath: string | undefined): string[] {
  const args = ['-p', input.prompt, '--output-format', 'stream-json', '--include-partial-messages', '--verbose']
  if (input.model) args.push('--model', input.model)
  if (input.systemPrompt) args.push('--append-system-prompt', input.systemPrompt)
  args.push('--permission-mode', permissionModeFlag(input.accessLevel))
  if (mcpConfigPath) args.push('--mcp-config', mcpConfigPath)
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

export async function runCliTurn(input: ProviderTurnInput): Promise<ProviderTurnResult> {
  if (PROVIDER_KIND[input.provider] === 'http') {
    return runHttpTurn(input)
  }

  const binary = BINARY_BY_PROVIDER[input.provider]
  if (binary === undefined) {
    throw new ProviderError('provider_not_supported', `Provider "${input.provider}" não tem um binário CLI configurado.`)
  }
  const mcpConfigPath = buildMcpConfigFile(input.mcpServers ?? [])
  const args = buildArgs(input, mcpConfigPath)

  const envVar = API_KEY_ENV_VAR[input.provider]
  const env = envVar !== undefined && input.apiKey ? { ...process.env, [envVar]: input.apiKey } : process.env

  const cleanupMcpConfig = (): void => {
    if (!mcpConfigPath) return
    try { unlinkSync(mcpConfigPath) } catch { /* já removido ou nunca criado */ }
  }

  return new Promise((resolve, reject) => {
    const child = spawnImpl(binary, args, { cwd: input.cwd, env })
    const rl = createInterface({ input: child.stdout })
    let finalText = ''
    let sawResult = false
    let stderrBuf = ''

    input.signal?.addEventListener('abort', () => {
      child.kill()
    })

    rl.on('line', (line) => {
      for (const event of parseLine(line)) input.onEvent(event)

      try {
        const payload = JSON.parse(line.trim()) as Record<string, unknown>
        if (payload.type === 'result') {
          sawResult = true
          const text = extractFinalText(payload)
          if (text !== null) finalText = text
          if (payload.is_error === true) {
            reject(new ProviderError('provider_turn_error', String(payload.result ?? 'Erro no provider.')))
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
      reject(new ProviderError('provider_spawn_failed', `Não foi possível iniciar o provider "${binary}": ${err.message}`))
    })

    child.on('close', (code) => {
      cleanupMcpConfig()
      if (sawResult) {
        resolve({ text: finalText })
        return
      }
      if (code !== 0) {
        reject(
          new ProviderError(
            'provider_turn_error',
            stderrBuf.trim() || `Provider "${binary}" encerrou com código ${code}.`
          )
        )
        return
      }
      resolve({ text: finalText })
    })
  })
}

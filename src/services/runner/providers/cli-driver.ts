import { spawn } from 'child_process'
import { createInterface } from 'readline'
import type { ThreadAccessLevel, ThreadProvider } from '../../db/repositories/threads.js'

export type ProviderStreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-start'; id: string; name: string; params: unknown }
  | { type: 'tool-result'; id: string; status: 'completed' | 'error'; result: unknown }
  | { type: 'permission-request'; id: string; toolName: string; params: unknown }

export interface PermissionDecision {
  allow: boolean
}

export interface ProviderTurnInput {
  provider: ThreadProvider
  cwd: string
  prompt: string
  systemPrompt?: string | null
  model?: string | null
  accessLevel: ThreadAccessLevel
  onEvent: (event: ProviderStreamEvent) => void
  resolvePermission?: (request: { id: string; toolName: string; params: unknown }) => Promise<PermissionDecision>
  signal?: AbortSignal
}

export interface ProviderTurnResult {
  text: string
}

export class ProviderError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const BINARY_BY_PROVIDER: Record<ThreadProvider, string> = {
  claude: 'claude',
  codex: 'codex',
  kimi: 'kimi',
}

function permissionModeFlag(accessLevel: ThreadAccessLevel): string {
  if (accessLevel === 'full-access') return 'bypassPermissions'
  if (accessLevel === 'auto-accept-edits') return 'acceptEdits'
  return 'default'
}

function buildArgs(input: ProviderTurnInput): string[] {
  const args = ['-p', input.prompt, '--output-format', 'stream-json', '--include-partial-messages', '--verbose']
  if (input.model) args.push('--model', input.model)
  if (input.systemPrompt) args.push('--append-system-prompt', input.systemPrompt)
  args.push('--permission-mode', permissionModeFlag(input.accessLevel))
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
  const binary = BINARY_BY_PROVIDER[input.provider]
  const args = buildArgs(input)

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: input.cwd })
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
      reject(new ProviderError('provider_spawn_failed', `Não foi possível iniciar o provider "${binary}": ${err.message}`))
    })

    child.on('close', (code) => {
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

import type { ProviderStreamEvent } from './provider-types.js'
import { NATIVE_DENIAL_REASON_MAX_CHARS } from './permission-contract.js'

function isErrorBlock(block: Record<string, unknown>): boolean {
  return block.is_error === true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asOutcome(value: unknown): 'success' | 'error' | 'cancelled' | null {
  if (value === 'success' || value === 'error' || value === 'cancelled') return value
  return null
}

/**
 * `decision_reason` é a frase de quem negou (o hook que rodou no `PreToolUse`), e é a única
 * informação do payload que explica a causa real. Vai truncada porque é texto de terceiro.
 *
 * O irmão `message` do payload (`"Claude requested permissions to run a bash command, but you
 * haven't granted it yet"`) fica de fora de propósito: é boilerplate do CLI que já descreve mal o
 * que aconteceu e foi o que empurrou a copy antiga para a afirmação falsa.
 */
function asDenialReason(value: unknown): string | null {
  const raw = asNonEmptyString(value)
  if (raw === null) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  return trimmed.length > NATIVE_DENIAL_REASON_MAX_CHARS
    ? `${trimmed.slice(0, NATIVE_DENIAL_REASON_MAX_CHARS)}…`
    : trimmed
}

function parsePermissionDenialEntry(entry: unknown): ProviderStreamEvent | null {
  if (!isRecord(entry)) return null
  const toolName = asNonEmptyString(entry.tool_name) ?? 'unknown'
  const toolUseId = asNonEmptyString(entry.tool_use_id) ?? undefined
  // Metadata only — never forward tool_input (pode conter command/secrets).
  return {
    type: 'permission-native-denial',
    toolName,
    toolUseId,
    decisionReasonType: asNonEmptyString(entry.decision_reason_type),
    // O resumo em `result.permission_denials[]` não traz `decision_reason`; só o evento
    // `system/permission_denied` traz.
    decisionReason: asDenialReason(entry.decision_reason),
  }
}

/**
 * Parseia uma linha stream-json (Claude Code CLI / SDK) e traduz para ProviderStreamEvent[].
 * Exportado para unitários sem spawn do binário `claude`.
 */
export function parseStreamJsonLine(line: string): ProviderStreamEvent[] {
  const trimmed = line.trim()
  if (trimmed === '') return []

  let payload: unknown
  try {
    payload = JSON.parse(trimmed)
  } catch {
    return []
  }
  if (!isRecord(payload)) return []

  const events: ProviderStreamEvent[] = []
  const type = payload.type

  if (type === 'stream_event') {
    const event = isRecord(payload.event) ? payload.event : undefined
    if (event?.type === 'content_block_delta') {
      const delta = isRecord(event.delta) ? event.delta : undefined
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
        events.push({ type: 'text-delta', text: delta.text })
      }
    }
    return events
  }

  if (type === 'assistant') {
    const message = isRecord(payload.message) ? payload.message : undefined
    const content = Array.isArray(message?.content) ? message.content : []
    for (const block of content) {
      // Item malformado (null/número/string) não pode abortar o loop nem derrubar o turno.
      if (!isRecord(block)) continue
      if (block.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string') {
        events.push({ type: 'tool-start', id: block.id, name: block.name, params: block.input ?? null })
      }
    }
    return events
  }

  if (type === 'user') {
    const message = isRecord(payload.message) ? payload.message : undefined
    const content = Array.isArray(message?.content) ? message.content : []
    for (const block of content) {
      // Item malformado (null/número/string) não pode abortar o loop nem derrubar o turno.
      if (!isRecord(block)) continue
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

  // --include-hook-events: system subtype hook_started | hook_response | permission_denied
  if (type === 'system') {
    const subtype = payload.subtype
    if (subtype === 'hook_started') {
      const hookId = asNonEmptyString(payload.hook_id)
      const hookEvent = asNonEmptyString(payload.hook_event) ?? 'unknown'
      const hookName = asNonEmptyString(payload.hook_name) ?? hookEvent
      if (hookId) {
        events.push({ type: 'hook-started', hookId, hookEvent, hookName })
      }
      return events
    }

    if (subtype === 'hook_response') {
      const hookId = asNonEmptyString(payload.hook_id)
      const hookEvent = asNonEmptyString(payload.hook_event) ?? 'unknown'
      const hookName = asNonEmptyString(payload.hook_name) ?? hookEvent
      const outcome = asOutcome(payload.outcome) ?? 'error'
      const exitCode = typeof payload.exit_code === 'number' ? payload.exit_code : null
      if (hookId) {
        // Não reencaminhar stdout/output do hook (pode ecoar tool_input).
        events.push({ type: 'hook-response', hookId, hookEvent, hookName, outcome, exitCode })
      }
      return events
    }

    if (subtype === 'permission_denied') {
      events.push({
        type: 'permission-native-denial',
        toolName: asNonEmptyString(payload.tool_name) ?? 'unknown',
        toolUseId: asNonEmptyString(payload.tool_use_id) ?? undefined,
        decisionReasonType: asNonEmptyString(payload.decision_reason_type),
        decisionReason: asDenialReason(payload.decision_reason),
      })
      return events
    }

    return events
  }

  if (type === 'result') {
    const denials = payload.permission_denials
    if (Array.isArray(denials)) {
      for (const entry of denials) {
        const denial = parsePermissionDenialEntry(entry)
        if (denial) events.push(denial)
      }
    }
    return events
  }

  return events
}

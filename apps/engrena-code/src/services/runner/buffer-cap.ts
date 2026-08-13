/**
 * Bounded buffers for long CLI turns — stderr and tool-result payloads.
 * Markers are Portuguese (user-facing when they reach the UI/error path).
 */

export const STDERR_MAX_BYTES = 256 * 1024
export const TOOL_RESULT_MAX_CHARS = 64 * 1024

/**
 * Teto do corpo do `POST /permission` que o hook manda ao broker (`permission-broker.ts`).
 * Cabe com folga o maior `tool_input` legítimo (Write de arquivo inteiro); acima disso o broker
 * responde 413 e derruba a conexão em vez de acumular sem limite.
 */
export const PERMISSION_BODY_MAX_BYTES = 1024 * 1024

export const STDERR_TRUNCATION_MARKER = '\n… (stderr truncado pelo EngrenaCode)'
export const TOOL_RESULT_TRUNCATION_MARKER = '\n… (resultado truncado pelo EngrenaCode)'

/** Append `chunk` to `buf`, keeping a byte-capped UTF-8 tail when over budget. */
export function appendStderrCapped(
  buf: string,
  chunk: string,
  maxBytes: number = STDERR_MAX_BYTES
): string {
  const combined = buf + chunk
  if (Buffer.byteLength(combined, 'utf8') <= maxBytes) return combined

  const markerBytes = Buffer.byteLength(STDERR_TRUNCATION_MARKER, 'utf8')
  const budget = Math.max(0, maxBytes - markerBytes)
  const bytes = Buffer.from(combined, 'utf8')
  const tail = bytes.subarray(Math.max(0, bytes.length - budget)).toString('utf8')
  // Marker at the end so sanitizeProcessError's slice(-300) still surfaces it.
  return tail + STDERR_TRUNCATION_MARKER
}

/** Truncate a string to `maxChars` code units and append the Portuguese marker. Interno: só o
 * `truncateToolResultPayload` público consome. */
function truncateStringWithMarker(
  value: string,
  maxChars: number,
  marker: string = TOOL_RESULT_TRUNCATION_MARKER
): string {
  if (value.length <= maxChars) return value
  const keep = Math.max(0, maxChars - marker.length)
  return value.slice(0, keep) + marker
}

/**
 * Cap tool-result JSON for SQLite + WS. Prefers truncating string leaves;
 * falls back to a small `{ truncated, preview }` envelope when stringify alone
 * still exceeds the budget (circular / huge nested structures).
 */
export function truncateToolResultPayload(
  result: unknown,
  maxChars: number = TOOL_RESULT_MAX_CHARS
): unknown {
  if (result === undefined) return result
  if (typeof result === 'string') {
    return truncateStringWithMarker(result, maxChars)
  }

  let raw: string
  try {
    raw = JSON.stringify(result) ?? 'null'
  } catch {
    return {
      truncated: true,
      preview: truncateStringWithMarker(String(result), maxChars),
    }
  }

  if (raw.length <= maxChars) return result

  const budget = { left: maxChars }
  const trimmed = truncateJsonLeaves(result, budget)
  try {
    const again = JSON.stringify(trimmed) ?? 'null'
    if (again.length <= maxChars * 2) return trimmed
  } catch {
    // fall through to envelope
  }

  return {
    truncated: true,
    preview: truncateStringWithMarker(raw, maxChars),
  }
}

function truncateJsonLeaves(value: unknown, budget: { left: number }): unknown {
  if (budget.left <= 0) {
    return typeof value === 'string' ? TOOL_RESULT_TRUNCATION_MARKER.trimStart() : value
  }
  if (typeof value === 'string') {
    if (value.length <= budget.left) {
      budget.left -= value.length
      return value
    }
    const next = truncateStringWithMarker(value, budget.left)
    budget.left = 0
    return next
  }
  if (Array.isArray(value)) {
    return value.map((item) => truncateJsonLeaves(item, budget))
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = truncateJsonLeaves(child, budget)
    }
    return out
  }
  return value
}

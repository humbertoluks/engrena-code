import { describe, expect, it } from 'vitest'
import {
  STDERR_MAX_BYTES,
  STDERR_TRUNCATION_MARKER,
  TOOL_RESULT_MAX_CHARS,
  TOOL_RESULT_TRUNCATION_MARKER,
  appendStderrCapped,
  truncateToolResultPayload,
} from './buffer-cap'

describe('appendStderrCapped', () => {
  it('keeps short buffers intact', () => {
    expect(appendStderrCapped('a', 'b', 100)).toBe('ab')
  })

  it('caps to max bytes with Portuguese marker and a tail', () => {
    const chunk = 'x'.repeat(4000)
    let buf = ''
    for (let i = 0; i < 100; i++) {
      buf = appendStderrCapped(buf, chunk, 2048)
    }
    expect(Buffer.byteLength(buf, 'utf8')).toBeLessThanOrEqual(2048)
    expect(buf.endsWith(STDERR_TRUNCATION_MARKER)).toBe(true)
    expect(buf.includes('x')).toBe(true)
  })

  it('defaults to 256KiB budget', () => {
    const huge = 'y'.repeat(STDERR_MAX_BYTES + 10_000)
    const out = appendStderrCapped('', huge)
    expect(Buffer.byteLength(out, 'utf8')).toBeLessThanOrEqual(STDERR_MAX_BYTES)
    expect(out.includes('stderr truncado pelo EngrenaCode')).toBe(true)
  })
})

describe('truncateToolResultPayload', () => {
  it('leaves small payloads untouched (same reference for objects)', () => {
    const obj = { ok: true, n: 1 }
    expect(truncateToolResultPayload(obj)).toBe(obj)
    expect(truncateToolResultPayload('short')).toBe('short')
  })

  it('truncates long strings with Portuguese marker', () => {
    const long = 'z'.repeat(TOOL_RESULT_MAX_CHARS + 500)
    const out = truncateToolResultPayload(long)
    expect(typeof out).toBe('string')
    expect((out as string).length).toBeLessThanOrEqual(TOOL_RESULT_MAX_CHARS)
    expect((out as string).endsWith(TOOL_RESULT_TRUNCATION_MARKER)).toBe(true)
  })

  it('truncates nested string leaves when JSON exceeds budget', () => {
    const payload = { text: 'a'.repeat(TOOL_RESULT_MAX_CHARS + 100), meta: { n: 1 } }
    const out = truncateToolResultPayload(payload, 8_000) as { text: string; meta: { n: number } }
    expect(out.meta.n).toBe(1)
    expect(out.text.includes('resultado truncado pelo EngrenaCode')).toBe(true)
    expect(JSON.stringify(out).length).toBeLessThan(JSON.stringify(payload).length)
  })

  // Cobre o truncamento interno (`truncateStringWithMarker`) pela superfície pública.
  it('is a no-op right at the limit and appends the marker one char over it', () => {
    const limit = TOOL_RESULT_TRUNCATION_MARKER.length + 10
    const atLimit = 'a'.repeat(limit)
    expect(truncateToolResultPayload(atLimit, limit)).toBe(atLimit)

    const out = truncateToolResultPayload(`${atLimit}a`, limit) as string
    expect(out).toBe('a'.repeat(10) + TOOL_RESULT_TRUNCATION_MARKER)
    expect(out.length).toBe(limit)
  })
})

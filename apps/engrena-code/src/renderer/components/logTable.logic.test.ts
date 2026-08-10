import { describe, expect, it } from 'vitest'
import { formatTimestamp } from './logTable.logic'

describe('formatTimestamp (LogTable)', () => {
  it('formats an epoch-ms timestamp as a pt-BR locale string', () => {
    const ms = new Date('2026-01-15T10:30:00Z').getTime()
    expect(formatTimestamp(ms)).toBe(new Date(ms).toLocaleString('pt-BR'))
  })
})

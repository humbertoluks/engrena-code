import { describe, expect, it } from 'vitest'
import { formatEntryDate, formatKb } from './projectMemoryModal.logic'

describe('formatKb (ProjectMemoryModal)', () => {
  it('converts bytes to KB with one decimal and a pt-BR comma', () => {
    expect(formatKb(1024)).toBe('1,0 KB')
    expect(formatKb(1536)).toBe('1,5 KB')
    expect(formatKb(0)).toBe('0,0 KB')
  })
})

describe('formatEntryDate (ProjectMemoryModal)', () => {
  it('formats a valid ISO date in pt-BR locale', () => {
    const iso = '2026-01-15T10:30:00Z'
    expect(formatEntryDate(iso)).toBe(new Date(iso).toLocaleString('pt-BR'))
  })

  it('falls back to the original string for an invalid date', () => {
    expect(formatEntryDate('not-a-date')).toBe('not-a-date')
  })
})

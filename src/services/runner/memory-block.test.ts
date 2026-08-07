import { describe, expect, it } from 'vitest'
import { composeMemoryBlock } from './memory-block.js'

describe('composeMemoryBlock', () => {
  it('composeMemoryBlock_emptyReturnsEmptyString', () => {
    expect(composeMemoryBlock('')).toBe('')
    expect(composeMemoryBlock('   ')).toBe('')
  })

  it('wraps journal content in preamble/footer', () => {
    const journal = '### 2026-01-02T00:00:00.000Z\nsegunda decisão\n\n### 2026-01-01T00:00:00.000Z\nprimeira decisão\n\n'
    const block = composeMemoryBlock(journal)
    expect(block).toContain('EngrenaCode Memory')
    expect(block).toContain('segunda decisão')
    expect(block).toContain('primeira decisão')
    expect(block.trim().endsWith('--- fim da memoria ---')).toBe(true)
  })

  it('composeMemoryBlock_truncatesToTokenBudget', () => {
    const entries: string[] = []
    for (let i = 0; i < 200; i++) {
      entries.push(`### 2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z\nentrada número ${i} com algum texto de contexto\n\n`)
    }
    const journal = entries.join('')
    const block = composeMemoryBlock(journal)

    expect(block.length).toBeLessThan(journal.length)
    // Entrada mais recente (índice 0, primeira no journal) sobrevive; entradas mais antigas (fim) são cortadas primeiro.
    expect(block).toContain('entrada número 0 ')
    expect(block).not.toContain('entrada número 199 ')
  })
})

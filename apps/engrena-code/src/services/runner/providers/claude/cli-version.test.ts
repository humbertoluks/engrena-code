import { afterEach, describe, expect, it } from 'vitest'
import {
  peekClaudeCliVersion,
  readClaudeCliVersion,
  resetClaudeCliVersionReaderForTesting,
  setClaudeCliVersionReaderForTesting,
} from './cli-version.js'

afterEach(() => {
  resetClaudeCliVersionReaderForTesting()
})

/**
 * `peek` existe por causa de F30: dois pontos precisam da versão sem poder pagar por ela — o
 * `GET /api/config/status` (alimenta o Dashboard em cada abertura de tela) e o instante da negação
 * nativa no dispatch. Se `peek` esperasse ou spawnasse, os dois voltariam a custar até 5 s.
 */
describe('peekClaudeCliVersion (F30)', () => {
  it('devolve null com o cache frio, sem invocar o reader', () => {
    let readerCalls = 0
    setClaudeCliVersionReaderForTesting(async () => {
      readerCalls += 1
      return { outcome: 'answered' as const, rawOutput: '2.1.234 (Claude Code)' }
    })

    expect(peekClaudeCliVersion()).toBeNull()
    expect(readerCalls).toBe(0)
  })

  it('continua null enquanto a leitura está em voo e passa a devolvê-la depois', async () => {
    let release: (() => void) | null = null
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    setClaudeCliVersionReaderForTesting(async () => {
      await gate
      return { outcome: 'answered' as const, rawOutput: '2.1.234 (Claude Code)' }
    })

    const pending = readClaudeCliVersion()
    expect(peekClaudeCliVersion()).toBeNull()

    release?.()
    await pending

    expect(peekClaudeCliVersion()).toEqual({ outcome: 'answered', rawOutput: '2.1.234 (Claude Code)' })
  })

  it('binário ausente fica registrado como unavailable, não como cache frio', async () => {
    setClaudeCliVersionReaderForTesting(async () => ({ outcome: 'unavailable' as const }))

    await readClaudeCliVersion()

    // A distinção importa para a UI: `null` significa "ainda não sei" (nenhuma caption), e
    // `unavailable` significa "o binário não respondeu" (a row já diz "não instalado").
    expect(peekClaudeCliVersion()).toEqual({ outcome: 'unavailable' })
  })

  it('reader que rejeita cai em unavailable sem vazar a exceção', async () => {
    setClaudeCliVersionReaderForTesting(async () => {
      throw new Error('boom')
    })

    await expect(readClaudeCliVersion()).resolves.toEqual({ outcome: 'unavailable' })
    expect(peekClaudeCliVersion()).toEqual({ outcome: 'unavailable' })
  })
})

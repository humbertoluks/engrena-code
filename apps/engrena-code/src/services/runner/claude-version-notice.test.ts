import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PERMISSION_CONTRACT_MAX_VALIDATED_VERSION,
  PERMISSION_CONTRACT_MIN_VALIDATED_VERSION,
} from './providers/permission-contract.js'

const emitMock = vi.fn<(threadId: string, event: unknown) => void>()
const createLogEntryMock = vi.fn<(input: unknown) => unknown>()

// Mocks precisam vir antes do import dinâmico do módulo sob teste (ordem de hoisting do vitest):
// claude-version-notice.ts importa `createLogEntry` no topo, e sem isso o teste bateria em banco
// de verdade.
//
// O mock de `ws-hub` fica de propósito mesmo depois de F30 tirar o emit: é o guarda de regressão.
// Se alguém voltar a mandar a versão do CLI para a tarja âmbar do chat, `emitMock` registra a
// chamada e os testes abaixo quebram — sem ele, o retorno passaria em silêncio.
vi.mock('./ws-hub.js', () => ({
  emit: (threadId: string, event: unknown) => emitMock(threadId, event),
}))

vi.mock('../db/repositories/log-entries.js', () => ({
  createLogEntry: (input: unknown) => createLogEntryMock(input),
}))

const { announceClaudeCliVersionOnce, resetClaudeCliVersionNoticeForTesting } = await import(
  './claude-version-notice.js'
)
const { setClaudeCliVersionReaderForTesting, resetClaudeCliVersionReaderForTesting } = await import(
  './providers/claude/cli-version.js'
)

function answeredReader(rawOutput: string, onCall?: () => void) {
  return async () => {
    onCall?.()
    return { outcome: 'answered' as const, rawOutput }
  }
}

beforeEach(() => {
  emitMock.mockReset()
  createLogEntryMock.mockReset()
  resetClaudeCliVersionNoticeForTesting()
  resetClaudeCliVersionReaderForTesting()
})

afterEach(() => {
  resetClaudeCliVersionNoticeForTesting()
  resetClaudeCliVersionReaderForTesting()
})

describe('announceClaudeCliVersionOnce (D3 + F30)', () => {
  it('versão above-max grava um log_entries kind=task com a faixa e NÃO emite nada no WS', async () => {
    setClaudeCliVersionReaderForTesting(answeredReader('2.1.233 (Claude Code)'))

    announceClaudeCliVersionOnce('thr_above', 'claude')

    await vi.waitFor(() => {
      expect(createLogEntryMock).toHaveBeenCalledTimes(1)
    })

    // A linha técnica continua sendo o destino do diagnóstico (F08 / work log): é onde a faixa
    // validada e o "turno não foi bloqueado" podem aparecer sem virar erro na cara do usuário.
    const entry = createLogEntryMock.mock.calls[0][0] as { threadId: string; kind: string; event: string }
    expect(entry).toMatchObject({ threadId: 'thr_above', kind: 'task' })
    expect(entry.event).toContain('2.1.233')
    expect(entry.event).toContain(
      `${PERMISSION_CONTRACT_MIN_VALIDATED_VERSION} a ${PERMISSION_CONTRACT_MAX_VALIDATED_VERSION}`
    )

    // F30: a tarja âmbar do chat é lida como falha do turno, e versão fora da faixa não é falha —
    // o spawn não bloqueia. Nada de `cli.version_notice` no wire.
    expect(emitMock).not.toHaveBeenCalled()
  })

  it('versão in-range não loga nada', async () => {
    let readerInvoked = false
    setClaudeCliVersionReaderForTesting(answeredReader(PERMISSION_CONTRACT_MIN_VALIDATED_VERSION, () => {
      readerInvoked = true
    }))

    announceClaudeCliVersionOnce('thr_inrange', 'claude')

    // Nada acontece no caso feliz: espera o reader ter sido consumido (garantindo que a cadeia de
    // .then já rodou até o fim, já que só há microtasks entre a invocação e o branch de saída) antes
    // de afirmar ausência de efeito.
    await vi.waitFor(() => {
      expect(readerInvoked).toBe(true)
    })

    expect(emitMock).not.toHaveBeenCalled()
    expect(createLogEntryMock).not.toHaveBeenCalled()
  })

  it('outcome unavailable não loga', async () => {
    let readerInvoked = false
    setClaudeCliVersionReaderForTesting(async () => {
      readerInvoked = true
      return { outcome: 'unavailable' as const }
    })

    announceClaudeCliVersionOnce('thr_unavailable', 'claude')

    await vi.waitFor(() => {
      expect(readerInvoked).toBe(true)
    })

    expect(emitMock).not.toHaveBeenCalled()
    expect(createLogEntryMock).not.toHaveBeenCalled()
  })

  it('provider diferente de claude sai antes de qualquer leitura', () => {
    let readerInvoked = false
    setClaudeCliVersionReaderForTesting(async () => {
      readerInvoked = true
      return { outcome: 'unavailable' as const }
    })

    announceClaudeCliVersionOnce('thr_codex', 'codex')

    // Guarda sai de forma síncrona (provider !== 'claude'); nada foi agendado, então nem
    // vale a pena esperar — o reader nunca é chamado.
    expect(readerInvoked).toBe(false)
    expect(emitMock).not.toHaveBeenCalled()
    expect(createLogEntryMock).not.toHaveBeenCalled()
  })

  it('duas chamadas seguidas, inclusive de threads diferentes, gravam uma linha só (trava por processo)', async () => {
    let readerCalls = 0
    setClaudeCliVersionReaderForTesting(answeredReader('2.1.233 (Claude Code)', () => {
      readerCalls += 1
    }))

    announceClaudeCliVersionOnce('thr_first', 'claude')
    announceClaudeCliVersionOnce('thr_second', 'claude')

    await vi.waitFor(() => {
      expect(createLogEntryMock).toHaveBeenCalledTimes(1)
    })

    // A leitura do binário também é cacheada por processo (cli-version.ts): a segunda chamada
    // reaproveita a mesma promessa, sem spawn novo.
    expect(readerCalls).toBe(1)
    expect(createLogEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'thr_first', kind: 'task' })
    )
    expect(emitMock).not.toHaveBeenCalled()
  })

  it('log que lança não propaga erro para o chamador', async () => {
    setClaudeCliVersionReaderForTesting(answeredReader('2.1.233 (Claude Code)'))
    createLogEntryMock.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    expect(() => announceClaudeCliVersionOnce('thr_throws', 'claude')).not.toThrow()

    await vi.waitFor(() => {
      expect(createLogEntryMock).toHaveBeenCalledTimes(1)
    })
  })
})

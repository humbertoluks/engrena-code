import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PERMISSION_CONTRACT_MAX_VALIDATED_VERSION,
  PERMISSION_CONTRACT_MIN_VALIDATED_VERSION,
} from './providers/permission-contract.js'

const emitMock = vi.fn<(threadId: string, event: unknown) => void>()
const createLogEntryMock = vi.fn<(input: unknown) => unknown>()

// Mocks precisam vir antes do import dinâmico do módulo sob teste (ordem de hoisting do vitest):
// claude-version-notice.ts importa `emit`/`createLogEntry` no topo, e sem isso o teste subiria WS
// real e bateria em banco de verdade.
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

describe('announceClaudeCliVersionOnce (D3)', () => {
  it('versão above-max emite exatamente um cli.version_notice e grava um log_entries kind=task', async () => {
    setClaudeCliVersionReaderForTesting(answeredReader('2.1.233 (Claude Code)'))

    announceClaudeCliVersionOnce('thr_above', 'claude')

    await vi.waitFor(() => {
      expect(emitMock).toHaveBeenCalledTimes(1)
    })

    expect(emitMock).toHaveBeenCalledWith('thr_above', {
      type: 'cli.version_notice',
      threadId: 'thr_above',
      code: 'claude_cli_version_out_of_range',
      status: 'above-max',
      observedVersion: '2.1.233',
      minValidated: PERMISSION_CONTRACT_MIN_VALIDATED_VERSION,
      maxValidated: PERMISSION_CONTRACT_MAX_VALIDATED_VERSION,
    })

    expect(createLogEntryMock).toHaveBeenCalledTimes(1)
    expect(createLogEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'thr_above', kind: 'task' })
    )
  })

  it('versão in-range não emite nem loga', async () => {
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

  it('outcome unavailable não emite nem loga', async () => {
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

  it('duas chamadas seguidas, inclusive de threads diferentes, emitem uma vez só (trava por processo)', async () => {
    let readerCalls = 0
    setClaudeCliVersionReaderForTesting(answeredReader('2.1.233 (Claude Code)', () => {
      readerCalls += 1
    }))

    announceClaudeCliVersionOnce('thr_first', 'claude')
    announceClaudeCliVersionOnce('thr_second', 'claude')

    await vi.waitFor(() => {
      expect(emitMock).toHaveBeenCalledTimes(1)
    })

    // A leitura do binário também é cacheada por processo (cli-version.ts): a segunda chamada
    // reaproveita a mesma promessa, sem spawn novo.
    expect(readerCalls).toBe(1)
    expect(createLogEntryMock).toHaveBeenCalledTimes(1)
    expect(emitMock).toHaveBeenCalledWith('thr_first', expect.objectContaining({ type: 'cli.version_notice' }))
  })

  it('emit que lança não propaga erro para o chamador', async () => {
    setClaudeCliVersionReaderForTesting(answeredReader('2.1.233 (Claude Code)'))
    emitMock.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    expect(() => announceClaudeCliVersionOnce('thr_throws', 'claude')).not.toThrow()

    await vi.waitFor(() => {
      expect(emitMock).toHaveBeenCalledTimes(1)
    })
  })
})

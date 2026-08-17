import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllFollowupsForTesting,
  clearFollowups,
  FOLLOWUPS_TTL_MS,
  getCachedFollowups,
  MAX_CACHED_THREADS,
  resolveFollowups,
} from './followups-cache.js'

afterEach(() => {
  clearAllFollowupsForTesting()
  vi.useRealTimers()
})

/** Gerador injetado: o cache não precisa de provider, e assim o teste não spawna processo. */
function generator(followups: string[]): () => Promise<string[]> {
  return () => Promise.resolve(followups)
}

describe('followups-cache — teto e validade', () => {
  it('serve do cache enquanto a entrada é da mesma mensagem', async () => {
    await resolveFollowups('thr_a', 'msg_1', generator(['sugestão']))
    expect(getCachedFollowups('thr_a', 'msg_1')).toEqual(['sugestão'])
    // Mensagem nova invalida: a sugestão era da anterior.
    expect(getCachedFollowups('thr_a', 'msg_2')).toBeNull()
  })

  // Sem teto, um processo longo acumulava uma entrada por thread aberta, para sempre.
  it('não passa de MAX_CACHED_THREADS, descartando a escrita mais antiga', async () => {
    for (let i = 0; i < MAX_CACHED_THREADS + 5; i += 1) {
      await resolveFollowups(`thr_${i}`, 'msg', generator([`s${i}`]))
    }

    // As cinco primeiras saíram; as últimas continuam servíveis.
    expect(getCachedFollowups('thr_0', 'msg')).toBeNull()
    expect(getCachedFollowups('thr_4', 'msg')).toBeNull()
    expect(getCachedFollowups('thr_5', 'msg')).toEqual(['s5'])
    expect(getCachedFollowups(`thr_${MAX_CACHED_THREADS + 4}`, 'msg')).toEqual([
      `s${MAX_CACHED_THREADS + 4}`,
    ])
  })

  it('descarta sugestão vencida em vez de servir contexto velho', async () => {
    vi.useFakeTimers()
    await resolveFollowups('thr_ttl', 'msg', generator(['antiga']))
    expect(getCachedFollowups('thr_ttl', 'msg')).toEqual(['antiga'])

    vi.advanceTimersByTime(FOLLOWUPS_TTL_MS + 1)
    expect(getCachedFollowups('thr_ttl', 'msg')).toBeNull()
  })

  it('clearFollowups continua esquecendo a thread (DELETE)', async () => {
    await resolveFollowups('thr_del', 'msg', generator(['x']))
    clearFollowups('thr_del')
    expect(getCachedFollowups('thr_del', 'msg')).toBeNull()
  })
})

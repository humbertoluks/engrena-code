import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ComposerAttachment } from '../components/workspace/composerAttachments.logic'
import {
  appendItem,
  dispatchQueueHead,
  loadQueue,
  makeQueueItemId,
  normalizeQueueText,
  promoteItem,
  QUEUE_STORAGE_PREFIX,
  removeItem,
  restoreHead,
  saveQueue,
  splitHead,
  updateItemText,
  type QueueItem,
} from './messageQueue.logic'

function item(id: string, text = id): QueueItem {
  return { id, text, images: [], model: null, reasoningLevel: null }
}

// ── Transformações puras ─────────────────────────────────────────────────────

describe('appendItem', () => {
  it('acrescenta no fim sem mutar a fila original', () => {
    const queue = [item('a')]
    const next = appendItem(queue, item('b'))
    expect(next.map((q) => q.id)).toEqual(['a', 'b'])
    expect(queue.map((q) => q.id)).toEqual(['a'])
  })
})

describe('removeItem', () => {
  it('remove por id e ignora id inexistente', () => {
    const queue = [item('a'), item('b')]
    expect(removeItem(queue, 'a').map((q) => q.id)).toEqual(['b'])
    expect(removeItem(queue, 'zzz').map((q) => q.id)).toEqual(['a', 'b'])
  })
})

describe('normalizeQueueText', () => {
  it('devolve o texto sem espaços nas pontas', () => {
    expect(normalizeQueueText('  roda o build  ')).toBe('roda o build')
  })

  it('devolve null quando o texto vira vazio depois do trim (invariante 6)', () => {
    expect(normalizeQueueText('')).toBeNull()
    expect(normalizeQueueText('   ')).toBeNull()
    expect(normalizeQueueText(String.fromCharCode(10, 9, 32))).toBeNull()
  })
})

describe('updateItemText', () => {
  it('troca só o texto do item alvo', () => {
    const queue = [item('a', 'antes'), item('b', 'outro')]
    const next = updateItemText(queue, 'a', 'depois')
    expect(next[0]?.text).toBe('depois')
    expect(next[1]?.text).toBe('outro')
    expect(queue[0]?.text).toBe('antes')
  })
})

describe('promoteItem (invariante 7)', () => {
  it('move o item para a frente preservando a ordem dos demais', () => {
    const queue = [item('a'), item('b'), item('c')]
    expect(promoteItem(queue, 'c').map((q) => q.id)).toEqual(['c', 'a', 'b'])
  })

  it('é no-op (mesma referência) quando o item já é o primeiro', () => {
    const queue = [item('a'), item('b')]
    expect(promoteItem(queue, 'a')).toBe(queue)
  })

  it('é no-op (mesma referência) quando o item não existe', () => {
    const queue = [item('a'), item('b')]
    expect(promoteItem(queue, 'zzz')).toBe(queue)
  })
})

describe('splitHead / restoreHead', () => {
  it('separa topo e resto', () => {
    const { head, rest } = splitHead([item('a'), item('b')])
    expect(head?.id).toBe('a')
    expect(rest.map((q) => q.id)).toEqual(['b'])
  })

  it('fila vazia não tem topo', () => {
    expect(splitHead([]).head).toBeNull()
  })

  it('devolve o item para a FRENTE da fila corrente', () => {
    expect(restoreHead(item('a'), [item('b')]).map((q) => q.id)).toEqual(['a', 'b'])
  })
})

describe('makeQueueItemId', () => {
  it('gera ids distintos com o prefixo esperado', () => {
    const a = makeQueueItemId()
    const b = makeQueueItemId()
    expect(a.startsWith('q_')).toBe(true)
    expect(a).not.toBe(b)
  })
})

// ── Despacho (invariantes 1, 3 e 4) ──────────────────────────────────────────

function makePort(
  initial: QueueItem[],
  canDispatch: boolean,
  send: (i: QueueItem) => Promise<boolean>
) {
  let current = initial
  const commits: QueueItem[][] = []
  return {
    port: {
      read: () => current,
      commit: (next: QueueItem[]) => {
        current = next
        commits.push(next)
      },
      canDispatch,
      send,
    },
    commits,
    get current(): QueueItem[] {
      return current
    },
    push(extra: QueueItem): void {
      current = [...current, extra]
    },
  }
}

describe('dispatchQueueHead', () => {
  it('tira o topo da fila ANTES do envio (invariante 4)', async () => {
    const seen: QueueItem[][] = []
    const harness = makePort([item('a'), item('b')], true, async (i) => {
      // No instante do envio a fila já não contém o item despachado.
      seen.push(harness.current)
      expect(i.id).toBe('a')
      return true
    })
    dispatchQueueHead(harness.port)
    await Promise.resolve()
    expect(seen[0]?.map((q) => q.id)).toEqual(['b'])
  })

  it('envio ok: o item não volta e há uma única persistência (invariante 1)', async () => {
    const harness = makePort([item('a'), item('b')], true, async () => true)
    dispatchQueueHead(harness.port)
    await Promise.resolve()
    await Promise.resolve()
    expect(harness.commits).toHaveLength(1)
    expect(harness.current.map((q) => q.id)).toEqual(['b'])
  })

  it('envio falhou: o item volta para a FRENTE da fila corrente (invariante 4)', async () => {
    const harness = makePort([item('a'), item('b')], true, async () => false)
    dispatchQueueHead(harness.port)
    await Promise.resolve()
    await Promise.resolve()
    expect(harness.current.map((q) => q.id)).toEqual(['a', 'b'])
    // Duas mutações, duas persistências: a saída e a volta (invariante 1).
    expect(harness.commits).toHaveLength(2)
  })

  it('envio falhou depois de a fila crescer: o item volta na frente do que entrou no meio', async () => {
    const harness = makePort([item('a')], true, async () => {
      harness.push(item('novo'))
      return false
    })
    dispatchQueueHead(harness.port)
    await Promise.resolve()
    await Promise.resolve()
    expect(harness.current.map((q) => q.id)).toEqual(['a', 'novo'])
  })

  it('despacha uma única vez por chamada — nada de follow-up em dobro (invariante 3)', async () => {
    const send = vi.fn(async () => true)
    const harness = makePort([item('a')], true, send)
    dispatchQueueHead(harness.port)
    await Promise.resolve()
    expect(send).toHaveBeenCalledTimes(1)
    expect(harness.commits).toHaveLength(1)
  })

  it('não despacha com a fila vazia', () => {
    const send = vi.fn(async () => true)
    const harness = makePort([], true, send)
    dispatchQueueHead(harness.port)
    expect(send).not.toHaveBeenCalled()
    expect(harness.commits).toHaveLength(0)
  })

  it('não despacha sem thread selecionada — a fila fica intacta', () => {
    const send = vi.fn(async () => true)
    const harness = makePort([item('a')], false, send)
    dispatchQueueHead(harness.port)
    expect(send).not.toHaveBeenCalled()
    expect(harness.commits).toHaveLength(0)
    expect(harness.current.map((q) => q.id)).toEqual(['a'])
  })
})

// ── Serialização (invariantes 1 e 5) ─────────────────────────────────────────

function stubStorage(): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
  })
  return store
}

describe('saveQueue / loadQueue', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = stubStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('grava sob a chave versionada do contrato', () => {
    saveQueue('thread-1', [item('a')])
    expect(store.has(`${QUEUE_STORAGE_PREFIX}thread-1`)).toBe(true)
    expect(QUEUE_STORAGE_PREFIX).toBe('engrenacode.message-queue.v1.')
  })

  it('round-trip preserva o item inteiro (texto, modelo, reasoning, anexos)', () => {
    const attachment: ComposerAttachment = { id: 'f1', kind: 'file', path: 'src/a.ts' }
    const stored: QueueItem = {
      id: 'q_1',
      text: 'roda o build',
      images: [],
      attachments: [attachment],
      model: 'opus',
      reasoningLevel: 'high',
    }
    saveQueue('thread-1', [stored])
    expect(loadQueue('thread-1')).toEqual([stored])
  })

  it('fila vazia apaga a chave em vez de gravar uma lista vazia', () => {
    saveQueue('thread-1', [item('a')])
    saveQueue('thread-1', [])
    expect(store.has(`${QUEUE_STORAGE_PREFIX}thread-1`)).toBe(false)
    expect(loadQueue('thread-1')).toEqual([])
  })

  it('cada chave tem a sua fila — trocar de thread/projeto lê a fila certa (invariante 5)', () => {
    saveQueue('thread-1', [item('a')])
    saveQueue('project:p1', [item('b'), item('c')])
    expect(loadQueue('thread-1').map((q) => q.id)).toEqual(['a'])
    expect(loadQueue('project:p1').map((q) => q.id)).toEqual(['b', 'c'])
    expect(loadQueue('thread-desconhecida')).toEqual([])
  })

  it('conteúdo corrompido não derruba a tela — fila vazia', () => {
    store.set(`${QUEUE_STORAGE_PREFIX}thread-1`, '{nao eh json')
    expect(loadQueue('thread-1')).toEqual([])
  })

  it('localStorage indisponível: load devolve vazio e save não lança', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    })
    expect(loadQueue('thread-1')).toEqual([])
    expect(() => saveQueue('thread-1', [item('a')])).not.toThrow()
    expect(() => saveQueue('thread-1', [])).not.toThrow()
  })
})

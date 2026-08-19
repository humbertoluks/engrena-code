import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  withImplicitContext,
  type ComposerAttachment,
} from '../components/workspace/composerAttachments.logic'
import type { ComposerImage } from './messageQueue.logic'
import {
  clearDraftAfterSend,
  clearTextAndImages,
  COMPOSER_DRAFT_COPY,
  DRAFT_MAX_BYTES,
  DRAFT_MAX_THREADS,
  DRAFT_STORAGE_PREFIX,
  emptyDraft,
  evictOldDrafts,
  readDraft,
  rehydrateFromThread,
  removeDraft,
  restoreIntoDraft,
  saveDraft,
  serializeDraft,
  type ComposerDraft,
  type DraftThreadSnapshot,
} from './composerDraft.logic'

function image(id = 'i1'): ComposerImage {
  return { id, mimeType: 'image/png', name: `${id}.png`, dataBase64: 'AAAA', byteLength: 3 }
}

function fileAttachment(id: string, path = `src/${id}.ts`): ComposerAttachment {
  return { id, kind: 'file', path }
}

function draft(patch: Partial<ComposerDraft> = {}): ComposerDraft {
  return {
    provider: 'codex',
    model: 'gpt-5',
    reasoningLevel: 'high',
    accessLevel: 'supervised',
    executionMode: 'worktree',
    text: 'refatora o composer',
    images: [image()],
    attachments: [fileAttachment('a1'), fileAttachment('a2')],
    chatMode: 'revisor',
    ...patch,
  }
}

function thread(patch: Partial<DraftThreadSnapshot> = {}): DraftThreadSnapshot {
  return {
    id: 't1',
    provider: 'kimi',
    model: 'k2',
    reasoningLevel: 'low',
    accessLevel: 'full-access',
    executionMode: 'main',
    chatMode: 'planejador',
    ...patch,
  }
}

// ── Estado inicial ───────────────────────────────────────────────────────────

describe('emptyDraft', () => {
  it('nasce em auto-accept-edits (edição passa; Bash/MCP abrem o PermissionPrompt)', () => {
    expect(emptyDraft()).toEqual({
      provider: 'claude',
      model: null,
      reasoningLevel: null,
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
      text: '',
      images: [],
      attachments: [],
      chatMode: null,
    })
  })

  it('devolve listas próprias a cada chamada — nenhum draft compartilha array com outro', () => {
    const a = emptyDraft()
    const b = emptyDraft()
    expect(a.images).not.toBe(b.images)
    expect(a.attachments).not.toBe(b.attachments)
  })
})

// ── Os dois patches de limpeza ───────────────────────────────────────────────

describe('clearTextAndImages', () => {
  it('limpa texto e imagens e MANTÉM os anexos (thread nova / decisão de permissão)', () => {
    const before = draft()
    const next = clearTextAndImages(before)
    expect(next.text).toBe('')
    expect(next.images).toEqual([])
    expect(next.attachments).toBe(before.attachments)
  })

  it('preserva as pills do composer', () => {
    const next = clearTextAndImages(draft())
    expect(next.provider).toBe('codex')
    expect(next.model).toBe('gpt-5')
    expect(next.reasoningLevel).toBe('high')
    expect(next.accessLevel).toBe('supervised')
    expect(next.executionMode).toBe('worktree')
    expect(next.chatMode).toBe('revisor')
  })

  it('não muta o rascunho recebido', () => {
    const before = draft()
    clearTextAndImages(before)
    expect(before.text).toBe('refatora o composer')
    expect(before.images).toHaveLength(1)
    expect(before.attachments).toHaveLength(2)
  })
})

describe('clearDraftAfterSend', () => {
  it('limpa texto, imagens E anexos (o contexto já viajou com a mensagem)', () => {
    const next = clearDraftAfterSend(draft())
    expect(next.text).toBe('')
    expect(next.images).toEqual([])
    expect(next.attachments).toEqual([])
  })

  it('preserva as pills do composer', () => {
    const next = clearDraftAfterSend(draft())
    expect(next.provider).toBe('codex')
    expect(next.model).toBe('gpt-5')
    expect(next.reasoningLevel).toBe('high')
    expect(next.accessLevel).toBe('supervised')
    expect(next.executionMode).toBe('worktree')
    expect(next.chatMode).toBe('revisor')
  })

  it('não muta o rascunho recebido', () => {
    const before = draft()
    clearDraftAfterSend(before)
    expect(before.attachments).toHaveLength(2)
  })
})

describe('os dois patches não são intercambiáveis', () => {
  it('só o de pós-envio zera os anexos — trocar um pelo outro muda o que o usuário vê', () => {
    const before = draft()
    expect(clearTextAndImages(before).attachments).toHaveLength(2)
    expect(clearDraftAfterSend(before).attachments).toHaveLength(0)
  })

  it('nos demais campos os dois fazem a mesma coisa', () => {
    const before = draft()
    expect({ ...clearTextAndImages(before), attachments: [] }).toEqual(clearDraftAfterSend(before))
  })
})

// ── Rehidratação a partir da thread ──────────────────────────────────────────

describe('rehydrateFromThread', () => {
  it('traz provider/model/reasoning/access/execution/chatMode da thread', () => {
    const next = rehydrateFromThread(draft(), thread())
    expect(next.provider).toBe('kimi')
    expect(next.model).toBe('k2')
    expect(next.reasoningLevel).toBe('low')
    expect(next.accessLevel).toBe('full-access')
    expect(next.executionMode).toBe('main')
    expect(next.chatMode).toBe('planejador')
  })

  it('não toca no que o usuário está montando (texto, imagens e anexos)', () => {
    const before = draft()
    const next = rehydrateFromThread(before, thread())
    expect(next.text).toBe(before.text)
    expect(next.images).toBe(before.images)
    expect(next.attachments).toBe(before.attachments)
  })

  it('thread sem chatMode desmarca a pill de modo (undefined vira null)', () => {
    const withoutMode = thread()
    delete withoutMode.chatMode
    expect(rehydrateFromThread(draft(), withoutMode).chatMode).toBeNull()
    expect(rehydrateFromThread(draft(), thread({ chatMode: null })).chatMode).toBeNull()
  })

  it('model e reasoning nulos na thread limpam os do rascunho', () => {
    const next = rehydrateFromThread(draft(), thread({ model: null, reasoningLevel: null }))
    expect(next.model).toBeNull()
    expect(next.reasoningLevel).toBeNull()
  })

  it('não muta o rascunho recebido', () => {
    const before = draft()
    rehydrateFromThread(before, thread())
    expect(before.provider).toBe('codex')
    expect(before.accessLevel).toBe('supervised')
  })
})

// ── Contexto implícito não mora no rascunho ──────────────────────────────────

describe('rascunho × contexto implícito', () => {
  const activeFile = { path: 'src/aberto.ts' }

  it('o chip implícito não está em `attachments` — some do turno só ao desligar o implícito', () => {
    const cleared = clearDraftAfterSend(draft())
    expect(cleared.attachments).toEqual([])
    expect(withImplicitContext(cleared.attachments, activeFile, true)).toHaveLength(1)
    expect(withImplicitContext(cleared.attachments, activeFile, false)).toHaveLength(0)
  })

  it('anexo explícito do mesmo arquivo vence o implícito', () => {
    const explicit = [fileAttachment('a1', activeFile.path)]
    expect(withImplicitContext(explicit, activeFile, true)).toEqual(explicit)
  })
})

// ── Copy ─────────────────────────────────────────────────────────────────────

describe('COMPOSER_DRAFT_COPY', () => {
  it('mantém a copy PT-BR do #codebase exibida em `attachError`', () => {
    expect(COMPOSER_DRAFT_COPY).toEqual({
      codebaseEmptyQuery: 'Escreva o pedido antes de buscar no codebase.',
      codebaseNoHits: 'Nenhum trecho do projeto casou com esse pedido.',
      codebaseFailed: 'Não foi possível buscar no codebase.',
    })
  })
})

// ── Persistência do rascunho (F34) ───────────────────────────────────────────

/**
 * Stub com `length`/`key`, que a evicção usa para varrer as chaves — o stub da fila não os tem
 * porque ela nunca varre.
 */
function stubStorage(options: { failOnSet?: boolean } = {}): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    get length() {
      return store.size
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (options.failOnSet === true) {
        const err = new Error('QuotaExceededError')
        err.name = 'QuotaExceededError'
        throw err
      }
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
  })
  return store
}

describe('serializeDraft (F34)', () => {
  it('guarda texto e anexos explícitos', () => {
    const payload = serializeDraft(draft({ images: [] }), 1_000)
    expect(payload).toMatchObject({
      v: 1,
      text: 'refatora o composer',
      droppedImages: 0,
      touchedAt: 1_000,
    })
    expect(payload?.attachments.map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('conta as imagens em vez de guardá-las', () => {
    const payload = serializeDraft(draft({ images: [image('i1'), image('i2')] }))
    expect(payload?.droppedImages).toBe(2)
    // Base64 no storage estouraria a cota e levaria a fila junto.
    expect(JSON.stringify(payload)).not.toContain('dataBase64')
  })

  it('deixa fora o anexo implícito, que é derivado do arquivo aberto', () => {
    const implicito: ComposerAttachment = { id: 'imp', kind: 'file', path: 'src/aberto.ts', implicit: true }
    const payload = serializeDraft(draft({ attachments: [fileAttachment('a1'), implicito] }))
    expect(payload?.attachments.map((a) => a.id)).toEqual(['a1'])
  })

  it('não guarda pills: elas vivem na thread (F16)', () => {
    const serializado = JSON.stringify(serializeDraft(draft()))
    for (const campo of ['provider', 'model', 'reasoningLevel', 'accessLevel', 'executionMode', 'chatMode']) {
      expect(serializado).not.toContain(campo)
    }
  })

  it('rascunho sem texto e sem anexo não vale persistir', () => {
    expect(serializeDraft(draft({ text: '   ', attachments: [], images: [] }))).toBeNull()
    // Imagem sozinha também não: ela não é persistida, e a contagem sem rascunho não diz nada.
    expect(serializeDraft(draft({ text: '', attachments: [], images: [image()] }))).toBeNull()
  })
})

describe('saveDraft / readDraft (F34)', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = stubStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trip devolve texto, anexos e a contagem de imagens', () => {
    expect(saveDraft('thr_1', draft({ images: [image('i1'), image('i2')] }))).toBe('saved')
    const restored = readDraft('thr_1')
    expect(restored?.text).toBe('refatora o composer')
    expect(restored?.attachments.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(restored?.droppedImages).toBe(2)
  })

  it('usa a mesma convenção de chave da fila, por thread', () => {
    saveDraft('thr_1', draft())
    expect([...store.keys()]).toEqual([`${DRAFT_STORAGE_PREFIX}thr_1`])
  })

  it('rascunho de cada thread é independente', () => {
    saveDraft('thr_1', draft({ text: 'primeiro' }))
    saveDraft('thr_2', draft({ text: 'segundo' }))
    expect(readDraft('thr_1')?.text).toBe('primeiro')
    expect(readDraft('thr_2')?.text).toBe('segundo')
  })

  it('rascunho vazio remove a chave, não grava string vazia', () => {
    saveDraft('thr_1', draft())
    expect(saveDraft('thr_1', draft({ text: '', attachments: [], images: [] }))).toBe('removed')
    expect(store.has(`${DRAFT_STORAGE_PREFIX}thr_1`)).toBe(false)
    expect(readDraft('thr_1')).toBeNull()
  })

  it('acima do teto não persiste, e não trunca', () => {
    const gigante = draft({ text: 'x'.repeat(DRAFT_MAX_BYTES + 1), attachments: [], images: [] })
    expect(saveDraft('thr_grande', gigante)).toBe('too-large')
    // Meio prompt restaurado parece íntegro; é pior que rascunho nenhum.
    expect(readDraft('thr_grande')).toBeNull()
  })

  it('logo abaixo do teto ainda persiste', () => {
    const quaseGigante = draft({ text: 'x'.repeat(1_000), attachments: [], images: [] })
    expect(saveDraft('thr_ok', quaseGigante)).toBe('saved')
    expect(readDraft('thr_ok')?.text).toHaveLength(1_000)
  })

  it('removeDraft apaga só a thread pedida', () => {
    saveDraft('thr_1', draft())
    saveDraft('thr_2', draft())
    removeDraft('thr_1')
    expect(readDraft('thr_1')).toBeNull()
    expect(readDraft('thr_2')).not.toBeNull()
  })

  it('versão desconhecida é descartada, não migrada', () => {
    store.set(`${DRAFT_STORAGE_PREFIX}thr_v9`, JSON.stringify({ v: 9, text: 'antigo' }))
    expect(readDraft('thr_v9')).toBeNull()
    expect(store.has(`${DRAFT_STORAGE_PREFIX}thr_v9`)).toBe(false)
  })

  it('JSON corrompido não lança e abre o composer vazio', () => {
    store.set(`${DRAFT_STORAGE_PREFIX}thr_lixo`, '{isso não é json')
    expect(() => readDraft('thr_lixo')).not.toThrow()
    expect(readDraft('thr_lixo')).toBeNull()
  })

  it('forma inesperada com versão certa também é descartada', () => {
    store.set(`${DRAFT_STORAGE_PREFIX}thr_forma`, JSON.stringify({ v: 1, text: 42 }))
    expect(readDraft('thr_forma')).toBeNull()
  })

  it('chave ausente devolve null', () => {
    expect(readDraft('thr_nunca_vista')).toBeNull()
  })
})

describe('cota e storage indisponível (F34)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('QuotaExceededError não propaga: o composer não pode travar por persistência', () => {
    stubStorage({ failOnSet: true })
    expect(() => saveDraft('thr_1', draft())).not.toThrow()
    expect(saveDraft('thr_1', draft())).toBe('unavailable')
  })

  it('sem localStorage nenhum, ler e remover são no-op silenciosos', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readDraft('thr_1')).toBeNull()
    expect(() => removeDraft('thr_1')).not.toThrow()
    expect(() => evictOldDrafts()).not.toThrow()
  })
})

describe('evictOldDrafts (F34)', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = stubStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mantém o teto e derruba a mais antiga por último toque', () => {
    for (let i = 0; i < DRAFT_MAX_THREADS + 1; i += 1) {
      saveDraft(`thr_${i}`, draft({ text: `rascunho ${i}` }), 1_000 + i)
    }
    expect(evictOldDrafts()).toBe(1)
    // A de `touchedAt` menor é a que sai.
    expect(readDraft('thr_0')).toBeNull()
    expect(readDraft(`thr_${DRAFT_MAX_THREADS}`)).not.toBeNull()
  })

  it('abaixo do teto não derruba nada', () => {
    saveDraft('thr_1', draft(), 1_000)
    expect(evictOldDrafts()).toBe(0)
    expect(readDraft('thr_1')).not.toBeNull()
  })

  it('não toca em chave de outro domínio, como a da fila', () => {
    store.set('engrenacode.message-queue.v1.thr_1', '[]')
    saveDraft('thr_1', draft())
    evictOldDrafts(0)
    expect(store.has('engrenacode.message-queue.v1.thr_1')).toBe(true)
  })

  it('chave ilegível conta como candidata e sai primeiro', () => {
    store.set(`${DRAFT_STORAGE_PREFIX}thr_lixo`, 'não é json')
    saveDraft('thr_bom', draft(), 5_000)
    expect(evictOldDrafts(1)).toBe(1)
    expect(store.has(`${DRAFT_STORAGE_PREFIX}thr_lixo`)).toBe(false)
    expect(readDraft('thr_bom')).not.toBeNull()
  })
})

describe('restoreIntoDraft (F34)', () => {
  it('devolve texto e anexos e preserva as pills', () => {
    const corrente = draft({ text: '', attachments: [], images: [] })
    const restaurado = restoreIntoDraft(corrente, {
      text: 'voltou',
      attachments: [fileAttachment('a9')],
      droppedImages: 2,
    })
    expect(restaurado.text).toBe('voltou')
    expect(restaurado.attachments.map((a) => a.id)).toEqual(['a9'])
    // Pills continuam vindo da thread, não do rascunho.
    expect(restaurado.provider).toBe(corrente.provider)
    expect(restaurado.model).toBe(corrente.model)
    expect(restaurado.accessLevel).toBe(corrente.accessLevel)
  })

  it('a contagem de imagens não entra no rascunho: é aviso de UI', () => {
    const restaurado = restoreIntoDraft(emptyDraft(), { text: 'x', attachments: [], droppedImages: 3 })
    expect(restaurado.images).toEqual([])
    expect(JSON.stringify(restaurado)).not.toContain('droppedImages')
  })
})

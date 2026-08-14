import { describe, it, expect } from 'vitest'
import {
  withImplicitContext,
  type ComposerAttachment,
} from '../components/workspace/composerAttachments.logic'
import type { ComposerImage } from './messageQueue.logic'
import {
  clearDraftAfterSend,
  clearTextAndImages,
  COMPOSER_DRAFT_COPY,
  emptyDraft,
  rehydrateFromThread,
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

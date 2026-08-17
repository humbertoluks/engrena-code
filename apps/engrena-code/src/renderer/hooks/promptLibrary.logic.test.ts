import { describe, it, expect } from 'vitest'
import type { ChatModeItem } from '../services/prompt-library-service'
import {
  applyChatModeByName,
  applyModeToDraft,
  clearChatModeIfSelected,
  PROMPT_LIBRARY_COPY,
  validateChatModeName,
  validateSavedPrompt,
  type PromptLibraryDraft,
} from './promptLibrary.logic'

function draft(patch: Partial<PromptLibraryDraft> = {}): PromptLibraryDraft {
  return {
    provider: 'claude',
    model: 'sonnet',
    reasoningLevel: 'low',
    accessLevel: 'auto-accept-edits',
    executionMode: 'main',
    text: 'texto do composer',
    chatMode: null,
    ...patch,
  }
}

function mode(patch: Partial<ChatModeItem> = {}): ChatModeItem {
  return {
    id: 'm1',
    name: 'revisor',
    description: '',
    provider: 'codex',
    model: 'gpt-5',
    reasoningLevel: 'high',
    accessLevel: 'supervised',
    executionMode: 'worktree',
    instructions: '',
    source: 'db',
    file: null,
    ...patch,
  }
}

// ── Preset do modo sobre o rascunho ──────────────────────────────────────────

describe('applyModeToDraft', () => {
  it('em thread nova aplica o preset inteiro, provider e execution inclusos', () => {
    const next = applyModeToDraft(draft(), mode(), { isNewThread: true })
    expect(next).toMatchObject({
      chatMode: 'revisor',
      provider: 'codex',
      model: 'gpt-5',
      reasoningLevel: 'high',
      accessLevel: 'supervised',
      executionMode: 'worktree',
    })
  })

  it('em thread existente provider e executionMode ficam imutáveis', () => {
    const next = applyModeToDraft(draft(), mode(), { isNewThread: false })
    expect(next.provider).toBe('claude')
    expect(next.executionMode).toBe('main')
    // model/reasoning/access valem em qualquer thread
    expect(next).toMatchObject({ model: 'gpt-5', reasoningLevel: 'high', accessLevel: 'supervised' })
  })

  it('valor nulo ou fora do domínio cai no valor corrente do rascunho', () => {
    const next = applyModeToDraft(
      draft(),
      mode({
        provider: 'inexistente',
        model: null,
        reasoningLevel: null,
        accessLevel: 'nao-existe',
        executionMode: 'nao-existe',
      }),
      { isNewThread: true }
    )
    expect(next).toMatchObject({
      provider: 'claude',
      model: 'sonnet',
      reasoningLevel: 'low',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
      chatMode: 'revisor',
    })
  })

  it('não muta o rascunho original nem toca no texto do composer', () => {
    const original = draft()
    const next = applyModeToDraft(original, mode(), { isNewThread: true })
    expect(original.chatMode).toBeNull()
    expect(original.provider).toBe('claude')
    expect(next.text).toBe('texto do composer')
  })
})

describe('applyChatModeByName', () => {
  const modes = [mode(), mode({ id: 'm2', name: 'arquiteto', provider: 'claude' })]

  it('null limpa só o chatMode e preserva o resto do rascunho', () => {
    const original = draft({ chatMode: 'revisor' })
    const next = applyChatModeByName(original, modes, null, { isNewThread: true })
    expect(next.chatMode).toBeNull()
    expect(next).toMatchObject({
      provider: original.provider,
      model: original.model,
      reasoningLevel: original.reasoningLevel,
      accessLevel: original.accessLevel,
      executionMode: original.executionMode,
      text: original.text,
    })
  })

  it('nome inexistente é no-op: mesma referência, sem limpar o modo atual', () => {
    const original = draft({ chatMode: 'revisor' })
    expect(applyChatModeByName(original, modes, 'fantasma', { isNewThread: true })).toBe(original)
  })

  it('nome conhecido aplica o mesmo resultado de applyModeToDraft', () => {
    const original = draft()
    expect(applyChatModeByName(original, modes, 'revisor', { isNewThread: false })).toEqual(
      applyModeToDraft(original, mode(), { isNewThread: false })
    )
  })
})

describe('clearChatModeIfSelected', () => {
  it('limpa o chatMode quando o modo apagado é o selecionado', () => {
    expect(clearChatModeIfSelected(draft({ chatMode: 'revisor' }), 'revisor').chatMode).toBeNull()
  })

  it('mantém a mesma referência quando o modo apagado é outro', () => {
    const original = draft({ chatMode: 'arquiteto' })
    expect(clearChatModeIfSelected(original, 'revisor')).toBe(original)
  })

  it('sem modo selecionado nada muda', () => {
    const original = draft({ chatMode: null })
    expect(clearChatModeIfSelected(original, 'revisor')).toBe(original)
  })
})

// ── Validação ────────────────────────────────────────────────────────────────

describe('validateSavedPrompt', () => {
  it('slugifica o nome e usa o texto do composer trimado', () => {
    const res = validateSavedPrompt('Revisar PR!', '  corpo do prompt  ')
    expect(res).toEqual({ ok: true, value: { name: 'revisar-pr', body: 'corpo do prompt' } })
  })

  it('nome que slugifica para vazio recusa com a copy do composer', () => {
    expect(validateSavedPrompt('!!!', 'corpo')).toEqual({
      ok: false,
      error: PROMPT_LIBRARY_COPY.promptIncomplete,
    })
  })

  it('corpo em branco recusa com a mesma copy', () => {
    expect(validateSavedPrompt('nome-ok', '   ')).toEqual({
      ok: false,
      error: PROMPT_LIBRARY_COPY.promptIncomplete,
    })
  })

  it('mantém a mensagem PT-BR literal', () => {
    expect(PROMPT_LIBRARY_COPY.promptIncomplete).toBe(
      'Dê um nome ao prompt e escreva o texto antes de salvar.'
    )
  })
})

describe('validateChatModeName', () => {
  it('slugifica o nome do modo', () => {
    expect(validateChatModeName('Modo Revisão')).toEqual({ ok: true, value: 'modo-revisao' })
  })

  it('nome vazio recusa com a copy do modo', () => {
    expect(validateChatModeName('   ')).toEqual({
      ok: false,
      error: PROMPT_LIBRARY_COPY.modeNameRequired,
    })
  })

  it('mantém a mensagem PT-BR literal', () => {
    expect(PROMPT_LIBRARY_COPY.modeNameRequired).toBe('Dê um nome ao modo antes de salvar.')
  })
})

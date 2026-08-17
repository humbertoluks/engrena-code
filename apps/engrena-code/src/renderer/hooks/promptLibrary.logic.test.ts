import { describe, it, expect } from 'vitest'
import type { ChatModeItem } from '../services/prompt-library-service'
import type { SkillLinkState } from '../services/skills-service'
import type { RuleLinkState } from '../services/rules-service'
import {
  applyChatModeByName,
  applyModeToDraft,
  chatModeFormFrom,
  clearChatModeIfSelected,
  isModeCatalogChecked,
  renameChatModeIfSelected,
  selectableRuleNames,
  selectableSkillNames,
  toggleModeCatalogName,
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
    skills: null,
    rules: null,
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

// ── Catálogo do modo (skills/rules no formulário do composer) ─────────────────

function skillLink(patch: Partial<SkillLinkState> = {}): SkillLinkState {
  return {
    id: 'sk-1',
    name: 'revisao',
    description: '',
    category: null,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    linked: true,
    enabledInProject: true,
    sortOrder: null,
    ...patch,
  }
}

function ruleLink(patch: Partial<RuleLinkState> = {}): RuleLinkState {
  return {
    id: 'rl-1',
    name: 'pt-br',
    description: null,
    category: null,
    isGlobal: false,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    linked: true,
    activeInProject: true,
    suppressedHere: false,
    enabledInProject: true,
    sortOrder: null,
    contentBytes: 0,
    ...patch,
  }
}

describe('selectableSkillNames', () => {
  it('oferece só o que o turno resolve — mesmo predicado de resolveSkillsForProject', () => {
    const names = selectableSkillNames([
      skillLink({ id: 'a', name: 'ativa' }),
      skillLink({ id: 'b', name: 'nao-vinculada', linked: false, enabledInProject: null }),
      skillLink({ id: 'c', name: 'desligada-global', enabled: false }),
      skillLink({ id: 'd', name: 'desligada-no-projeto', enabledInProject: false }),
    ])
    expect(names).toEqual(['ativa'])
  })
})

describe('selectableRuleNames', () => {
  it('oferece só as rules ativas no projeto — mesmo predicado de resolveForTurn', () => {
    const names = selectableRuleNames([
      ruleLink({ id: 'a', name: 'ativa' }),
      ruleLink({ id: 'b', name: 'suprimida', activeInProject: false, suppressedHere: true }),
      ruleLink({ id: 'c', name: 'desligada', enabled: false }),
    ])
    expect(names).toEqual(['ativa'])
  })
})

describe('toggleModeCatalogName', () => {
  const all = ['a', 'b', 'c']

  it('desmarcar a partir de "todas" materializa a lista com o resto', () => {
    expect(toggleModeCatalogName(null, 'b', all)).toEqual(['a', 'c'])
  })

  it('desmarcar de uma lista explícita remove só aquele nome', () => {
    expect(toggleModeCatalogName(['a', 'c'], 'c', all)).toEqual(['a'])
  })

  it('marcar de volta respeita a ordem do catálogo, não a ordem do clique', () => {
    expect(toggleModeCatalogName(['c'], 'a', all)).toEqual(['a', 'c'])
  })

  it('desmarcar o último vira lista vazia (nenhuma), não "todas"', () => {
    expect(toggleModeCatalogName(['a'], 'a', all)).toEqual([])
  })

  it('remarcar tudo continua sendo lista explícita — só o botão "Todas" volta para null', () => {
    expect(toggleModeCatalogName(['a', 'b'], 'c', all)).toEqual(all)
  })
})

describe('isModeCatalogChecked', () => {
  it('sem filtro tudo aparece marcado', () => {
    expect(isModeCatalogChecked(null, 'qualquer')).toBe(true)
  })

  it('lista vazia não marca nada', () => {
    expect(isModeCatalogChecked([], 'a')).toBe(false)
  })

  it('lista explícita marca só o que está nela', () => {
    expect(isModeCatalogChecked(['a'], 'a')).toBe(true)
    expect(isModeCatalogChecked(['a'], 'b')).toBe(false)
  })
})

describe('chatModeFormFrom', () => {
  it('copia as listas em vez de compartilhar a referência do modo salvo', () => {
    const saved = mode({ name: 'revisor', instructions: 'só leitura', skills: ['a'], rules: ['r'] })
    const form = chatModeFormFrom(saved)
    form.skills?.push('b')
    expect(saved.skills).toEqual(['a'])
    expect(form).toEqual({ name: 'revisor', instructions: 'só leitura', skills: ['a', 'b'], rules: ['r'] })
  })

  it('preserva o null de "sem filtro"', () => {
    const form = chatModeFormFrom(mode({ skills: null, rules: null }))
    expect(form.skills).toBeNull()
    expect(form.rules).toBeNull()
  })
})

describe('renameChatModeIfSelected', () => {
  it('a pill segue o novo nome quando era ela a selecionada', () => {
    const next = renameChatModeIfSelected(draft({ chatMode: 'antigo' }), 'antigo', 'novo')
    expect(next.chatMode).toBe('novo')
  })

  it('renomear outro modo devolve a mesma referência', () => {
    const base = draft({ chatMode: 'outro' })
    expect(renameChatModeIfSelected(base, 'antigo', 'novo')).toBe(base)
  })
})

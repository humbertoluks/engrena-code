import { describe, expect, it } from 'vitest'
import {
  interpretPermissionChatReply,
  permissionResolveArgs,
  PERMISSION_CHIPS,
  PERMISSION_PENDING_HINT,
  type PermissionDecisionKind,
} from './permissionComposer.logic'

describe('interpretPermissionChatReply', () => {
  it('maps affirmative replies to allow', () => {
    for (const text of ['Sim', 'sim', 'S', 'yes', 'Y', 'Permitir', 'allow', 'ok', 'pode', '  SIM  ']) {
      expect(interpretPermissionChatReply(text)).toEqual({ kind: 'allow' })
    }
  })

  it('maps allow-all replies to allow_always (Claude Code don’t ask again)', () => {
    for (const text of ['Permitir todos', 'permitir sempre', 'sempre', 'todas', 'allow all', 'always', "don't ask again"]) {
      expect(interpretPermissionChatReply(text)).toEqual({ kind: 'allow_always' })
    }
  })

  it('maps project-scope allow replies before bare “sempre”', () => {
    for (const text of ['Sempre neste projeto', 'sempre neste projeto', 'Neste projeto']) {
      expect(interpretPermissionChatReply(text)).toEqual({ kind: 'allow_project' })
    }
  })

  it('maps negative replies to deny (including accented não)', () => {
    for (const text of ['Não', 'nao', 'N', 'no', 'Negar', 'deny', 'cancelar']) {
      expect(interpretPermissionChatReply(text)).toEqual({ kind: 'deny' })
    }
  })

  it('decides on a natural affirmative sentence starting with an allow word', () => {
    for (const text of [
      'Sim, pode prosseguir',
      'sim pode prosseguir',
      'Ok!',
      'Pode prosseguir.',
      'Permitir, por favor',
      'Aprovado',
      'Prosseguir',
    ]) {
      expect(interpretPermissionChatReply(text)).toEqual({ kind: 'allow' })
    }
  })

  it('decides on a natural negative sentence starting with a deny word', () => {
    for (const text of ['Não, cancele isso', 'nao pare', 'Negar, por favor']) {
      expect(interpretPermissionChatReply(text)).toEqual({ kind: 'deny' })
    }
  })

  it('still reads allow-all when the phrase carries punctuation', () => {
    expect(interpretPermissionChatReply('Permitir todos, por favor')).toEqual({ kind: 'allow_always' })
  })

  it('blocks a mixed sentence with words from both sides', () => {
    expect(interpretPermissionChatReply('Sim, mas não use npm')).toEqual({
      kind: 'blocked',
      message: PERMISSION_PENDING_HINT,
    })
  })

  it('blocks free-form text so it is not queued as a context-free follow-up', () => {
    for (const text of ['Crie o package.json', '', '   ']) {
      expect(interpretPermissionChatReply(text)).toEqual({
        kind: 'blocked',
        message: PERMISSION_PENDING_HINT,
      })
    }
  })
})

describe('permissionResolveArgs', () => {
  it('traduz cada decisão para o corpo do POST', () => {
    expect(permissionResolveArgs('allow')).toEqual({ allow: true, always: false, scope: 'thread' })
    expect(permissionResolveArgs('allow_always')).toEqual({ allow: true, always: true, scope: 'thread' })
    expect(permissionResolveArgs('deny')).toEqual({ allow: false, always: false, scope: 'thread' })
  })

  // O caso perigoso: persistir no projeto precisa de `always` **e** `scope` juntos. Esquecer um
  // grava a allowlist no lugar errado — na sessão do processo, e não no projeto (ou o contrário).
  it('allow_project leva always e scope de projeto juntos', () => {
    expect(permissionResolveArgs('allow_project')).toEqual({
      allow: true,
      always: true,
      scope: 'project',
    })
  })

  it('só deny nega', () => {
    const kinds: PermissionDecisionKind[] = ['allow', 'allow_always', 'allow_project', 'deny']
    const denying = kinds.filter((kind) => !permissionResolveArgs(kind).allow)
    expect(denying).toEqual(['deny'])
  })
})

describe('PERMISSION_CHIPS', () => {
  it('cobre as quatro decisões, sem repetir', () => {
    expect(PERMISSION_CHIPS.map((chip) => chip.kind)).toEqual([
      'allow',
      'allow_always',
      'allow_project',
      'deny',
    ])
  })

  /**
   * Ponte entre os dois gatilhos: o chip resolve pelo `kind` e não depende do parser para
   * funcionar, mas o rótulo continua sendo texto que quem prefere digitar pode escrever. Se um
   * rótulo mudar sem entrar no set correspondente, digitar "Permitir todos" deixa de conceder
   * (vira mensagem na fila, sem erro nenhum em tela) — este teste é quem avisa.
   */
  it('todo rótulo de chip, digitado no composer, chega ao mesmo kind', () => {
    for (const chip of PERMISSION_CHIPS) {
      expect(interpretPermissionChatReply(chip.label)).toEqual({ kind: chip.kind })
    }
  })

  it('rótulo digitado e chip clicado produzem o mesmo corpo de POST', () => {
    for (const chip of PERMISSION_CHIPS) {
      const typed = interpretPermissionChatReply(chip.label)
      expect(typed.kind).not.toBe('blocked')
      if (typed.kind === 'blocked') continue
      expect(permissionResolveArgs(typed.kind)).toEqual(permissionResolveArgs(chip.kind))
    }
  })
})

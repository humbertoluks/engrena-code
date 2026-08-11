import { describe, expect, it } from 'vitest'
import { interpretPermissionChatReply, PERMISSION_PENDING_HINT } from './permissionComposer.logic'

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

  it('maps negative replies to deny (including accented não)', () => {
    for (const text of ['Não', 'nao', 'N', 'no', 'Negar', 'deny', 'cancelar']) {
      expect(interpretPermissionChatReply(text)).toEqual({ kind: 'deny' })
    }
  })

  it('decides on a natural affirmative sentence starting with an allow word', () => {
    for (const text of ['Sim, pode prosseguir', 'sim pode prosseguir', 'Ok!', 'Pode prosseguir.', 'Permitir, por favor']) {
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

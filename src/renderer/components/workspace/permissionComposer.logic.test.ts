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

  it('blocks free-form text so it is not queued as a context-free follow-up', () => {
    expect(interpretPermissionChatReply('Crie o package.json')).toEqual({
      kind: 'blocked',
      message: PERMISSION_PENDING_HINT,
    })
  })
})

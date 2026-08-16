import { describe, expect, it } from 'vitest'
import {
  appendWorkspaceNotice,
  MAX_WORKSPACE_NOTICES,
  mcpNotice,
  nativeDenialMessage,
  nativeDenialNotice,
  type WorkspaceNotice,
} from './streamNotices.logic'

describe('nativeDenialMessage', () => {
  const ungated = {
    toolName: 'Bash',
    code: 'permission_native_denial',
    brokerGranted: false,
    decisionReasonType: 'mode',
  }

  it('nomeia a tool e explica a ausência do card quando o broker nunca viu a tool', () => {
    const text = nativeDenialMessage(ungated)
    expect(text).toContain('Bash')
    expect(text).toContain('EngrenaCode')
    expect(text).toContain('nenhum card apareceu no chat')
    expect(text).toContain('revise o nível de acesso da thread')
  })

  it('carrega o motivo e a explicação do CLI quando vêm', () => {
    const text = nativeDenialMessage({ ...ungated, decisionReason: 'Permission mode blocked tool' })
    expect(text).toContain('Motivo do CLI: mode.')
    expect(text).toContain('O CLI explicou: Permission mode blocked tool')
  })

  it('omite motivo e explicação vazios sem deixar espaço duplo', () => {
    const text = nativeDenialMessage({ toolName: 'Write', decisionReasonType: null, decisionReason: null })
    expect(text).toContain('Write')
    expect(text).not.toContain('Motivo do CLI')
    expect(text).not.toContain('O CLI explicou')
    expect(text).not.toContain('  ')
  })

  it('não deixa a frase sem sujeito quando o nome da tool vem vazio', () => {
    expect(nativeDenialMessage({ toolName: '   ' })).toContain('ferramenta desconhecida')
  })

  // R08 (smoke de 2026-08-16): o card apareceu, o usuário concedeu, o broker liberou e um hook
  // global do usuário negou depois. A copy antiga afirmava o contrário e mandava mexer no nível.
  describe('negação depois do grant do broker', () => {
    const afterGrant = {
      toolName: 'Bash',
      code: 'permission_native_denial',
      brokerGranted: true,
      decisionReasonType: 'hook',
      decisionReason: 'validate-git-log-limit.ps1 exige -n em git log',
    }

    it('diz que o EngrenaCode concedeu e que outro hook negou depois', () => {
      const text = nativeDenialMessage(afterGrant)
      expect(text).toContain('O EngrenaCode concedeu a ferramenta Bash')
      expect(text).toContain('outro hook PreToolUse')
    })

    it('não afirma ausência de card nem pede revisão do nível de acesso', () => {
      const text = nativeDenialMessage(afterGrant)
      expect(text).not.toContain('nenhum card apareceu')
      expect(text).not.toContain('sem pedir permissão ao EngrenaCode')
      expect(text).not.toContain('revise o nível de acesso')
      expect(text).toContain('O nível de acesso da thread não muda isso')
    })

    it('promove a explicação do hook, que é a causa real', () => {
      expect(nativeDenialMessage(afterGrant)).toContain(
        'O CLI explicou: validate-git-log-limit.ps1 exige -n em git log'
      )
    })
  })

  // O `message` do wire é o mesmo diagnóstico composto no runner a partir destes campos: repeti-lo
  // na faixa era a frase inteira duas vezes.
  it('ignora o message do wire em vez de concatenar o diagnóstico do runner', () => {
    const text = nativeDenialMessage({
      ...ungated,
      message: 'Aprovação nativa do Claude CLI negou a ferramenta Bash',
    } as Parameters<typeof nativeDenialMessage>[0])
    expect(text).not.toContain('Aprovação nativa do Claude CLI')
  })
})

describe('nativeDenialNotice', () => {
  it('vira aviso discriminado com a tool preservada', () => {
    const notice = nativeDenialNotice({
      toolName: 'Bash',
      code: 'permission_native_denial',
      brokerGranted: false,
    })
    expect(notice.kind).toBe('native_denial')
    expect(notice).toMatchObject({ toolName: 'Bash', code: 'permission_native_denial' })
    expect(notice.message).toContain('Bash')
  })

  it('propaga o caso do broker para a copy do aviso', () => {
    const notice = nativeDenialNotice({
      toolName: 'Bash',
      code: 'permission_native_denial',
      brokerGranted: true,
    })
    expect(notice.message).toContain('O EngrenaCode concedeu a ferramenta Bash')
  })
})

describe('mcpNotice', () => {
  it('mantém o formato antigo sob o discriminante mcp', () => {
    expect(mcpNotice({ mcpName: 'github', reason: 'timeout', message: 'MCP github indisponível' })).toEqual({
      kind: 'mcp',
      mcpName: 'github',
      reason: 'timeout',
      message: 'MCP github indisponível',
    })
  })
})

describe('appendWorkspaceNotice', () => {
  const notice = (i: number): WorkspaceNotice => ({
    kind: 'mcp',
    mcpName: `m${i}`,
    reason: 'r',
    message: `msg ${i}`,
  })

  it('acrescenta no fim', () => {
    expect(appendWorkspaceNotice([notice(1)], notice(2)).map((n) => n.message)).toEqual(['msg 1', 'msg 2'])
  })

  it('aplica o teto descartando os mais antigos', () => {
    let list: WorkspaceNotice[] = []
    for (let i = 0; i < MAX_WORKSPACE_NOTICES + 5; i += 1) list = appendWorkspaceNotice(list, notice(i))
    expect(list).toHaveLength(MAX_WORKSPACE_NOTICES)
    expect(list[0]?.message).toBe('msg 5')
    expect(list[list.length - 1]?.message).toBe(`msg ${MAX_WORKSPACE_NOTICES + 4}`)
  })

  it('não muta a lista recebida', () => {
    const original: WorkspaceNotice[] = [notice(1)]
    appendWorkspaceNotice(original, notice(2))
    expect(original).toHaveLength(1)
  })
})

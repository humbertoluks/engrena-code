import { describe, expect, it } from 'vitest'
import {
  appendWorkspaceNotice,
  MAX_WORKSPACE_NOTICES,
  mcpNotice,
  nativeDenialMessage,
  nativeDenialNotice,
  type NativeDenialEvent,
  type WorkspaceNotice,
} from './streamNotices.logic'

describe('nativeDenialMessage', () => {
  const ungated = {
    toolName: 'Bash',
    code: 'permission_native_denial',
    brokerOutcome: 'never-requested',
    decisionReasonType: 'mode',
  } satisfies NativeDenialEvent & { code: string }

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
      brokerOutcome: 'granted',
      decisionReasonType: 'hook',
      decisionReason: 'validate-git-log-limit.ps1 exige -n em git log',
    } satisfies NativeDenialEvent & { code: string }

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

  // R09 (smoke de 2026-08-16): o usuário negou `Read` no card e a faixa dizia que o CLI tinha
  // negado por conta própria, que nenhum card apareceu, e mandava revisar o nível de acesso.
  describe('negação do próprio usuário no card', () => {
    const denied = {
      toolName: 'Read',
      code: 'permission_native_denial',
      brokerOutcome: 'denied',
      decisionReasonType: 'hook',
    } satisfies NativeDenialEvent & { code: string }

    it('atribui a negação ao usuário, não ao CLI', () => {
      const text = nativeDenialMessage(denied)
      expect(text).toContain('Você negou a ferramenta Read')
      expect(text).not.toContain('por conta própria')
      expect(text).not.toContain('nenhum card apareceu')
    })

    it('ensina a liberar sem mandar mexer no nível de acesso', () => {
      const text = nativeDenialMessage(denied)
      expect(text).toContain('peça a ação de novo ao agente e conceda no card')
      expect(text).toContain('Permitir todos')
      expect(text).toContain('Sempre neste projeto')
      expect(text).not.toContain('revise o nível de acesso')
    })
  })

  describe('pedido expirado sem resposta', () => {
    const expired = {
      toolName: 'Bash',
      code: 'permission_native_denial',
      brokerOutcome: 'expired',
    } satisfies NativeDenialEvent & { code: string }

    it('diz que o card expirou e que o EngrenaCode negou por segurança', () => {
      const text = nativeDenialMessage(expired)
      expect(text).toContain('ficou sem resposta e expirou')
      expect(text).toContain('negou por segurança')
      expect(text).not.toContain('Você negou')
      expect(text).not.toContain('por conta própria')
    })

    it('pede a ação de novo sem culpar o nível de acesso', () => {
      const text = nativeDenialMessage(expired)
      expect(text).toContain('responda ao card enquanto ele estiver na tela')
      expect(text).not.toContain('revise o nível de acesso')
    })
  })

  describe('pedido que o EngrenaCode não conseguiu abrir', () => {
    const unavailable = {
      toolName: 'Write',
      code: 'permission_native_denial',
      brokerOutcome: 'unavailable',
    } satisfies NativeDenialEvent & { code: string }

    it('assume a falha interna em vez de atribuí-la ao usuário ou ao CLI', () => {
      const text = nativeDenialMessage(unavailable)
      expect(text).toContain('não conseguiu abrir o pedido de permissão')
      expect(text).toContain('falha interna do EngrenaCode')
      expect(text).not.toContain('Você negou')
      expect(text).not.toContain('por conta própria')
      expect(text).not.toContain('revise o nível de acesso')
    })
  })

  // Evento sem o campo (wire antigo, socket de outra versão) não pode virar acusação: cai no caso
  // conservador, o mesmo de "o broker nunca foi consultado".
  it('trata brokerOutcome ausente como "nunca consultado"', () => {
    expect(nativeDenialMessage({ toolName: 'Bash' })).toBe(
      nativeDenialMessage({ toolName: 'Bash', brokerOutcome: 'never-requested' })
    )
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

describe('nativeDenialMessage — casos que a granularidade e o cancel deixavam mentir', () => {
  it('atribui o cancelamento a quem cancelou, sem mandar responder um card que já saiu', () => {
    const text = nativeDenialMessage({
      toolName: 'Bash',
      brokerOutcome: 'cancelled',
    })
    expect(text).toContain('parou o turno')
    expect(text).not.toContain('ficou sem resposta')
    expect(text).not.toContain('revise o nível de acesso')
  })

  it('admite não saber a qual chamada a negação pertence quando as decisões conflitam', () => {
    const text = nativeDenialMessage({
      toolName: 'Bash',
      brokerOutcome: 'ambiguous',
    })
    expect(text).toContain('liberada numa chamada e negada em outra')
    expect(text).not.toContain('Você negou')
    expect(text).not.toContain('por conta própria')
  })

  it('ressalva o "nunca consultou" quando houve pedido recusado por tamanho no turno', () => {
    const text = nativeDenialMessage({
      toolName: 'Bash',
      brokerOutcome: 'never-requested',
      oversizedRequestInTurn: true,
    })
    expect(text).toContain('sem pedir permissão ao EngrenaCode')
    expect(text).toContain('grande demais')
  })

  it('não põe a ressalva de tamanho quando o broker sabe o que fez com a tool', () => {
    const text = nativeDenialMessage({
      toolName: 'Bash',
      brokerOutcome: 'denied',
      oversizedRequestInTurn: true,
    })
    expect(text).toContain('Você negou')
    expect(text).not.toContain('grande demais')
  })
})

describe('nativeDenialNotice', () => {
  it('vira aviso discriminado com a tool preservada', () => {
    const notice = nativeDenialNotice({
      toolName: 'Bash',
      code: 'permission_native_denial',
      brokerOutcome: 'never-requested',
    })
    expect(notice.kind).toBe('native_denial')
    expect(notice).toMatchObject({ toolName: 'Bash', code: 'permission_native_denial' })
    expect(notice.message).toContain('Bash')
  })

  it('propaga o caso do broker para a copy do aviso', () => {
    const notice = nativeDenialNotice({
      toolName: 'Bash',
      code: 'permission_native_denial',
      brokerOutcome: 'granted',
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

  // F30: a tarja tem dois kinds, não três — versão de CLI saiu daqui. O teto continua valendo
  // independente do discriminante do aviso.
  it('aplica o teto com os dois kinds misturados', () => {
    let list: WorkspaceNotice[] = []
    for (let i = 0; i < MAX_WORKSPACE_NOTICES + 3; i += 1) {
      const next: WorkspaceNotice =
        i % 2 === 0
          ? { kind: 'mcp', mcpName: `m${i}`, reason: 'r', message: `msg ${i}` }
          : { kind: 'native_denial', toolName: 'Bash', code: 'permission_native_denial', message: `msg ${i}` }
      list = appendWorkspaceNotice(list, next)
    }
    expect(list).toHaveLength(MAX_WORKSPACE_NOTICES)
    expect(list.some((n) => n.kind === 'mcp')).toBe(true)
    expect(list.some((n) => n.kind === 'native_denial')).toBe(true)
  })
})

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

/**
 * A tarja é copy de produto (F30): duas frases, o que aconteceu com a tool e o próximo passo.
 * Runtime — `PreToolUse`, faixa de versão, "contrato de permissão", motivo cru do CLI — fica no log.
 * Os literais abaixo vêm de `docs/F30-avisos-de-runtime-e-permissao/copy.md`.
 */
const RUNTIME_JARGON = [
  'PreToolUse',
  'contrato de permissão',
  'negou por segurança',
  '2.1.226',
  'faixa',
  'Motivo do CLI',
  'O CLI explicou',
  'O turno não foi bloqueado',
]

function expectNoRuntimeJargon(text: string): void {
  for (const term of RUNTIME_JARGON) expect(text).not.toContain(term)
}

describe('nativeDenialMessage', () => {
  const ungated = {
    toolName: 'Bash',
    code: 'permission_native_denial',
    brokerOutcome: 'never-requested',
  } satisfies NativeDenialEvent & { code: string }

  it('nomeia a tool e diz que nenhum card apareceu quando o broker nunca viu a tool', () => {
    expect(nativeDenialMessage(ungated)).toBe(
      'Bash foi recusada sem aparecer um card. Peça de novo. Se repetir, revise o nível de acesso da thread.'
    )
  })

  it('não deixa a frase sem sujeito quando o nome da tool vem vazio', () => {
    expect(nativeDenialMessage({ toolName: '   ' })).toContain('desconhecida')
  })

  it('nenhum caso vaza jargão de runtime para a tarja', () => {
    const outcomes = [
      'granted',
      'denied',
      'expired',
      'cancelled',
      'unavailable',
      'ambiguous',
      'never-requested',
    ] as const
    for (const brokerOutcome of outcomes) {
      expectNoRuntimeJargon(nativeDenialMessage({ toolName: 'Bash', brokerOutcome }))
    }
  })

  it('toda copy cabe em duas frases curtas', () => {
    const outcomes = ['granted', 'denied', 'expired', 'cancelled', 'unavailable', 'ambiguous'] as const
    for (const brokerOutcome of outcomes) {
      const text = nativeDenialMessage({ toolName: 'Bash', brokerOutcome })
      // Teto folgado de propósito: o que se cobra é "não voltou a ser parágrafo", não um número.
      expect(text.length).toBeLessThan(160)
      expect(text).not.toContain('  ')
    }
  })

  // R08 (smoke de 2026-08-16): o card apareceu, o usuário concedeu, o broker liberou e um hook
  // global do usuário negou depois. A copy antiga afirmava o contrário e mandava mexer no nível.
  describe('negação depois do grant do broker', () => {
    const afterGrant = {
      toolName: 'Bash',
      code: 'permission_native_denial',
      brokerOutcome: 'granted',
    } satisfies NativeDenialEvent & { code: string }

    it('diz que foi liberada aqui e negada por um hook do CLI', () => {
      expect(nativeDenialMessage(afterGrant)).toBe(
        'Bash foi liberada aqui, mas um hook do Claude CLI negou em seguida. Ajuste esse hook nos settings do Claude CLI, ou peça outro caminho ao agente.'
      )
    })

    it('não afirma ausência de card nem pede revisão do nível de acesso', () => {
      const text = nativeDenialMessage(afterGrant)
      expect(text).not.toContain('sem aparecer um card')
      expect(text).not.toContain('revise o nível de acesso')
    })

    // O motivo cru do hook é diagnóstico: vive em `log_entries`, não na tarja (F30). O campo
    // continua chegando no wire, e a copy simplesmente não o lê.
    it('não repete o motivo cru do CLI que chega no wire', () => {
      const withReason = {
        ...afterGrant,
        decisionReasonType: 'hook',
        decisionReason: 'validate-git-log-limit.ps1 exige -n em git log',
      } as Parameters<typeof nativeDenialMessage>[0]
      expect(nativeDenialMessage(withReason)).toBe(nativeDenialMessage(afterGrant))
    })
  })

  // R09 (smoke de 2026-08-16): o usuário negou `Read` no card e a faixa dizia que o CLI tinha
  // negado por conta própria, que nenhum card apareceu, e mandava revisar o nível de acesso.
  describe('negação do próprio usuário no card', () => {
    const denied = {
      toolName: 'Read',
      code: 'permission_native_denial',
      brokerOutcome: 'denied',
    } satisfies NativeDenialEvent & { code: string }

    it('atribui a negação ao usuário e ensina a liberar sem mexer no nível', () => {
      const text = nativeDenialMessage(denied)
      expect(text).toBe('Você negou Read. Peça de novo e conceda no card, ou use "Permitir todos".')
      expect(text).not.toContain('revise o nível de acesso')
    })
  })

  describe('pedido expirado sem resposta', () => {
    const expired = {
      toolName: 'Bash',
      code: 'permission_native_denial',
      brokerOutcome: 'expired',
    } satisfies NativeDenialEvent & { code: string }

    // O caso que motivou F30: o fail-closed de 2 min continua, mas o usuário lê um evento de
    // produto, não a justificativa de engenharia dele.
    it('é só "expirou" + "peça de novo"', () => {
      expect(nativeDenialMessage(expired)).toBe('A permissão de Bash expirou. Peça de novo ao agente.')
    })

    it('não diz que o EngrenaCode negou por segurança nem culpa o nível de acesso', () => {
      const text = nativeDenialMessage(expired)
      expect(text).not.toContain('negou por segurança')
      expect(text).not.toContain('revise o nível de acesso')
      expect(text).not.toContain('Você negou')
    })
  })

  describe('pedido que o EngrenaCode não conseguiu abrir', () => {
    it('assume a falha sem atribuí-la ao usuário nem ao CLI', () => {
      const text = nativeDenialMessage({ toolName: 'Write', brokerOutcome: 'unavailable' })
      expect(text).toBe('Não deu para pedir permissão de Write. Peça de novo ao agente.')
      expect(text).not.toContain('Você negou')
      expect(text).not.toContain('revise o nível de acesso')
    })
  })

  it('atribui o cancelamento a quem cancelou, sem mandar responder um card que já saiu', () => {
    const text = nativeDenialMessage({ toolName: 'Bash', brokerOutcome: 'cancelled' })
    expect(text).toBe(
      'O turno parou com a permissão de Bash ainda aberta. Peça de novo quando quiser retomar.'
    )
    expect(text).not.toContain('expirou')
  })

  it('admite decisões diferentes sem escolher um culpado', () => {
    const text = nativeDenialMessage({ toolName: 'Bash', brokerOutcome: 'ambiguous' })
    expect(text).toBe(
      'Bash teve decisões diferentes neste turno. Peça de novo e responda ao card que aparecer.'
    )
    expect(text).not.toContain('Você negou')
  })

  // Evento sem o campo (wire antigo, socket de outra versão) não pode virar acusação: cai no caso
  // conservador, o mesmo de "o broker nunca foi consultado".
  it('trata brokerOutcome ausente como "nunca consultado"', () => {
    expect(nativeDenialMessage({ toolName: 'Bash' })).toBe(
      nativeDenialMessage({ toolName: 'Bash', brokerOutcome: 'never-requested' })
    )
  })

  // O `message` do wire é o mesmo diagnóstico composto no runner: repeti-lo na faixa era a frase
  // inteira duas vezes.
  it('ignora o message do wire em vez de concatenar o diagnóstico do runner', () => {
    const text = nativeDenialMessage({
      ...ungated,
      message: 'Aprovação nativa do Claude CLI negou a ferramenta Bash',
    } as Parameters<typeof nativeDenialMessage>[0])
    expect(text).not.toContain('Aprovação nativa do Claude CLI')
  })
})

/**
 * A única porta por onde versão de CLI ainda chega à tarja — e só quando a permissão já quebrou
 * sem card aparecer. Num turno que correu normal, versão vive em `#configuracao` e no log.
 */
describe('nativeDenialMessage — causa de versão do CLI (F30)', () => {
  const CLI_CAUSE = 'A versão do Claude CLI nesta máquina ainda não foi conferida.'

  it('acrescenta uma frase quando a negação foi sem card e a versão está fora da faixa', () => {
    for (const cliVersionStatus of ['above-max', 'below-min', 'unparseable'] as const) {
      const text = nativeDenialMessage({
        toolName: 'Bash',
        brokerOutcome: 'never-requested',
        cliVersionStatus,
      })
      expect(text).toBe(
        `Bash foi recusada sem aparecer um card. ${CLI_CAUSE} Peça de novo. Se repetir, revise o nível de acesso da thread.`
      )
      // Uma frase, sem número de versão nem faixa — quem quer o detalhe abre Configuração.
      expectNoRuntimeJargon(text)
    }
  })

  it('não fala de versão quando o campo não veio (cache frio, binário mudo ou versão conferida)', () => {
    expect(nativeDenialMessage({ toolName: 'Bash', brokerOutcome: 'never-requested' })).not.toContain(
      'versão do Claude CLI'
    )
  })

  it('não fala de versão nos casos em que o card apareceu', () => {
    for (const brokerOutcome of ['granted', 'denied', 'expired', 'cancelled', 'ambiguous'] as const) {
      const text = nativeDenialMessage({
        toolName: 'Bash',
        brokerOutcome,
        cliVersionStatus: 'above-max',
      })
      expect(text).not.toContain('versão do Claude CLI')
    }
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
    expect(notice.message).toContain('foi liberada aqui, mas um hook do Claude CLI negou em seguida')
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

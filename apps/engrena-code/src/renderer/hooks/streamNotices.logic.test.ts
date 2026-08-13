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
  const base = {
    toolName: 'Bash',
    code: 'permission_native_denial',
    message: 'This command requires approval',
    decisionReasonType: 'mode',
  }

  it('nomeia a tool e explica a ausência do card', () => {
    const text = nativeDenialMessage(base)
    expect(text).toContain('Bash')
    expect(text).toContain('EngrenaCode')
    expect(text).toContain('nenhum card apareceu no chat')
  })

  it('carrega a mensagem e o motivo do CLI quando vêm', () => {
    const text = nativeDenialMessage(base)
    expect(text).toContain('This command requires approval')
    expect(text).toContain('Motivo do CLI: mode.')
  })

  it('omite mensagem e motivo vazios sem deixar espaço duplo', () => {
    const text = nativeDenialMessage({ toolName: 'Write', message: null, decisionReasonType: null })
    expect(text).toContain('Write')
    expect(text).not.toContain('Motivo do CLI')
    expect(text).not.toContain('  ')
  })

  it('não deixa a frase sem sujeito quando o nome da tool vem vazio', () => {
    expect(nativeDenialMessage({ toolName: '   ' })).toContain('ferramenta desconhecida')
  })
})

describe('nativeDenialNotice', () => {
  it('vira aviso discriminado com a tool preservada', () => {
    const notice = nativeDenialNotice({
      toolName: 'Bash',
      code: 'permission_native_denial',
      message: 'nope',
    })
    expect(notice.kind).toBe('native_denial')
    expect(notice).toMatchObject({ toolName: 'Bash', code: 'permission_native_denial' })
    expect(notice.message).toContain('Bash')
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

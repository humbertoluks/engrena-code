import { describe, expect, it } from 'vitest'
import {
  dropPermissionDecisionPendings,
  dropStalePermissionDecisionPendings,
  isPendingActive,
  pendingStatusLabel,
  reconcilePendingMessages,
  type PendingMessage,
} from './pendingMessages.logic'

function pending(overrides: Partial<PendingMessage> & { id: string; text: string }): PendingMessage {
  return {
    images: [],
    status: 'sent',
    createdAt: 1,
    ...overrides,
  }
}

describe('reconcilePendingMessages', () => {
  it('remove a bolha otimista quando o histórico traz a mensagem com o mesmo clientId', () => {
    const result = reconcilePendingMessages(
      [pending({ id: 'p1', text: 'Sim, pode prosseguir' })],
      [
        { role: 'user', content: 'Sim, pode prosseguir', clientId: 'p1' },
        { role: 'assistant', content: 'ok', clientId: null },
      ]
    )
    expect(result).toEqual([])
  })

  // O ponto desta reconciliação: o servidor reescreve o prompt antes de persistir (prefixo de modo
  // de chat, blocos de anexo, expansão de slash). Casando por conteúdo a bolha nunca sumia e o
  // usuário via a própria mensagem duplicada.
  it('reconcilia mesmo quando o servidor persistiu texto diferente do digitado', () => {
    const result = reconcilePendingMessages(
      [pending({ id: 'p1', text: 'arruma o login' })],
      [
        {
          role: 'user',
          content: '## Modo: Plan\n\n<contexto path="src/login.ts">…</contexto>\n\narruma o login',
          clientId: 'p1',
        },
      ]
    )
    expect(result).toEqual([])
  })

  it('mantém a bolha enquanto o servidor ainda não persistiu a mensagem', () => {
    const result = reconcilePendingMessages(
      [pending({ id: 'p1', text: 'Sim, pode prosseguir', status: 'sending' })],
      [{ role: 'assistant', content: 'Preciso autorização para rodar npm install', clientId: null }]
    )
    expect(result.map((p) => p.id)).toEqual(['p1'])
  })

  it('descarta só a bolha cujo id foi persistido quando o mesmo texto foi enviado duas vezes', () => {
    const result = reconcilePendingMessages(
      [pending({ id: 'p1', text: 'Sim' }), pending({ id: 'p2', text: 'Sim' })],
      [{ role: 'user', content: 'Sim', clientId: 'p2' }]
    )
    expect(result.map((p) => p.id)).toEqual(['p1'])
  })

  it('não casa por texto: mensagem persistida sem clientId nunca remove bolha', () => {
    const result = reconcilePendingMessages([pending({ id: 'p1', text: 'Sim' })], [{ role: 'user', content: 'Sim' }])
    expect(result.map((p) => p.id)).toEqual(['p1'])
  })

  it('nunca casa mensagem de assistant com bolha de usuário', () => {
    const result = reconcilePendingMessages(
      [pending({ id: 'p1', text: 'ok' })],
      [{ role: 'assistant', content: 'ok', clientId: 'p1' }]
    )
    expect(result.map((p) => p.id)).toEqual(['p1'])
  })

  it('preserva itens em fila e respostas de permissão', () => {
    const result = reconcilePendingMessages(
      [
        pending({ id: 'q1', text: 'Sim', status: 'queued' }),
        pending({ id: 'perm1', text: 'Sim', status: 'permission' }),
      ],
      [
        { role: 'user', content: 'Sim', clientId: 'q1' },
        { role: 'user', content: 'Sim', clientId: 'perm1' },
      ]
    )
    expect(result.map((p) => p.id)).toEqual(['q1', 'perm1'])
  })
})

describe('pendingStatusLabel', () => {
  it('descreve cada estado para o usuário', () => {
    expect(pendingStatusLabel('sending')).toBe('Enviando…')
    expect(pendingStatusLabel('sent')).toBe('Executando…')
    expect(pendingStatusLabel('queued')).toContain('Na fila')
    expect(pendingStatusLabel('permission')).toContain('permissão')
  })

  it('marca como ativo tudo que ainda vai render turno', () => {
    expect(isPendingActive('sending')).toBe(true)
    expect(isPendingActive('queued')).toBe(true)
    expect(isPendingActive('permission')).toBe(false)
  })
})

describe('dropPermissionDecisionPendings', () => {
  it('remove só bolhas de decisão de permissão/ask', () => {
    const result = dropPermissionDecisionPendings([
      pending({ id: 'p1', text: 'Permitir', status: 'permission' }),
      pending({ id: 'p2', text: 'follow-up', status: 'sent' }),
      pending({ id: 'p3', text: 'fila', status: 'queued' }),
    ])
    expect(result.map((p) => p.id)).toEqual(['p2', 'p3'])
  })
})

describe('dropStalePermissionDecisionPendings', () => {
  it('também remove sent cujo texto ainda é decisão (resíduo Executando…)', () => {
    const isDecision = (text: string) => text.trim().toLowerCase() === 'permitir'
    const result = dropStalePermissionDecisionPendings(
      [
        pending({ id: 'ghost', text: 'Permitir', status: 'sent' }),
        pending({ id: 'real', text: 'cria o readme', status: 'sent' }),
        pending({ id: 'perm', text: 'sim', status: 'permission' }),
      ],
      isDecision
    )
    expect(result.map((p) => p.id)).toEqual(['real'])
  })
})

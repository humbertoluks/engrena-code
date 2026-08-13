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
  it('remove a bolha otimista quando o histórico traz a mensagem persistida', () => {
    const result = reconcilePendingMessages(
      [pending({ id: 'p1', text: 'Sim, pode prosseguir' })],
      [
        { role: 'user', content: 'Sim, pode prosseguir' },
        { role: 'assistant', content: 'ok' },
      ]
    )
    expect(result).toEqual([])
  })

  it('mantém a bolha enquanto o servidor ainda não persistiu a mensagem', () => {
    const result = reconcilePendingMessages(
      [pending({ id: 'p1', text: 'Sim, pode prosseguir', status: 'sending' })],
      [{ role: 'assistant', content: 'Preciso autorização para rodar npm install' }]
    )
    expect(result.map((p) => p.id)).toEqual(['p1'])
  })

  it('descarta uma bolha por ocorrência quando o mesmo texto foi enviado duas vezes', () => {
    const result = reconcilePendingMessages(
      [pending({ id: 'p1', text: 'Sim' }), pending({ id: 'p2', text: 'Sim' })],
      [{ role: 'user', content: 'Sim' }]
    )
    expect(result.map((p) => p.id)).toEqual(['p2'])
  })

  it('ignora espaços em volta ao casar conteúdo', () => {
    const result = reconcilePendingMessages([pending({ id: 'p1', text: 'Sim' })], [{ role: 'user', content: ' Sim\n' }])
    expect(result).toEqual([])
  })

  it('nunca casa mensagem de assistant com bolha de usuário', () => {
    const result = reconcilePendingMessages([pending({ id: 'p1', text: 'ok' })], [{ role: 'assistant', content: 'ok' }])
    expect(result.map((p) => p.id)).toEqual(['p1'])
  })

  it('preserva itens em fila e respostas de permissão', () => {
    const result = reconcilePendingMessages(
      [
        pending({ id: 'q1', text: 'Sim', status: 'queued' }),
        pending({ id: 'perm1', text: 'Sim', status: 'permission' }),
      ],
      [{ role: 'user', content: 'Sim' }]
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

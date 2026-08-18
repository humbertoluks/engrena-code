import { describe, expect, it } from 'vitest'
import type { ThreadGate } from '../../hooks/threadGate.logic'
import { PERMISSION_PENDING_HINT } from './permissionComposer.logic'
import { routeComposerSend } from './composerRoute.logic'

function gateOf(kind: 'permission' | 'question'): ThreadGate {
  return {
    gateId: `gate_${kind}`,
    threadId: 'thr_1',
    kind,
    toolName: kind === 'permission' ? 'Bash' : null,
    payload: null,
    createdAt: 1,
    expiresAt: null,
  }
}

const PERMISSION_GATE = gateOf('permission')
const QUESTION_GATE = gateOf('question')

describe('routeComposerSend', () => {
  const base = {
    hasSelectedThread: true,
    hasSelectedProject: true,
    gate: null as ThreadGate | null,
    queueLength: 0,
    threadState: 'idle' as const,
  }

  it('maps Sim to resolve_permission when a permission gate is open', () => {
    expect(
      routeComposerSend({ ...base, text: 'Sim', threadState: 'waiting_permission', gate: PERMISSION_GATE })
    ).toEqual({ action: 'resolve_permission', decision: { kind: 'allow' } })
  })

  it('maps permitir todos to allow_always', () => {
    expect(
      routeComposerSend({
        ...base,
        text: 'Permitir todos',
        threadState: 'running',
        gate: PERMISSION_GATE,
      })
    ).toEqual({ action: 'resolve_permission', decision: { kind: 'allow_always' } })
  })

  it('maps Sempre neste projeto to allow_project', () => {
    expect(
      routeComposerSend({
        ...base,
        text: 'Sempre neste projeto',
        threadState: 'waiting_permission',
        gate: PERMISSION_GATE,
      })
    ).toEqual({ action: 'resolve_permission', decision: { kind: 'allow_project' } })
  })

  it('maps Não to deny', () => {
    expect(
      routeComposerSend({ ...base, text: 'Não', gate: PERMISSION_GATE, threadState: 'waiting_permission' })
    ).toEqual({ action: 'resolve_permission', decision: { kind: 'deny' } })
  })

  it('blocks free-form text and never enqueues while permission is pending', () => {
    expect(
      routeComposerSend({
        ...base,
        text: 'Crie o package.json',
        gate: PERMISSION_GATE,
        threadState: 'waiting_permission',
      })
    ).toEqual({ action: 'permission_blocked', message: PERMISSION_PENDING_HINT })
  })

  it('blocks when waiting_permission but no gate is known locally (lost WS) — never enqueue', () => {
    expect(
      routeComposerSend({
        ...base,
        text: 'Sim',
        threadState: 'waiting_permission',
        gate: null,
      })
    ).toEqual({ action: 'permission_blocked', message: PERMISSION_PENDING_HINT })
  })

  it('a question gate never satisfies the permission gate — waiting_permission still blocks', () => {
    expect(
      routeComposerSend({
        ...base,
        text: 'Sim',
        threadState: 'waiting_permission',
        gate: QUESTION_GATE,
      })
    ).toEqual({ action: 'permission_blocked', message: PERMISSION_PENDING_HINT })
  })

  it('routes to answer_question when waiting_user with an open question gate', () => {
    expect(
      routeComposerSend({
        ...base,
        text: 'Opção A',
        threadState: 'waiting_user',
        gate: QUESTION_GATE,
      })
    ).toEqual({ action: 'answer_question' })
  })

  it('waiting_user without a question gate enqueues instead of answering', () => {
    expect(routeComposerSend({ ...base, text: 'Opção A', threadState: 'waiting_user' })).toEqual({
      action: 'enqueue',
    })
  })

  it('enqueues follow-up while running without permission gate', () => {
    expect(routeComposerSend({ ...base, text: 'continua', threadState: 'running' })).toEqual({
      action: 'enqueue',
    })
  })

  it('sends follow-up when thread is idle', () => {
    expect(routeComposerSend({ ...base, text: 'olá', threadState: 'idle' })).toEqual({
      action: 'send_follow_up',
    })
  })

  it('sends new thread when none selected', () => {
    expect(
      routeComposerSend({
        ...base,
        text: 'nova tarefa',
        hasSelectedThread: false,
        threadState: null,
      })
    ).toEqual({ action: 'send_new' })
  })

  it('noops on empty text', () => {
    expect(routeComposerSend({ ...base, text: '   ' })).toEqual({ action: 'noop' })
  })
})

describe('routeComposerSend — fila não-vazia com a thread parada', () => {
  const base = {
    hasSelectedThread: true,
    hasSelectedProject: true,
    gate: null as ThreadGate | null,
    queueLength: 1,
    text: 'mensagem nova',
  }

  it('enfileira em vez de furar a fila, em qualquer estado assentado', () => {
    for (const threadState of ['idle', 'committed', 'error', 'cancelled'] as const) {
      expect(routeComposerSend({ ...base, threadState })).toEqual({ action: 'enqueue' })
    }
  })

  it('com a fila vazia o mesmo texto abre turno', () => {
    expect(routeComposerSend({ ...base, queueLength: 0, threadState: 'cancelled' })).toEqual({
      action: 'send_follow_up',
    })
  })

  it('sem thread ainda abre conversa nova — a fila daquela chave não teria para onde ir', () => {
    expect(
      routeComposerSend({ ...base, hasSelectedThread: false, threadState: null })
    ).toEqual({ action: 'send_new' })
  })

  it('decisão de permissão e resposta continuam na frente da fila', () => {
    expect(
      routeComposerSend({
        ...base,
        text: 'Sim',
        threadState: 'waiting_permission',
        gate: gateOf('permission'),
      })
    ).toEqual({ action: 'resolve_permission', decision: { kind: 'allow' } })
    expect(
      routeComposerSend({ ...base, threadState: 'waiting_user', gate: gateOf('question') })
    ).toEqual({ action: 'answer_question' })
  })

  it('texto vazio segue noop', () => {
    expect(routeComposerSend({ ...base, text: '   ', threadState: 'idle' })).toEqual({ action: 'noop' })
  })
})

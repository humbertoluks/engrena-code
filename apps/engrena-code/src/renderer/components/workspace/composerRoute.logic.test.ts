import { describe, expect, it } from 'vitest'
import { PERMISSION_PENDING_HINT } from './permissionComposer.logic'
import { routeComposerSend } from './composerRoute.logic'

describe('routeComposerSend', () => {
  const base = {
    hasSelectedThread: true,
    hasSelectedProject: true,
    hasPendingPermission: false,
    hasPendingQuestion: false,
    threadState: 'idle' as const,
  }

  it('maps Sim to resolve_permission when queue has a pending request', () => {
    expect(
      routeComposerSend({ ...base, text: 'Sim', threadState: 'waiting_permission', hasPendingPermission: true })
    ).toEqual({ action: 'resolve_permission', decision: { kind: 'allow' } })
  })

  it('maps permitir todos to allow_always', () => {
    expect(
      routeComposerSend({
        ...base,
        text: 'Permitir todos',
        threadState: 'running',
        hasPendingPermission: true,
      })
    ).toEqual({ action: 'resolve_permission', decision: { kind: 'allow_always' } })
  })

  it('maps Sempre neste projeto to allow_project', () => {
    expect(
      routeComposerSend({
        ...base,
        text: 'Sempre neste projeto',
        threadState: 'waiting_permission',
        hasPendingPermission: true,
      })
    ).toEqual({ action: 'resolve_permission', decision: { kind: 'allow_project' } })
  })

  it('maps Não to deny', () => {
    expect(
      routeComposerSend({ ...base, text: 'Não', hasPendingPermission: true, threadState: 'waiting_permission' })
    ).toEqual({ action: 'resolve_permission', decision: { kind: 'deny' } })
  })

  it('blocks free-form text and never enqueues while permission is pending', () => {
    expect(
      routeComposerSend({
        ...base,
        text: 'Crie o package.json',
        hasPendingPermission: true,
        threadState: 'waiting_permission',
      })
    ).toEqual({ action: 'permission_blocked', message: PERMISSION_PENDING_HINT })
  })

  it('blocks when waiting_permission but local queue is empty (lost WS) — never enqueue', () => {
    expect(
      routeComposerSend({
        ...base,
        text: 'Sim',
        threadState: 'waiting_permission',
        hasPendingPermission: false,
      })
    ).toEqual({ action: 'permission_blocked', message: PERMISSION_PENDING_HINT })
  })

  it('routes to answer_question when waiting_user with pending question', () => {
    expect(
      routeComposerSend({
        ...base,
        text: 'Opção A',
        threadState: 'waiting_user',
        hasPendingQuestion: true,
      })
    ).toEqual({ action: 'answer_question' })
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

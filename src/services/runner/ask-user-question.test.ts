import { describe, expect, it } from 'vitest'
import {
  createAskUserQuestionServer,
  resolveAskUserQuestion,
  rejectAskUserQuestion,
  hasPendingQuestion,
} from './ask-user-question.js'

describe('createAskUserQuestionServer', () => {
  it('holds the /ask response open until resolveAskUserQuestion is called', async () => {
    const server = await createAskUserQuestionServer('thr_1')

    const requestPromise = fetch(`http://127.0.0.1:${server.port}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ask-token': server.token },
      body: JSON.stringify({ prompt: 'Qual caminho seguir?', options: ['A', 'B'] }),
    })

    let settled = false
    void requestPromise.then(() => {
      settled = true
    })

    await new Promise((r) => setTimeout(r, 30))
    expect(settled).toBe(false)
    expect(hasPendingQuestion('thr_1')).toBe(true)

    const resolved = resolveAskUserQuestion('thr_1', { selectedOptions: ['A'] })
    expect(resolved).toBe(true)

    const res = await requestPromise
    const body = (await res.json()) as { content: Array<{ type: string; text: string }>; isError: boolean }
    expect(body.isError).toBe(false)
    expect(body.content[0].text).toBe('A')

    server.close()
  })

  it('rejects requests with a wrong token', async () => {
    const server = await createAskUserQuestionServer('thr_2')

    const res = await fetch(`http://127.0.0.1:${server.port}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ask-token': 'token-errado' },
      body: JSON.stringify({ prompt: 'x' }),
    })

    expect(res.status).toBe(403)
    server.close()
  })

  it('prefers freeText over selectedOptions when both are present', async () => {
    const server = await createAskUserQuestionServer('thr_3')

    const requestPromise = fetch(`http://127.0.0.1:${server.port}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ask-token': server.token },
      body: JSON.stringify({ prompt: 'x', options: ['A'] }),
    })
    await new Promise((r) => setTimeout(r, 20))

    resolveAskUserQuestion('thr_3', { selectedOptions: ['A'], freeText: 'texto livre' })
    const res = await requestPromise
    const body = (await res.json()) as { content: Array<{ type: string; text: string }> }
    expect(body.content[0].text).toBe('texto livre')

    server.close()
  })
})

describe('resolveAskUserQuestion', () => {
  it('is a silent no-op for a thread with no pending question', () => {
    expect(() => resolveAskUserQuestion('thr_desconhecida', { selectedOptions: ['A'] })).not.toThrow()
    expect(resolveAskUserQuestion('thr_desconhecida', { selectedOptions: ['A'] })).toBe(false)
  })
})

describe('rejectAskUserQuestion', () => {
  it('releases the pending /ask request with isError=true', async () => {
    const server = await createAskUserQuestionServer('thr_4')

    const requestPromise = fetch(`http://127.0.0.1:${server.port}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ask-token': server.token },
      body: JSON.stringify({ prompt: 'x' }),
    })
    await new Promise((r) => setTimeout(r, 20))

    const rejected = rejectAskUserQuestion('thr_4', 'Turno cancelado.')
    expect(rejected).toBe(true)

    const res = await requestPromise
    const body = (await res.json()) as { content: Array<{ type: string; text: string }>; isError: boolean }
    expect(body.isError).toBe(true)
    expect(body.content[0].text).toBe('Turno cancelado.')

    server.close()
  })

  it('is a silent no-op for a thread with no pending question', () => {
    expect(rejectAskUserQuestion('thr_desconhecida', 'motivo')).toBe(false)
  })
})

import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// O servidor delegou o fato "há pergunta pendente" ao ThreadGate (SQLite): estes testes precisam de
// um userData próprio e de threads reais (a linha do gate tem FK para `threads`).
process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_ask_'))

const { closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread } = await import('../db/repositories/threads.js')
const { clearAllGatesForTesting, hasOpenQuestionGate, listOpenQuestionGates } = await import('./gate.js')
const {
  createAskUserQuestionServer,
  resolveAskUserQuestion,
  rejectAskUserQuestion,
  hasPendingQuestion,
} = await import('./ask-user-question.js')

const fixtures: string[] = []

function seedThread(): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_ask_proj_'))
  fixtures.push(dir)
  const project = createProject({ path: dir })
  return createThread({
    projectId: project.id,
    provider: 'claude',
    accessLevel: 'supervised',
    executionMode: 'main',
    state: 'running',
  }).id
}

afterEach(() => {
  clearAllGatesForTesting()
})

afterAll(() => {
  closeDb()
  for (const dir of fixtures) rmSync(dir, { recursive: true, force: true })
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('createAskUserQuestionServer', () => {
  it('holds the /ask response open until resolveAskUserQuestion is called', async () => {
    const threadId = seedThread()
    const server = await createAskUserQuestionServer(threadId)

    const requestPromise = fetch(`http://127.0.0.1:${server.port}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ask-token': server.token },
      body: JSON.stringify({ prompt: 'Qual caminho seguir?', options: ['A', 'B'] }),
    })

    let settled = false
    void requestPromise.then(() => {
      settled = true
    })

    // Espera o gate existir (em vez de um sleep fixo, que fica flaky sob carga): a partir daí a
    // resposta HTTP só sai quando alguém resolver a pergunta.
    await waitFor(() => hasPendingQuestion(threadId))
    expect(settled).toBe(false)

    const resolved = resolveAskUserQuestion(threadId, { selectedOptions: ['A'] })
    expect(resolved).toBe(true)

    const res = await requestPromise
    const body = (await res.json()) as { content: Array<{ type: string; text: string }>; isError: boolean }
    expect(body.isError).toBe(false)
    expect(body.content[0].text).toBe('A')

    server.close()
  })

  it('persiste a pergunta do corpo como payload consultável do gate', async () => {
    const threadId = seedThread()
    const server = await createAskUserQuestionServer(threadId)

    const requestPromise = fetch(`http://127.0.0.1:${server.port}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ask-token': server.token },
      body: JSON.stringify({ prompt: 'Qual caminho seguir?', options: ['A', 'B'], multiSelect: false }),
    })
    await waitFor(() => hasPendingQuestion(threadId))

    const [gate] = listOpenQuestionGates(threadId)
    expect(gate.question).toEqual({ prompt: 'Qual caminho seguir?', options: ['A', 'B'], multiSelect: false })

    rejectAskUserQuestion(threadId, 'fim do teste')
    await requestPromise
    server.close()
  })

  /**
   * O `pending` antigo era um por thread e a segunda pergunta sobrescrevia a primeira em silêncio,
   * deixando o `POST /ask` anterior preso para sempre. Com gate, as duas coexistem.
   */
  it('duas perguntas no mesmo turno coexistem e cada uma recebe a sua resposta', async () => {
    const threadId = seedThread()
    const server = await createAskUserQuestionServer(threadId)

    const first = fetch(`http://127.0.0.1:${server.port}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ask-token': server.token },
      body: JSON.stringify({ prompt: 'Primeira?', options: ['A'] }),
    })
    await waitFor(() => listOpenQuestionGates(threadId).length === 1)

    const second = fetch(`http://127.0.0.1:${server.port}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ask-token': server.token },
      body: JSON.stringify({ prompt: 'Segunda?', options: ['B'] }),
    })
    await waitFor(() => listOpenQuestionGates(threadId).length === 2)

    // O wire legado não carrega gateId e responde a pergunta mais recente — é a que o card do chat
    // mostra (`findPendingAskUserQuestion` varre `toolCalls` de trás para frente).
    expect(resolveAskUserQuestion(threadId, { selectedOptions: ['B'] })).toBe(true)
    const secondBody = (await (await second).json()) as { content: Array<{ text: string }>; isError: boolean }
    expect(secondBody.isError).toBe(false)
    expect(secondBody.content[0].text).toBe('B')

    // A primeira continua pendente — nunca foi sobrescrita, que era o bug do `pending` por thread.
    expect(hasOpenQuestionGate(threadId)).toBe(true)
    expect(resolveAskUserQuestion(threadId, { selectedOptions: ['A'] })).toBe(true)
    const firstBody = (await (await first).json()) as { content: Array<{ text: string }> }
    expect(firstBody.content[0].text).toBe('A')

    server.close()
  })

  it('rejects requests with a wrong token', async () => {
    const threadId = seedThread()
    const server = await createAskUserQuestionServer(threadId)

    const res = await fetch(`http://127.0.0.1:${server.port}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ask-token': 'token-errado' },
      body: JSON.stringify({ prompt: 'x' }),
    })

    expect(res.status).toBe(403)
    server.close()
  })

  it('prefers freeText over selectedOptions when both are present', async () => {
    const threadId = seedThread()
    const server = await createAskUserQuestionServer(threadId)

    const requestPromise = fetch(`http://127.0.0.1:${server.port}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ask-token': server.token },
      body: JSON.stringify({ prompt: 'x', options: ['A'] }),
    })
    await waitFor(() => hasPendingQuestion(threadId))

    resolveAskUserQuestion(threadId, { selectedOptions: ['A'], freeText: 'texto livre' })
    const res = await requestPromise
    const body = (await res.json()) as { content: Array<{ type: string; text: string }> }
    expect(body.content[0].text).toBe('texto livre')

    server.close()
  })

  it('responde isError quando o gate não persiste (thread inexistente)', async () => {
    const server = await createAskUserQuestionServer('thr_inexistente')

    const res = await fetch(`http://127.0.0.1:${server.port}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ask-token': server.token },
      body: JSON.stringify({ prompt: 'x' }),
    })
    const body = (await res.json()) as { content: Array<{ text: string }>; isError: boolean }
    expect(body.isError).toBe(true)
    expect(body.content[0].text).toContain('Não foi possível registrar a pergunta')

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
    const threadId = seedThread()
    const server = await createAskUserQuestionServer(threadId)

    const requestPromise = fetch(`http://127.0.0.1:${server.port}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ask-token': server.token },
      body: JSON.stringify({ prompt: 'x' }),
    })
    await waitFor(() => hasPendingQuestion(threadId))

    const rejected = rejectAskUserQuestion(threadId, 'Turno cancelado.')
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

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error('waitFor: condição não satisfeita a tempo')
}

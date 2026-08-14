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
const {
  clearAllGatesForTesting,
  expireOpenQuestionGates,
  hasOpenQuestionGate,
  listOpenQuestionGates,
  resolveQuestionGate,
} = await import('./gate.js')
const { createAskUserQuestionServer } = await import('./ask-user-question.js')

/** O `rejectAskUserQuestion` de compat era exatamente isto — o servidor nunca foi dono do fato. */
function rejectQuestion(threadId: string, reason: string): boolean {
  return expireOpenQuestionGates(threadId, 'question_rejected', reason).length > 0
}

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
  it('holds the /ask response open until the question gate is answered', async () => {
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
    await waitFor(() => hasOpenQuestionGate(threadId))
    expect(settled).toBe(false)

    const [gate] = listOpenQuestionGates(threadId)
    expect(resolveQuestionGate(threadId, gate.gateId, { selectedOptions: ['A'] })).toEqual({ ok: true })

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
    await waitFor(() => hasOpenQuestionGate(threadId))

    const [gate] = listOpenQuestionGates(threadId)
    expect(gate.question).toEqual({ prompt: 'Qual caminho seguir?', options: ['A', 'B'], multiSelect: false })

    rejectQuestion(threadId, 'fim do teste')
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

    // Cada card carrega o seu `gateId`: a resposta vai para a pergunta escolhida, sem heurística de
    // "a mais recente" — responder fora de ordem é legítimo e não toca na outra.
    const [firstGate, secondGate] = listOpenQuestionGates(threadId)
    expect(resolveQuestionGate(threadId, secondGate.gateId, { selectedOptions: ['B'] })).toEqual({ ok: true })
    const secondBody = (await (await second).json()) as { content: Array<{ text: string }>; isError: boolean }
    expect(secondBody.isError).toBe(false)
    expect(secondBody.content[0].text).toBe('B')

    // A primeira continua pendente — nunca foi sobrescrita, que era o bug do `pending` por thread.
    expect(hasOpenQuestionGate(threadId)).toBe(true)
    expect(resolveQuestionGate(threadId, firstGate.gateId, { selectedOptions: ['A'] })).toEqual({ ok: true })
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
    await waitFor(() => hasOpenQuestionGate(threadId))

    const [gate] = listOpenQuestionGates(threadId)
    resolveQuestionGate(threadId, gate.gateId, { selectedOptions: ['A'], freeText: 'texto livre' })
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

describe('resolveQuestionGate', () => {
  it('is a silent no-op for a thread with no pending question', () => {
    expect(() =>
      resolveQuestionGate('thr_desconhecida', 'gate_fantasma', { selectedOptions: ['A'] })
    ).not.toThrow()
    expect(resolveQuestionGate('thr_desconhecida', 'gate_fantasma', { selectedOptions: ['A'] })).toEqual({
      ok: false,
      code: 'not_found',
    })
  })
})

describe('expireOpenQuestionGates (rejeição da pergunta pendente)', () => {
  it('releases the pending /ask request with isError=true', async () => {
    const threadId = seedThread()
    const server = await createAskUserQuestionServer(threadId)

    const requestPromise = fetch(`http://127.0.0.1:${server.port}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ask-token': server.token },
      body: JSON.stringify({ prompt: 'x' }),
    })
    await waitFor(() => hasOpenQuestionGate(threadId))

    const rejected = rejectQuestion(threadId, 'Turno cancelado.')
    expect(rejected).toBe(true)

    const res = await requestPromise
    const body = (await res.json()) as { content: Array<{ type: string; text: string }>; isError: boolean }
    expect(body.isError).toBe(true)
    expect(body.content[0].text).toBe('Turno cancelado.')

    server.close()
  })

  it('is a silent no-op for a thread with no pending question', () => {
    expect(rejectQuestion('thr_desconhecida', 'motivo')).toBe(false)
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

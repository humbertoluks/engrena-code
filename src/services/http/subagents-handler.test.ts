import http from 'http'
import axios, { type AxiosInstance } from 'axios'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { openDb } from '../db/client.js'
import { createSubagentsRepository } from '../db/repositories/subagents.js'
import { vaultService } from '../vault/vault-service.js'
import { handleSubagentsRequest, setSubagentsRepositoryForTests } from './subagents-handler.js'

let server: http.Server
let client: AxiosInstance
let sessionToken: string

function authHeaders() {
  return { 'x-engrenacode-session': sessionToken }
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'revisor-seguranca',
    description: 'Revisa diffs em busca de vulnerabilidades.',
    prompt: 'Você é um revisor de segurança.',
    provider: 'claude',
    ...overrides,
  }
}

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const handled = await handleSubagentsRequest(req, res)
    if (!handled) {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  client = axios.create({ baseURL: `http://127.0.0.1:${port}`, validateStatus: () => true })

  vaultService.unlock('test-workspace', 'test-password-123')
  sessionToken = vaultService.getSessionToken() as string
})

afterAll(() => {
  server.close()
  vaultService.lock()
})

beforeEach(() => {
  setSubagentsRepositoryForTests(createSubagentsRepository(openDb(':memory:')))
})

describe('subagents-handler', () => {
  it('rejects requests without a valid session', async () => {
    const res = await client.get('/api/subagents')
    expect(res.status).toBe(401)
    expect(res.data.error.code).toBe('unauthorized')
  })

  it('returns 423 vault_locked when the vault is locked', async () => {
    vaultService.lock()
    const res = await client.get('/api/subagents', { headers: authHeaders() })
    expect(res.status).toBe(423)
    expect(res.data.error.code).toBe('vault_locked')
    vaultService.unlock('test-workspace', 'test-password-123')
    sessionToken = vaultService.getSessionToken() as string
  })

  it('creates and lists subagents', async () => {
    const create = await client.post('/api/subagents', baseInput(), { headers: authHeaders() })
    expect(create.status).toBe(201)
    expect(create.data.subagent.name).toBe('revisor-seguranca')

    const list = await client.get('/api/subagents', { headers: authHeaders() })
    expect(list.status).toBe(200)
    expect(list.data.subagents).toHaveLength(1)
  })

  it('rejects duplicate name with 409', async () => {
    await client.post('/api/subagents', baseInput(), { headers: authHeaders() })
    const res = await client.post('/api/subagents', baseInput(), { headers: authHeaders() })
    expect(res.status).toBe(409)
    expect(res.data.error.code).toBe('subagent_name_conflict')
  })

  it('rejects prompt over 1 MiB with 400 too_long', async () => {
    const res = await client.post(
      '/api/subagents',
      baseInput({ prompt: 'a'.repeat(1_048_577) }),
      { headers: authHeaders() }
    )
    expect(res.status).toBe(400)
    expect(res.data.error.code).toBe('too_long')
  })

  it('rejects invalid provider with 400', async () => {
    const res = await client.post('/api/subagents', baseInput({ provider: 'grok' }), { headers: authHeaders() })
    expect(res.status).toBe(400)
    expect(res.data.error.code).toBe('validation_error')
  })

  it('updates and deletes a subagent', async () => {
    const create = await client.post('/api/subagents', baseInput(), { headers: authHeaders() })
    const id = create.data.subagent.id

    const update = await client.put(
      `/api/subagents/${id}`,
      { description: 'Nova descrição.' },
      { headers: authHeaders() }
    )
    expect(update.status).toBe(200)
    expect(update.data.subagent.description).toBe('Nova descrição.')

    const del = await client.delete(`/api/subagents/${id}`, { headers: authHeaders() })
    expect(del.status).toBe(200)
    expect(del.data.deleted).toBe(true)

    const list = await client.get('/api/subagents', { headers: authHeaders() })
    expect(list.data.subagents).toHaveLength(0)
  })

  it('returns 404 subagent_not_found when updating an unknown id', async () => {
    const res = await client.put('/api/subagents/nope', { description: 'x' }, { headers: authHeaders() })
    expect(res.status).toBe(404)
    expect(res.data.error.code).toBe('subagent_not_found')
  })

  it('links a subagent to a project and reports counts', async () => {
    const create = await client.post('/api/subagents', baseInput(), { headers: authHeaders() })
    const id = create.data.subagent.id

    const link = await client.put(
      `/api/projects/proj-1/subagents/${id}`,
      { enabled: true },
      { headers: authHeaders() }
    )
    expect(link.status).toBe(200)
    expect(link.data.subagent.linked).toBe(true)

    const listLinks = await client.get('/api/projects/proj-1/subagents', { headers: authHeaders() })
    expect(listLinks.status).toBe(200)
    expect(listLinks.data).toHaveLength(1)
    expect(listLinks.data[0].linked).toBe(true)

    const counts = await client.get('/api/subagents/counts', { headers: authHeaders() })
    expect(counts.status).toBe(200)
    expect(counts.data.global).toBe(1)
    expect(counts.data.linkedByProject['proj-1']).toBe(1)

    const unlink = await client.delete(`/api/projects/proj-1/subagents/${id}`, { headers: authHeaders() })
    expect(unlink.status).toBe(200)
  })

  it('reorders via catalog-order', async () => {
    const a = (await client.post('/api/subagents', baseInput({ name: 'a' }), { headers: authHeaders() })).data
      .subagent
    const b = (await client.post('/api/subagents', baseInput({ name: 'b' }), { headers: authHeaders() })).data
      .subagent
    await client.put(`/api/projects/proj-1/subagents/${a.id}`, {}, { headers: authHeaders() })
    await client.put(`/api/projects/proj-1/subagents/${b.id}`, {}, { headers: authHeaders() })

    const res = await client.put(
      '/api/projects/proj-1/catalog-order',
      {
        kind: 'subagents',
        items: [
          { id: a.id, enabled: true, sortOrder: 1 },
          { id: b.id, enabled: true, sortOrder: 0 },
        ],
      },
      { headers: authHeaders() }
    )
    expect(res.status).toBe(200)
    const bLink = res.data.subagents.find((s: { id: string }) => s.id === b.id)
    expect(bLink.sortOrder).toBe(0)
  })

  it('rejects catalog-order with non-contiguous sortOrder', async () => {
    const a = (await client.post('/api/subagents', baseInput({ name: 'a' }), { headers: authHeaders() })).data
      .subagent
    await client.put(`/api/projects/proj-1/subagents/${a.id}`, {}, { headers: authHeaders() })

    const res = await client.put(
      '/api/projects/proj-1/catalog-order',
      { kind: 'subagents', items: [{ id: a.id, enabled: true, sortOrder: 5 }] },
      { headers: authHeaders() }
    )
    expect(res.status).toBe(400)
  })
})

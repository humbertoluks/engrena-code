import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { EventEmitter } from 'node:events'

const SESSION_TOKEN = 'test-session-token'
const vaultState = { locked: false }

vi.mock('../vault/vault-service.js', () => ({
  vaultService: {
    getSessionToken: () => SESSION_TOKEN,
    isLocked: () => vaultState.locked,
  },
}))

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_prompt_http_'))

const { getDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { handlePromptLibraryRequest } = await import('./prompt-library-handler.js')

function fakeRequest(method: string, url: string, body?: unknown, authorized = true): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage
  req.method = method
  req.url = url
  req.headers = { 'x-engrenacode-session': authorized ? SESSION_TOKEN : 'invalid-token' }
  queueMicrotask(() => {
    if (body !== undefined) req.emit('data', Buffer.from(JSON.stringify(body)))
    req.emit('end')
  })
  return req
}

function fakeResponse(): ServerResponse & { statusCode: number; body: string } {
  const res = {
    statusCode: 0,
    body: '',
    writeHead(status: number) {
      res.statusCode = status
      return res
    },
    end(chunk?: string) {
      if (chunk !== undefined) res.body = chunk
    },
  } as unknown as ServerResponse & { statusCode: number; body: string }
  return res
}

async function call(method: string, url: string, body?: unknown, authorized = true) {
  const res = fakeResponse()
  const handled = await handlePromptLibraryRequest(fakeRequest(method, url, body, authorized), res)
  return { handled, status: res.statusCode, json: res.body === '' ? null : JSON.parse(res.body) }
}

let projectId: string
let projectRoot: string

beforeEach(() => {
  vaultState.locked = false
  getDb().exec('DELETE FROM saved_prompts')
  getDb().exec('DELETE FROM chat_modes')
  getDb().exec('DELETE FROM projects')
  projectRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_prompt_http_proj_'))
  projectId = createProject({ path: projectRoot }).id
})

describe('guarda', () => {
  it('cofre travado responde 423 antes do token', async () => {
    vaultState.locked = true
    expect((await call('GET', `/api/projects/${projectId}/prompts`)).status).toBe(423)
  })

  it('token inválido responde 401', async () => {
    expect((await call('GET', `/api/projects/${projectId}/prompts`, undefined, false)).status).toBe(401)
  })

  it('rota de outro domínio não é capturada', async () => {
    expect((await call('GET', '/api/projects/x/threads')).handled).toBe(false)
  })
})

describe('prompts', () => {
  it('cria e lista', async () => {
    const created = await call('POST', `/api/projects/${projectId}/prompts`, {
      name: 'revisao',
      description: 'Revisa o diff',
      body: 'Revise ${input:arquivo}',
    })
    expect(created.status).toBe(201)

    const list = await call('GET', `/api/projects/${projectId}/prompts`)
    expect(list.status).toBe(200)
    expect(list.json.prompts).toHaveLength(1)
    expect(list.json.prompts[0].source).toBe('db')
  })

  it('nome inválido responde 400 e duplicado 409', async () => {
    expect((await call('POST', `/api/projects/${projectId}/prompts`, { name: 'Com Espaço', body: 'x' })).status).toBe(400)
    expect((await call('POST', `/api/projects/${projectId}/prompts`, { body: 'x' })).status).toBe(400)
    await call('POST', `/api/projects/${projectId}/prompts`, { name: 'unico', body: 'x' })
    expect((await call('POST', `/api/projects/${projectId}/prompts`, { name: 'unico', body: 'y' })).status).toBe(409)
  })

  it('projeto inexistente responde 404', async () => {
    expect((await call('GET', '/api/projects/nao-existe/prompts')).status).toBe(404)
  })

  it('lista junta arquivo do repo como somente leitura', async () => {
    mkdirSync(join(projectRoot, '.engrena', 'prompts'), { recursive: true })
    writeFileSync(
      join(projectRoot, '.engrena', 'prompts', 'do-repo.prompt.md'),
      '---\ndescription: versionado\n---\nRode os testes'
    )
    const list = await call('GET', `/api/projects/${projectId}/prompts`)
    const fromFile = list.json.prompts.find((p: { name: string }) => p.name === 'do-repo')
    expect(fromFile.source).toBe('file')
    expect(fromFile.id).toBeNull()
    expect(fromFile.file).toBe('.engrena/prompts/do-repo.prompt.md')
  })

  it('nome do banco vence o mesmo nome em arquivo', async () => {
    mkdirSync(join(projectRoot, '.engrena', 'prompts'), { recursive: true })
    writeFileSync(join(projectRoot, '.engrena', 'prompts', 'igual.prompt.md'), 'do arquivo')
    await call('POST', `/api/projects/${projectId}/prompts`, { name: 'igual', body: 'do banco' })

    const list = await call('GET', `/api/projects/${projectId}/prompts`)
    const matches = list.json.prompts.filter((p: { name: string }) => p.name === 'igual')
    expect(matches).toHaveLength(1)
    expect(matches[0].body).toBe('do banco')
  })

  it('edita e apaga pelo id', async () => {
    const created = await call('POST', `/api/projects/${projectId}/prompts`, { name: 'revisao', body: 'x' })
    const id = created.json.prompt.id

    const updated = await call('PUT', `/api/prompts/${id}`, { body: 'novo corpo' })
    expect(updated.json.prompt.body).toBe('novo corpo')

    expect((await call('DELETE', `/api/prompts/${id}`)).status).toBe(200)
    expect((await call('DELETE', `/api/prompts/${id}`)).status).toBe(404)
  })
})

describe('modos', () => {
  it('cria com preset e lista', async () => {
    const created = await call('POST', `/api/projects/${projectId}/modes`, {
      name: 'arquiteto',
      model: 'haiku',
      accessLevel: 'supervised',
      instructions: 'Planeje antes.',
    })
    expect(created.status).toBe(201)

    const list = await call('GET', `/api/projects/${projectId}/modes`)
    expect(list.json.modes[0].model).toBe('haiku')
    expect(list.json.modes[0].source).toBe('db')
  })

  it('lista modo versionado no repo', async () => {
    mkdirSync(join(projectRoot, '.engrena', 'modes'), { recursive: true })
    writeFileSync(
      join(projectRoot, '.engrena', 'modes', 'revisor.chatmode.md'),
      '---\nmodel: haiku\naccess: supervised\n---\nSó revise, não edite.'
    )
    const list = await call('GET', `/api/projects/${projectId}/modes`)
    expect(list.json.modes[0]).toMatchObject({ name: 'revisor', model: 'haiku', source: 'file' })
  })

  it('edita e apaga pelo id', async () => {
    const created = await call('POST', `/api/projects/${projectId}/modes`, { name: 'rapido' })
    const id = created.json.mode.id
    expect((await call('PUT', `/api/modes/${id}`, { model: 'opus' })).json.mode.model).toBe('opus')
    expect((await call('DELETE', `/api/modes/${id}`)).status).toBe(200)
    expect((await call('GET', `/api/projects/${projectId}/modes`)).json.modes).toEqual([])
  })
})

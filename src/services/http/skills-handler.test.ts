import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'
import { EventEmitter } from 'events'

const SESSION_TOKEN = 'test-session-token'

vi.mock('../vault/vault-service.js', () => ({
  vaultService: {
    getSessionToken: () => SESSION_TOKEN,
  },
}))

const { skillsRepository } = await import('../db/repositories/skills')
const { handleSkillsRequest } = await import('./skills-handler')

let tmpDir: string
let prevUserData: string | undefined

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'engrenacode-skills-handler-'))
  prevUserData = process.env.ENGRENACODE_USER_DATA
  process.env.ENGRENACODE_USER_DATA = tmpDir
  skillsRepository._resetCache()
})

afterEach(() => {
  if (prevUserData === undefined) delete process.env.ENGRENACODE_USER_DATA
  else process.env.ENGRENACODE_USER_DATA = prevUserData
  rmSync(tmpDir, { recursive: true, force: true })
})

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

function fakeResponse(): ServerResponse & { statusCode: number; body: string; headersSent: boolean } {
  const res = {
    statusCode: 0,
    body: '',
    headersSent: false,
    writeHead(status: number) {
      res.statusCode = status
      res.headersSent = true
      return res
    },
    end(chunk?: string) {
      if (chunk !== undefined) res.body = chunk
    },
  } as unknown as ServerResponse & { statusCode: number; body: string; headersSent: boolean }
  return res
}

describe('handleSkillsRequest', () => {
  it('rejects unauthorized requests with 401', async () => {
    const req = fakeRequest('GET', '/api/skills', undefined, false)
    const res = fakeResponse()
    const handled = await handleSkillsRequest(req, res)
    expect(handled).toBe(true)
    expect(res.statusCode).toBe(401)
  })

  it('creates a skill and returns 201', async () => {
    const req = fakeRequest('POST', '/api/skills', {
      name: 'skill-a',
      description: 'desc',
      content: '# a',
    })
    const res = fakeResponse()
    await handleSkillsRequest(req, res)
    expect(res.statusCode).toBe(201)
    const parsed = JSON.parse(res.body)
    expect(parsed.skill.name).toBe('skill-a')
  })

  it('rejects_duplicate_name with 409', async () => {
    skillsRepository.create({ name: 'skill-dup', description: 'd', content: '# a' })
    const req = fakeRequest('POST', '/api/skills', { name: 'skill-dup', description: 'd', content: '# b' })
    const res = fakeResponse()
    await handleSkillsRequest(req, res)
    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).error.code).toBe('skill_name_conflict')
  })

  it('rejects_content_over_1mib with 400', async () => {
    const req = fakeRequest('POST', '/api/skills', {
      name: 'skill-big',
      description: 'd',
      content: 'a'.repeat(1_048_577),
    })
    const res = fakeResponse()
    await handleSkillsRequest(req, res)
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.code).toBe('too_long')
  })

  it('lists skills for a project', async () => {
    const skill = skillsRepository.create({ name: 'skill-link', description: 'd', content: '# a' })
    skillsRepository.linkSkill('proj-1', skill.id, { enabled: true, sortOrder: 0 })

    const req = fakeRequest('GET', '/api/projects/proj-1/skills')
    const res = fakeResponse()
    await handleSkillsRequest(req, res)
    expect(res.statusCode).toBe(200)
    const parsed = JSON.parse(res.body)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].linked).toBe(true)
  })
})

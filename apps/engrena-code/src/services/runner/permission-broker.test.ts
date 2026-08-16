import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ThreadAccessLevel } from '../db/repositories/threads.js'
import type { PermissionRequestInfo } from './gate.js'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_broker_'))

const { closeDb, getDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread, updateThread } = await import('../db/repositories/threads.js')
const { PERMISSION_BODY_MAX_BYTES } = await import('./buffer-cap.js')
const {
  clearAllGatesForTesting,
  hasOpenPermissionGate,
  listOpenPermissionGates,
  resolvePermissionGate,
} = await import('./gate.js')
const {
  clearAllowedToolsForThread,
  clearBrokerGrantsForThread,
  createPermissionServer,
  grantAlwaysAllowedTool,
  isToolAllowedForThread,
  rememberAllowedTool,
  wasToolGrantedByBroker,
} = await import('./permission-broker.js')

const fixtures: string[] = []

function seedThread(accessLevel: ThreadAccessLevel = 'supervised'): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_broker_proj_'))
  fixtures.push(dir)
  const project = createProject({ path: dir })
  return createThread({
    projectId: project.id,
    provider: 'claude',
    accessLevel,
    executionMode: 'main',
    state: 'running',
  }).id
}

function ask(
  server: { port: number; token: string },
  toolName: string,
  toolInput: unknown,
  token?: string
): Promise<Response> {
  return fetch(`http://127.0.0.1:${server.port}/permission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-permission-token': token ?? server.token },
    body: JSON.stringify({ toolName, toolInput }),
  })
}

/**
 * Sleep fixo aqui é flaky: o round-trip do hook agora inclui a escrita do gate no SQLite, que sob
 * carga passa fácil dos 20 ms que a versão em memória tolerava.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('condição não satisfeita a tempo')
    await new Promise((r) => setTimeout(r, 10))
  }
}

afterEach(() => {
  clearAllGatesForTesting()
})

afterAll(() => {
  closeDb()
  for (const dir of fixtures) rmSync(dir, { recursive: true, force: true })
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('createPermissionServer', () => {
  it('segura a resposta do /permission até o gate ser resolvido', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info))

    const requestPromise = ask(server, 'Write', { file_path: 'a.txt' })

    let settled = false
    void requestPromise.then(() => {
      settled = true
    })

    await waitFor(() => seen.length === 1)
    expect(settled).toBe(false)
    expect(seen[0].toolName).toBe('Write')
    expect(seen[0].threadId).toBe(threadId)
    expect(hasOpenPermissionGate(threadId)).toBe(true)

    expect(resolvePermissionGate(threadId, seen[0].requestId, true)).toEqual({ ok: true, toolName: 'Write' })

    const body = (await (await requestPromise).json()) as { allow: boolean }
    expect(body.allow).toBe(true)
    expect(hasOpenPermissionGate(threadId)).toBe(false)

    server.close()
  })

  it('recusa request com token errado', async () => {
    const threadId = seedThread()
    const server = await createPermissionServer(threadId)

    const res = await ask(server, 'Bash', {}, 'token-errado')
    expect(res.status).toBe(403)
    server.close()
  })

  it('responde allow:false quando o gate é negado', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info))

    const requestPromise = ask(server, 'Bash', { command: 'rm -rf /' })
    await waitFor(() => seen.length === 1)

    resolvePermissionGate(threadId, seen[0].requestId, false)
    expect(((await (await requestPromise).json()) as { allow: boolean }).allow).toBe(false)

    server.close()
  })

  it('auto-allow sem gate quando a política do nível já aprova (auto-accept-edits + Write)', async () => {
    const threadId = seedThread('auto-accept-edits')
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info))

    const res = await ask(server, 'Write', { file_path: 'a.txt' })
    expect(((await res.json()) as { allow: boolean }).allow).toBe(true)
    expect(seen).toEqual([])
    expect(hasOpenPermissionGate(threadId)).toBe(false)

    server.close()
  })

  it('fail-closed quando a thread some mid-turn (gate não persiste)', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info))

    getDb().prepare('DELETE FROM threads WHERE id = ?').run(threadId)

    const res = await ask(server, 'Bash', { command: 'ls' })
    expect(((await res.json()) as { allow: boolean }).allow).toBe(false)
    expect(seen).toEqual([])

    server.close()
  })
})

/**
 * R08: sem este registro, a negação nativa não distingue "o CLI negou sem consultar o broker" de
 * "o broker concedeu e outro hook `PreToolUse` negou depois", e a faixa afirmava sempre a primeira.
 */
describe('grants do broker (diagnóstico da negação nativa)', () => {
  it('registra o allow da política do nível', async () => {
    const threadId = seedThread('auto-accept-edits')
    const server = await createPermissionServer(threadId)

    expect(wasToolGrantedByBroker(threadId, 'Write')).toBe(false)
    await ask(server, 'Write', { file_path: 'a.txt' })
    expect(wasToolGrantedByBroker(threadId, 'Write')).toBe(true)

    server.close()
  }, 10000)

  it('registra a decisão do usuário no card e ignora a negação', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info))

    const allowed = ask(server, 'Bash', { command: 'ls' })
    await waitFor(() => seen.length === 1)
    resolvePermissionGate(threadId, seen[0].requestId, true)
    await allowed
    expect(wasToolGrantedByBroker(threadId, 'Bash')).toBe(true)

    const denied = ask(server, 'Write', { file_path: 'a.txt' })
    await waitFor(() => seen.length === 2)
    resolvePermissionGate(threadId, seen[1].requestId, false)
    await denied
    expect(wasToolGrantedByBroker(threadId, 'Write')).toBe(false)

    server.close()
  }, 10000)

  it('zera no turno seguinte: grant velho não explica negação nova', async () => {
    const threadId = seedThread('auto-accept-edits')
    const first = await createPermissionServer(threadId)
    await ask(first, 'Write', { file_path: 'a.txt' })
    expect(wasToolGrantedByBroker(threadId, 'Write')).toBe(true)
    first.close()

    const second = await createPermissionServer(threadId)
    expect(wasToolGrantedByBroker(threadId, 'Write')).toBe(false)
    second.close()
  }, 10000)

  it('clearBrokerGrantsForThread esquece a thread (DELETE)', async () => {
    const threadId = seedThread('auto-accept-edits')
    const server = await createPermissionServer(threadId)
    await ask(server, 'Write', { file_path: 'a.txt' })

    clearBrokerGrantsForThread(threadId)
    expect(wasToolGrantedByBroker(threadId, 'Write')).toBe(false)

    server.close()
  }, 10000)
})

describe('allowlist da thread ("Permitir todos")', () => {
  it('pula a UI no próximo tool call igual', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info))

    const first = ask(server, 'Bash', { command: 'ls' })
    await waitFor(() => seen.length === 1)
    expect(
      resolvePermissionGate(threadId, seen[0].requestId, true, {
        onGranted: ({ toolName }) => grantAlwaysAllowedTool(threadId, toolName, 'thread'),
      })
    ).toEqual({ ok: true, toolName: 'Bash' })
    await first

    const second = await ask(server, 'Bash', { command: 'pwd' })
    expect(((await second.json()) as { allow: boolean }).allow).toBe(true)
    expect(seen).toHaveLength(1)

    clearAllowedToolsForThread(threadId)
    server.close()
  })

  it('scope=project persiste em tool_allowlist e vale para outra thread do mesmo projeto', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_broker_proj_'))
    fixtures.push(dir)
    const project = createProject({ path: dir })
    const mk = (): string =>
      createThread({
        projectId: project.id,
        provider: 'claude',
        accessLevel: 'supervised',
        executionMode: 'main',
        state: 'running',
      }).id
    const first = mk()
    const second = mk()

    grantAlwaysAllowedTool(first, 'Bash', 'project')
    expect(isToolAllowedForThread(second, 'Bash')).toBe(true)
    // Escopo thread não vaza para a vizinha.
    rememberAllowedTool(first, 'WebFetch')
    expect(isToolAllowedForThread(second, 'WebFetch')).toBe(false)

    clearAllowedToolsForThread(first)
    clearAllowedToolsForThread(second)
  })
})

describe('POST /permission body cap (fail-closed)', () => {
  it(
    'nunca responde allow quando o corpo estoura o cap',
    async () => {
      const threadId = seedThread()
      const seen: PermissionRequestInfo[] = []
      const server = await createPermissionServer(threadId, (info) => seen.push(info))

      const huge = JSON.stringify({
        toolName: 'Write',
        toolInput: { content: 'x'.repeat(PERMISSION_BODY_MAX_BYTES + 4096) },
      })

      let allow: unknown = 'sem resposta'
      try {
        const res = await fetch(`http://127.0.0.1:${server.port}/permission`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
          body: huge,
        })
        allow = ((await res.json()) as { allow?: unknown }).allow
      } catch {
        // Conexão derrubada pelo cap também é fail-closed (o hook cai no deny).
        allow = 'conexão derrubada'
      }

      expect(allow).not.toBe(true)
      // Nenhum gate chega à UI — o body parcial não vira card `unknown`.
      expect(seen).toEqual([])
      expect(hasOpenPermissionGate(threadId)).toBe(false)

      server.close()
    },
    15_000
  )
})

describe('timeout fail-closed via broker', () => {
  it('auto-nega e assenta o HTTP do hook quando ninguém responde', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info), { timeoutMs: 400 })

    const requestPromise = ask(server, 'Bash', { command: 'sleep 999' })

    await waitFor(() => seen.length === 1)
    expect(hasOpenPermissionGate(threadId)).toBe(true)
    expect(listOpenPermissionGates(threadId)).toHaveLength(1)

    const body = (await (await requestPromise).json()) as { allow: boolean }
    expect(body.allow).toBe(false)
    expect(hasOpenPermissionGate(threadId)).toBe(false)
    expect(listOpenPermissionGates(threadId)).toEqual([])

    server.close()
  })
})

describe('isToolAllowedForThread', () => {
  it('é false para thread inexistente (nunca libera por omissão)', () => {
    expect(isToolAllowedForThread('thr_inexistente', 'Bash')).toBe(false)
  })

  it('sobrevive à troca de accessLevel da thread', () => {
    const threadId = seedThread()
    rememberAllowedTool(threadId, 'Bash')
    updateThread(threadId, { accessLevel: 'auto-accept-edits' })
    expect(isToolAllowedForThread(threadId, 'Bash')).toBe(true)
    clearAllowedToolsForThread(threadId)
    expect(isToolAllowedForThread(threadId, 'Bash')).toBe(false)
  })
})

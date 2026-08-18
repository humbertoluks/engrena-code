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
  expireOpenPermissionGates,
  GATE_REASON_THREAD_CANCELLED,
  hasOpenPermissionGate,
  listOpenPermissionGates,
  resolvePermissionGate,
} = await import('./gate.js')
const {
  brokerOutcomeForTool,
  clearAllowedToolsForThread,
  clearBrokerOutcomesForThread,
  createPermissionServer,
  grantAlwaysAllowedTool,
  hadOversizedPermissionRequest,
  isToolAllowedForThread,
  rememberAllowedTool,
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
  token?: string,
  toolUseId?: string
): Promise<Response> {
  return fetch(`http://127.0.0.1:${server.port}/permission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-permission-token': token ?? server.token },
    body: JSON.stringify({ toolName, toolInput, toolUseId }),
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
 * R09: com um booleano, "o usuário negou no card" também caía em "o broker nunca viu a tool".
 */
describe('decisões do broker (diagnóstico da negação nativa)', () => {
  it('registra o allow da política do nível', async () => {
    const threadId = seedThread('auto-accept-edits')
    const server = await createPermissionServer(threadId)

    expect(brokerOutcomeForTool(threadId, 'Write')).toBe('never-requested')
    await ask(server, 'Write', { file_path: 'a.txt' })
    expect(brokerOutcomeForTool(threadId, 'Write')).toBe('granted')

    server.close()
  }, 10000)

  it('registra a decisão do usuário no card, allow e deny', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info))

    const allowed = ask(server, 'Bash', { command: 'ls' })
    await waitFor(() => seen.length === 1)
    resolvePermissionGate(threadId, seen[0].requestId, true)
    await allowed
    expect(brokerOutcomeForTool(threadId, 'Bash')).toBe('granted')

    const denied = ask(server, 'Write', { file_path: 'a.txt' })
    await waitFor(() => seen.length === 2)
    resolvePermissionGate(threadId, seen[1].requestId, false)
    await denied
    expect(brokerOutcomeForTool(threadId, 'Write')).toBe('denied')

    server.close()
  }, 10000)

  // O defeito R09 em uma linha: negar no card, não responder e nunca ser perguntado precisam ser
  // três fatos distintos aqui, senão as duas superfícies acusam o CLI de ter negado sozinho.
  it('não colapsa a negação do usuário com o timeout nem com a tool que nunca passou pelo hook', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info), { timeoutMs: 60 })

    const denied = ask(server, 'Read', { file_path: 'a.txt' })
    await waitFor(() => seen.length === 1)
    resolvePermissionGate(threadId, seen[0].requestId, false)
    await denied

    // Sem resposta nenhuma: o fail-closed do gate fecha este sozinho.
    await ask(server, 'Bash', { command: 'ls' })

    expect(brokerOutcomeForTool(threadId, 'Read')).toBe('denied')
    expect(brokerOutcomeForTool(threadId, 'Bash')).toBe('expired')
    expect(brokerOutcomeForTool(threadId, 'WebFetch')).toBe('never-requested')

    server.close()
  }, 10000)

  // Parar com card aberto fechava o gate pelo mesmo caminho do timeout, e a copy mandava
  // "responder ao card enquanto ele estiver na tela" para quem tinha acabado de cancelar.
  it('separa o cancelamento do turno do pedido que ninguém respondeu', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info), { timeoutMs: 60 })

    const cancelled = ask(server, 'Bash', { command: 'ls' })
    await waitFor(() => seen.length === 1)
    expireOpenPermissionGates(threadId, GATE_REASON_THREAD_CANCELLED)
    await cancelled
    expect(brokerOutcomeForTool(threadId, 'Bash')).toBe('cancelled')

    // Sem ninguém responder nem cancelar: o fail-closed do gate fecha sozinho.
    await ask(server, 'Write', { file_path: 'a.txt' })
    expect(brokerOutcomeForTool(threadId, 'Write')).toBe('expired')

    server.close()
  }, 15000)

  // O tool_use_id é a chave que o CLI manda no PreToolUse e repete na negação. Com ele, duas
  // chamadas da mesma tool deixam de compartilhar a mesma entrada — o caso que produzia
  // `ambiguous` passa a ter resposta exata para cada chamada.
  it('atribui a decisão à chamada certa quando o tool_use_id vem nos dois lados', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info))

    const granted = ask(server, 'Bash', { command: 'ls' }, undefined, 'toolu_call_a')
    await waitFor(() => seen.length === 1)
    resolvePermissionGate(threadId, seen[0].requestId, true)
    await granted

    const denied = ask(server, 'Bash', { command: 'rm -rf /' }, undefined, 'toolu_call_b')
    await waitFor(() => seen.length === 2)
    resolvePermissionGate(threadId, seen[1].requestId, false)
    await denied

    expect(brokerOutcomeForTool(threadId, 'Bash', 'toolu_call_a')).toBe('granted')
    expect(brokerOutcomeForTool(threadId, 'Bash', 'toolu_call_b')).toBe('denied')
    // A chave agregada por nome continua ambígua, e é ela que responde sem id.
    expect(brokerOutcomeForTool(threadId, 'Bash')).toBe('ambiguous')

    server.close()
  }, 15000)

  it('cai para a chave por nome quando a negação chega com um id desconhecido', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info))

    const denied = ask(server, 'Read', { file_path: 'a.txt' }, undefined, 'toolu_known')
    await waitFor(() => seen.length === 1)
    resolvePermissionGate(threadId, seen[0].requestId, false)
    await denied

    // Id que o broker nunca viu (evento de outra chamada, ou host que só manda id de um lado).
    expect(brokerOutcomeForTool(threadId, 'Read', 'toolu_outro')).toBe('denied')
    expect(brokerOutcomeForTool(threadId, 'Read')).toBe('denied')

    server.close()
  }, 15000)

  // Granularidade é por tool, não por chamada: deixar a última decisão vencer em silêncio faria a
  // negação nativa afirmar a decisão da chamada errada.
  it('marca ambiguous quando a mesma tool é liberada numa chamada e negada em outra', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info))

    const first = ask(server, 'Bash', { command: 'ls' })
    await waitFor(() => seen.length === 1)
    resolvePermissionGate(threadId, seen[0].requestId, true)
    await first
    expect(brokerOutcomeForTool(threadId, 'Bash')).toBe('granted')

    const second = ask(server, 'Bash', { command: 'rm -rf /' })
    await waitFor(() => seen.length === 2)
    resolvePermissionGate(threadId, seen[1].requestId, false)
    await second
    expect(brokerOutcomeForTool(threadId, 'Bash')).toBe('ambiguous')

    // Uma vez ambíguo, decisão nova não "desempata": continua sem dar para saber qual chamada.
    const third = ask(server, 'Bash', { command: 'ls -la' })
    await waitFor(() => seen.length === 3)
    resolvePermissionGate(threadId, seen[2].requestId, true)
    await third
    expect(brokerOutcomeForTool(threadId, 'Bash')).toBe('ambiguous')

    server.close()
  }, 15000)

  it('mantém a decisão quando as chamadas concordam entre si', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info))

    const first = ask(server, 'Bash', { command: 'ls' })
    await waitFor(() => seen.length === 1)
    resolvePermissionGate(threadId, seen[0].requestId, false)
    await first

    const second = ask(server, 'Bash', { command: 'pwd' })
    await waitFor(() => seen.length === 2)
    resolvePermissionGate(threadId, seen[1].requestId, false)
    await second

    expect(brokerOutcomeForTool(threadId, 'Bash')).toBe('denied')

    server.close()
  }, 15000)

  // O 413 responde antes de existir toolName: sem esta marca por turno, a tool fica
  // indistinguível de "o CLI nunca consultou o broker".
  it('marca o turno quando um pedido é recusado por tamanho', async () => {
    const threadId = seedThread()
    const server = await createPermissionServer(threadId)
    expect(hadOversizedPermissionRequest(threadId)).toBe(false)

    const huge = 'x'.repeat(PERMISSION_BODY_MAX_BYTES + 1024)
    await ask(server, 'Bash', { command: huge }).catch(() => undefined)
    await waitFor(() => hadOversizedPermissionRequest(threadId))

    expect(hadOversizedPermissionRequest(threadId)).toBe(true)
    // Não há toolName para associar: a tool continua sem registro próprio.
    expect(brokerOutcomeForTool(threadId, 'Bash')).toBe('never-requested')

    clearBrokerOutcomesForThread(threadId)
    expect(hadOversizedPermissionRequest(threadId)).toBe(false)

    server.close()
  }, 15000)

  it('registra unavailable quando o gate não persiste (thread apagada mid-turn)', async () => {
    // Thread que não existe no SQLite: createThreadGate viola a FK, o gate nunca abre e o broker
    // nega sem chegar ao usuário. Nem decisão dele, nem do CLI.
    const threadId = 'thr_apagada_mid_turn'
    const server = await createPermissionServer(threadId)

    const res = await ask(server, 'Write', { file_path: 'a.txt' })
    expect(((await res.json()) as { allow: boolean }).allow).toBe(false)
    expect(brokerOutcomeForTool(threadId, 'Write')).toBe('unavailable')

    server.close()
  }, 10000)

  it('zera no turno seguinte: decisão velha não explica negação nova', async () => {
    const threadId = seedThread('auto-accept-edits')
    const first = await createPermissionServer(threadId)
    await ask(first, 'Write', { file_path: 'a.txt' })
    expect(brokerOutcomeForTool(threadId, 'Write')).toBe('granted')
    first.close()

    const second = await createPermissionServer(threadId)
    expect(brokerOutcomeForTool(threadId, 'Write')).toBe('never-requested')
    second.close()
  }, 10000)

  it('clearBrokerOutcomesForThread esquece a thread (DELETE)', async () => {
    const threadId = seedThread('auto-accept-edits')
    const server = await createPermissionServer(threadId)
    await ask(server, 'Write', { file_path: 'a.txt' })

    clearBrokerOutcomesForThread(threadId)
    expect(brokerOutcomeForTool(threadId, 'Write')).toBe('never-requested')

    server.close()
  }, 10000)
})

describe('allowlist da thread ("Permitir todos")', () => {
  it('pula a UI no próximo comando do mesmo verbo', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info))

    const first = ask(server, 'Bash', { command: 'git status' })
    await waitFor(() => seen.length === 1)
    expect(
      resolvePermissionGate(threadId, seen[0].requestId, true, {
        onGranted: ({ toolName, params }) => grantAlwaysAllowedTool(threadId, toolName, 'thread', params),
      })
    ).toEqual({ ok: true, toolName: 'Bash' })
    await first

    const second = await ask(server, 'Bash', { command: 'git log --oneline -1' })
    expect(((await second.json()) as { allow: boolean }).allow).toBe(true)
    expect(seen).toHaveLength(1)

    clearAllowedToolsForThread(threadId)
    server.close()
  })

  /**
   * O ganho sobre o modelo antigo, que gravava a chave `Bash`: liberar um `git status` liberava
   * `rm -rf` pelo resto da thread. Agora a chave é o verbo (`bash-command-scope.ts`), e o comando
   * diferente volta a abrir card.
   */
  it('conceder um verbo NÃO libera o resto do shell', async () => {
    const threadId = seedThread()
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer(threadId, (info) => seen.push(info))

    const first = ask(server, 'Bash', { command: 'git status' })
    await waitFor(() => seen.length === 1)
    resolvePermissionGate(threadId, seen[0].requestId, true, {
      onGranted: ({ toolName, params }) => grantAlwaysAllowedTool(threadId, toolName, 'thread', params),
    })
    await first

    // Abriu card: é isso que a allowlist antiga engolia em silêncio.
    const second = ask(server, 'Bash', { command: 'rm -rf build' })
    await waitFor(() => seen.length === 2)
    expect(seen[1].toolName).toBe('Bash')
    resolvePermissionGate(threadId, seen[1].requestId, false)
    expect(((await (await second).json()) as { allow: boolean }).allow).toBe(false)

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

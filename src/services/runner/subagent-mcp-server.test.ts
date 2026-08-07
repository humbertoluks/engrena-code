import { afterAll, describe, expect, it } from 'vitest'
import { spawn } from 'child_process'
import { createServer } from 'http'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createInterface } from 'readline'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f12_skill_mcp_'))

const { ensureSubagentMcpServerScript, buildEngrenaCodeMcpDef } = await import('./subagent-mcp-server.js')

afterAll(() => {
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

function startFakeDelegateServer(handler: (body: unknown) => { text: string; isError?: boolean }): Promise<{
  port: number
  token: string
  close: () => void
}> {
  const token = 'test-token-123'
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()))
    req.on('end', () => {
      const result = handler(JSON.parse(raw))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({ port, token, close: () => server.close() })
    })
  })
}

async function withMcpProcess<T>(
  args: string[],
  fn: (send: (msg: unknown) => void, nextResponse: () => Promise<Record<string, unknown>>) => Promise<T>
): Promise<T> {
  const scriptPath = ensureSubagentMcpServerScript()
  const child = spawn(process.execPath, [scriptPath, ...args])
  const rl = createInterface({ input: child.stdout })
  const pending: Array<(msg: Record<string, unknown>) => void> = []
  const buffered: Record<string, unknown>[] = []

  rl.on('line', (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const msg = JSON.parse(trimmed) as Record<string, unknown>
    const waiter = pending.shift()
    if (waiter) waiter(msg)
    else buffered.push(msg)
  })

  const send = (msg: unknown): void => {
    child.stdin.write(`${JSON.stringify(msg)}\n`)
  }
  const nextResponse = (): Promise<Record<string, unknown>> => {
    const buffered0 = buffered.shift()
    if (buffered0) return Promise.resolve(buffered0)
    return new Promise((resolve) => pending.push(resolve))
  }

  try {
    return await fn(send, nextResponse)
  } finally {
    child.kill()
  }
}

describe('engrenacode MCP (call_subagent + load_skill)', () => {
  it('lists and calls call_subagent over a real Node subprocess', async () => {
    const delegate = await startFakeDelegateServer((body) => {
      const req = body as { name: string; task: string }
      return { text: `ok: ${req.name} / ${req.task}` }
    })

    try {
      await withMcpProcess(['--port', String(delegate.port), '--token', delegate.token], async (send, nextResponse) => {
        send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
        const initResult = await nextResponse()
        expect((initResult.result as { serverInfo: { name: string } }).serverInfo.name).toBe('engrenacode')

        send({ jsonrpc: '2.0', method: 'notifications/initialized' })

        send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
        const listResult = await nextResponse()
        const tools = (listResult.result as { tools: Array<{ name: string }> }).tools
        expect(tools).toHaveLength(1)
        expect(tools[0]?.name).toBe('call_subagent')

        send({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'call_subagent', arguments: { name: 'revisor', task: 'revisa isso' } },
        })
        const callResult = await nextResponse()
        const result = callResult.result as { content: Array<{ type: string; text: string }>; isError: boolean }
        expect(result.isError).toBe(false)
        expect(result.content[0]?.text).toBe('ok: revisor / revisa isso')
      })
    } finally {
      delegate.close()
    }
  }, 15000)

  it('lists and calls load_skill from a frozen snapshot file', async () => {
    const snapshotPath = join(process.env.ENGRENACODE_USER_DATA as string, 'snap-test.json')
    writeFileSync(
      snapshotPath,
      JSON.stringify({ skills: { 'convencoes-de-commit': '# Convenções\n\nUse Conventional Commits.' } }),
      'utf-8'
    )

    await withMcpProcess(['--skills-snapshot', snapshotPath], async (send, nextResponse) => {
      send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
      await nextResponse()
      send({ jsonrpc: '2.0', method: 'notifications/initialized' })

      send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
      const listResult = await nextResponse()
      const tools = (listResult.result as { tools: Array<{ name: string }> }).tools
      expect(tools.map((t) => t.name)).toEqual(['load_skill'])

      send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'load_skill', arguments: { name: 'convencoes-de-commit' } },
      })
      const ok = await nextResponse()
      const okResult = ok.result as { content: Array<{ text: string }>; isError: boolean }
      expect(okResult.isError).toBe(false)
      expect(okResult.content[0]?.text).toContain('Conventional Commits')

      send({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'load_skill', arguments: { name: 'nao-existe' } },
      })
      const err = await nextResponse()
      const errResult = err.result as { content: Array<{ text: string }>; isError: boolean }
      expect(errResult.isError).toBe(true)
      expect(errResult.content[0]?.text).toBe('Skill não encontrada neste projeto')
    })
  }, 15000)

  it('exposes both tools when snapshot and delegate flags are set', async () => {
    const snapshotPath = join(process.env.ENGRENACODE_USER_DATA as string, 'snap-dual.json')
    writeFileSync(snapshotPath, JSON.stringify({ skills: { a: '# A' } }), 'utf-8')
    const delegate = await startFakeDelegateServer(() => ({ text: 'delegated' }))

    try {
      const def = buildEngrenaCodeMcpDef({
        skillsSnapshotPath: snapshotPath,
        port: delegate.port,
        token: delegate.token,
      })
      const scriptArgs = def.args?.slice(1) ?? []
      await withMcpProcess(scriptArgs, async (send, nextResponse) => {
        send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
        await nextResponse()
        send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
        const listResult = await nextResponse()
        const names = (listResult.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name)
        expect(names).toEqual(['load_skill', 'call_subagent'])
      })
    } finally {
      delegate.close()
    }
  }, 15000)

  it('surfaces isError from the delegation backend in the tool_result', async () => {
    const delegate = await startFakeDelegateServer(() => ({ text: 'bloqueado pelo gate', isError: true }))

    try {
      await withMcpProcess(['--port', String(delegate.port), '--token', delegate.token], async (send, nextResponse) => {
        send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'call_subagent', arguments: { name: 'x', task: 'y' } },
        })
        const callResult = await nextResponse()
        const result = callResult.result as { content: Array<{ text: string }>; isError: boolean }
        expect(result.isError).toBe(true)
        expect(result.content[0]?.text).toBe('bloqueado pelo gate')
      })
    } finally {
      delegate.close()
    }
  }, 15000)

  it('returns a JSON-RPC error for an unknown method (with id)', async () => {
    const delegate = await startFakeDelegateServer(() => ({ text: 'n/a' }))
    try {
      await withMcpProcess(['--port', String(delegate.port), '--token', delegate.token], async (send, nextResponse) => {
        send({ jsonrpc: '2.0', id: 9, method: 'resources/list', params: {} })
        const response = await nextResponse()
        expect((response.error as { code: number }).code).toBe(-32601)
      })
    } finally {
      delegate.close()
    }
  }, 15000)

  it('sets ELECTRON_RUN_AS_NODE=1 so the real Electron main process spawns the script as plain Node (F15)', () => {
    // command = process.execPath — no main process do Electron isso é o binário do Electron, não
    // um `node` puro. Sem essa env var o CLI spawna a GUI do Electron em vez do script MCP, e o
    // handshake stdio nunca acontece (achado real via smoke F15 — regressão silenciosa que este
    // teste sob Vitest/Node nunca teria pego, já que aqui `process.execPath` já é `node`).
    const def = buildEngrenaCodeMcpDef({ port: 1234, token: 'tok' })
    expect(def.env?.ELECTRON_RUN_AS_NODE).toBe('1')
  })
})

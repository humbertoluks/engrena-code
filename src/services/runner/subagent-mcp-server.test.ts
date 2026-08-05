import { afterAll, describe, expect, it } from 'vitest'
import { spawn } from 'child_process'
import { createServer } from 'http'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createInterface } from 'readline'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f11_subagent_mcp_'))

const { ensureSubagentMcpServerScript } = await import('./subagent-mcp-server.js')

afterAll(() => {
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

/** Sobe um servidor HTTP fake no lugar do `createDelegationServer` real de `delegate.ts`. */
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

/** Envia mensagens JSON-RPC via stdin do subprocesso real e coleta as respostas de stdout. */
async function withMcpProcess<T>(
  port: number,
  token: string,
  fn: (send: (msg: unknown) => void, nextResponse: () => Promise<Record<string, unknown>>) => Promise<T>
): Promise<T> {
  const scriptPath = ensureSubagentMcpServerScript()
  const child = spawn(process.execPath, [scriptPath, '--port', String(port), '--token', token])
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

describe('subagent-mcp-server.ts (protocolo stdio real, spec F11 §3.2)', () => {
  it('responds to initialize, tools/list and tools/call over a real Node subprocess', async () => {
    const delegate = await startFakeDelegateServer((body) => {
      const req = body as { name: string; task: string }
      return { text: `ok: ${req.name} / ${req.task}` }
    })

    try {
      await withMcpProcess(delegate.port, delegate.token, async (send, nextResponse) => {
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

  it('surfaces isError from the delegation backend in the tool_result', async () => {
    const delegate = await startFakeDelegateServer(() => ({ text: 'bloqueado pelo gate', isError: true }))

    try {
      await withMcpProcess(delegate.port, delegate.token, async (send, nextResponse) => {
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
      await withMcpProcess(delegate.port, delegate.token, async (send, nextResponse) => {
        send({ jsonrpc: '2.0', id: 9, method: 'resources/list', params: {} })
        const response = await nextResponse()
        expect((response.error as { code: number }).code).toBe(-32601)
      })
    } finally {
      delegate.close()
    }
  }, 15000)
})

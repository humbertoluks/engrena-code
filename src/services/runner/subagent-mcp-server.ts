import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { ResolvedMcpDef } from './mcp-secrets.js'

/** Nome do MCP interno — mesmo namespace já hardcoded em `subagent-registry.ts:CALL_SUBAGENT_TOOL_NAME`. */
export const SUBAGENT_MCP_NAME = 'engrenacode'
export const CALL_SUBAGENT_MCP_TOOL_NAME = 'call_subagent'

/**
 * Servidor MCP stdio mínimo (spec F11 §3.2/§4) — handshake newline-delimited JSON-RPC confirmado
 * contra a spec oficial do protocolo (Context7 `/modelcontextprotocol/modelcontextprotocol`).
 * Só implementa os 4 métodos necessários (`initialize`, `notifications/initialized`, `tools/list`,
 * `tools/call`); `tools/call` reenvia pro servidor de delegação loopback (`delegate.ts`,
 * `createDelegationServer`) via HTTP, autenticado por token de processo — mesmo padrão de
 * `mcp-secrets.ts:WRAPPER_SOURCE`. Sem dependência de SDK MCP (nenhuma outra parte do codebase
 * tem uma).
 */
const SCRIPT_SOURCE = `#!/usr/bin/env node
import { createInterface } from 'node:readline'

function flag(name) {
  const i = process.argv.indexOf(\`--\${name}\`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const port = flag('port')
const token = flag('token')

const TOOL_SCHEMA = {
  name: 'call_subagent',
  description: 'Delega uma tarefa a um subagent cadastrado e vinculado a este projeto.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nome do subagent cadastrado' },
      task: { type: 'string', description: 'Tarefa a delegar' },
      context: { type: 'string', description: 'Contexto adicional opcional' },
    },
    required: ['name', 'task'],
  },
}

function send(message) {
  process.stdout.write(\`\${JSON.stringify(message)}\\n\`)
}

async function handleToolsCall(id, params) {
  const args = (params && params.arguments) || {}
  try {
    const res = await fetch(\`http://127.0.0.1:\${port}/delegate\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-delegate-token': token },
      body: JSON.stringify({ name: args.name, task: args.task, context: args.context }),
    })
    const body = await res.json()
    send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: body.text }], isError: Boolean(body.isError) } })
  } catch (err) {
    const message = err && err.message ? err.message : String(err)
    send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: \`Falha ao delegar: \${message}\` }], isError: true } })
  }
}

const rl = createInterface({ input: process.stdin })
rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return

  let message
  try {
    message = JSON.parse(trimmed)
  } catch {
    return
  }

  const { id, method, params } = message

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'engrenacode', version: '1.0.0' },
      },
    })
    return
  }
  if (method === 'notifications/initialized') return
  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: [TOOL_SCHEMA] } })
    return
  }
  if (method === 'tools/call') {
    void handleToolsCall(id, params)
    return
  }
  if (id !== undefined) {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: \`Method not found: \${method}\` } })
  }
})
`

function resolveScriptDir(): string {
  const override = process.env.ENGRENACODE_USER_DATA
  const dir = override ?? app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Escreve o script do MCP interno (idempotente) — mesmo padrão de `mcp-secrets.ts:ensureWrapperScript`. */
export function ensureSubagentMcpServerScript(): string {
  const path = join(resolveScriptDir(), 'subagent-mcp-server.mjs')
  if (!existsSync(path) || readFileSync(path, 'utf-8') !== SCRIPT_SOURCE) {
    writeFileSync(path, SCRIPT_SOURCE, { mode: 0o600 })
  }
  return path
}

/** `ResolvedMcpDef` do MCP interno, apontando pro servidor de delegação loopback deste turno. */
export function buildSubagentMcpDef(port: number, token: string): ResolvedMcpDef {
  return {
    name: SUBAGENT_MCP_NAME,
    transport: 'stdio',
    command: process.execPath,
    args: [ensureSubagentMcpServerScript(), '--port', String(port), '--token', token],
  }
}

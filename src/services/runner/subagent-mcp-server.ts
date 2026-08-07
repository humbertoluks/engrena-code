import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { ResolvedMcpDef } from './mcp-secrets.js'

/** Nome do MCP interno — namespace de `mcp__engrenacode__*`. */
export const SUBAGENT_MCP_NAME = 'engrenacode'
export const CALL_SUBAGENT_MCP_TOOL_NAME = 'call_subagent'
export const LOAD_SKILL_MCP_TOOL_NAME = 'load_skill'

/**
 * Servidor MCP stdio mínimo (F11 call_subagent + F12 load_skill) — handshake newline-delimited
 * JSON-RPC. Tools expostas conforme flags:
 * - `--skills-snapshot <path>` → `load_skill`
 * - `--port` + `--token` → `call_subagent` (HTTP loopback de delegação)
 */
const SCRIPT_SOURCE = `#!/usr/bin/env node
import { createInterface } from 'node:readline'
import { readFileSync } from 'node:fs'

function flag(name) {
  const i = process.argv.indexOf(\`--\${name}\`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const port = flag('port')
const token = flag('token')
const skillsSnapshotPath = flag('skills-snapshot')

const CALL_SUBAGENT_SCHEMA = {
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

const LOAD_SKILL_SCHEMA = {
  name: 'load_skill',
  description: 'Carrega o conteúdo markdown de uma skill vinculada a este projeto (sob demanda).',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nome da skill no catálogo do turno' },
    },
    required: ['name'],
  },
}

function listTools() {
  const tools = []
  if (skillsSnapshotPath) tools.push(LOAD_SKILL_SCHEMA)
  if (port && token) tools.push(CALL_SUBAGENT_SCHEMA)
  return tools
}

function send(message) {
  process.stdout.write(\`\${JSON.stringify(message)}\\n\`)
}

function handleLoadSkill(id, params) {
  const args = (params && params.arguments) || {}
  const name = typeof args.name === 'string' ? args.name : ''
  try {
    const raw = readFileSync(skillsSnapshotPath, 'utf-8')
    const parsed = JSON.parse(raw)
    const skills = parsed && parsed.skills && typeof parsed.skills === 'object' ? parsed.skills : {}
    const content = name && Object.prototype.hasOwnProperty.call(skills, name) ? skills[name] : null
    if (content === null || content === undefined) {
      send({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: 'Skill não encontrada neste projeto' }], isError: true },
      })
      return
    }
    send({
      jsonrpc: '2.0',
      id,
      result: { content: [{ type: 'text', text: String(content) }], isError: false },
    })
  } catch (err) {
    const message = err && err.message ? err.message : String(err)
    send({
      jsonrpc: '2.0',
      id,
      result: { content: [{ type: 'text', text: \`Falha ao carregar skill: \${message}\` }], isError: true },
    })
  }
}

async function handleCallSubagent(id, params) {
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

async function handleToolsCall(id, params) {
  const toolName = params && params.name
  if (toolName === 'load_skill') {
    handleLoadSkill(id, params)
    return
  }
  if (toolName === 'call_subagent') {
    await handleCallSubagent(id, params)
    return
  }
  send({
    jsonrpc: '2.0',
    id,
    result: { content: [{ type: 'text', text: \`Tool desconhecida: \${toolName}\` }], isError: true },
  })
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
    send({ jsonrpc: '2.0', id, result: { tools: listTools() } })
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

/** Escreve o script do MCP interno (idempotente). */
export function ensureSubagentMcpServerScript(): string {
  const path = join(resolveScriptDir(), 'subagent-mcp-server.mjs')
  if (!existsSync(path) || readFileSync(path, 'utf-8') !== SCRIPT_SOURCE) {
    writeFileSync(path, SCRIPT_SOURCE, { mode: 0o600 })
  }
  return path
}

export interface EngrenaCodeMcpDefOptions {
  skillsSnapshotPath?: string
  port?: number
  token?: string
}

/**
 * `ResolvedMcpDef` do MCP interno `engrenacode`.
 * Exige ao menos skills snapshot **ou** par port/token de delegação.
 */
export function buildEngrenaCodeMcpDef(opts: EngrenaCodeMcpDefOptions): ResolvedMcpDef {
  const hasSkills = typeof opts.skillsSnapshotPath === 'string' && opts.skillsSnapshotPath.length > 0
  const hasDelegate = opts.port !== undefined && typeof opts.token === 'string' && opts.token.length > 0
  if (!hasSkills && !hasDelegate) {
    throw new Error('buildEngrenaCodeMcpDef: informe skillsSnapshotPath e/ou port+token')
  }

  const args = [ensureSubagentMcpServerScript()]
  if (hasSkills) {
    args.push('--skills-snapshot', opts.skillsSnapshotPath as string)
  }
  if (hasDelegate) {
    args.push('--port', String(opts.port), '--token', opts.token as string)
  }

  return {
    name: SUBAGENT_MCP_NAME,
    transport: 'stdio',
    command: process.execPath,
    args,
    // `process.execPath` no processo main é o binário do Electron, não um `node` puro — sem essa
    // env var o CLI spawna a GUI do Electron em vez do script MCP, e o handshake stdio nunca
    // acontece (achado real via smoke F15: `mcp__engrenacode__call_subagent` nunca aparecia pro
    // modelo, sem erro visível — o MCP falhava silenciosamente ao iniciar).
    env: { ELECTRON_RUN_AS_NODE: '1' },
  }
}

/** Compat F11: só call_subagent. */
export function buildSubagentMcpDef(port: number, token: string): ResolvedMcpDef {
  return buildEngrenaCodeMcpDef({ port, token })
}

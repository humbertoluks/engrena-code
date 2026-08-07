import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { ResolvedMcpDef } from './mcp-secrets.js'

/** Nome do MCP interno — namespace de `mcp__engrenacode__*`. */
export const SUBAGENT_MCP_NAME = 'engrenacode'
export const CALL_SUBAGENT_MCP_TOOL_NAME = 'call_subagent'
export const LOAD_SKILL_MCP_TOOL_NAME = 'load_skill'
export const REPO_GRAPH_FIND_DEFINITION = 'repo_graph_find_definition'
export const REPO_GRAPH_FIND_REFERENCES = 'repo_graph_find_references'
export const REPO_GRAPH_MODULE_DEPS = 'repo_graph_module_deps'

/**
 * Servidor MCP stdio mínimo (F11/F12/F19) — handshake newline-delimited JSON-RPC.
 * Tools conforme flags:
 * - `--skills-snapshot <path>` → `load_skill`
 * - `--port` + `--token` → `call_subagent`
 * - `--codegraph-index <path>` → `repo_graph_*`
 */
const SCRIPT_SOURCE = `#!/usr/bin/env node
import { createInterface } from 'node:readline'
import { readFileSync, existsSync } from 'node:fs'

function flag(name) {
  const i = process.argv.indexOf(\`--\${name}\`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const port = flag('port')
const token = flag('token')
const skillsSnapshotPath = flag('skills-snapshot')
const codegraphIndexPath = flag('codegraph-index')

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

const FIND_DEF_SCHEMA = {
  name: 'repo_graph_find_definition',
  description: 'Encontra a definição de um símbolo no índice CodeGraph do projeto.',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'Nome do símbolo' },
      hintFile: { type: 'string', description: 'Path relativo opcional para desambiguar' },
    },
    required: ['symbol'],
  },
}

const FIND_REFS_SCHEMA = {
  name: 'repo_graph_find_references',
  description: 'Lista usos conhecidos de um símbolo no índice CodeGraph.',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'Nome do símbolo' },
      hintFile: { type: 'string', description: 'Path relativo opcional para escopo' },
    },
    required: ['symbol'],
  },
}

const MODULE_DEPS_SCHEMA = {
  name: 'repo_graph_module_deps',
  description: 'Lista imports e importadores conhecidos de um módulo no índice CodeGraph.',
  inputSchema: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Path relativo do módulo' },
    },
    required: ['file'],
  },
}

function listTools() {
  const tools = []
  if (skillsSnapshotPath) tools.push(LOAD_SKILL_SCHEMA)
  if (port && token) tools.push(CALL_SUBAGENT_SCHEMA)
  if (codegraphIndexPath) {
    tools.push(FIND_DEF_SCHEMA, FIND_REFS_SCHEMA, MODULE_DEPS_SCHEMA)
  }
  return tools
}

function send(message) {
  process.stdout.write(\`\${JSON.stringify(message)}\\n\`)
}

function loadCodegraphIndex() {
  if (!codegraphIndexPath || !existsSync(codegraphIndexPath)) return null
  try {
    return JSON.parse(readFileSync(codegraphIndexPath, 'utf-8'))
  } catch {
    return null
  }
}

function normalizeHint(hint) {
  if (typeof hint !== 'string' || hint.trim() === '') return undefined
  return hint.split('\\\\').join('/')
}

function findDefinition(index, symbol, hintFile) {
  const hint = normalizeHint(hintFile)
  let defs = (index.symbols[symbol] || []).filter((h) => h.kind === 'definition')
  if (hint) {
    const scoped = defs.filter((h) => h.file === hint || h.file.endsWith('/' + hint))
    if (scoped.length > 0) defs = scoped
  }
  if (defs.length === 0) return 'Definition not found for symbol "' + symbol + '".'
  const lines = ['Definition: ' + symbol]
  for (const h of defs) {
    lines.push('- ' + h.file + ':' + h.line + ' (' + (h.symbolKind || 'definition') + ')')
    if (h.snippet) lines.push('  ' + h.snippet)
  }
  return lines.join('\\n')
}

function findReferences(index, symbol, hintFile) {
  const hint = normalizeHint(hintFile)
  let raw = index.symbols[symbol] || []
  if (hint) {
    const scoped = raw.filter((h) => h.file === hint || h.file.endsWith('/' + hint))
    if (scoped.length > 0) raw = scoped
  }
  let refs = raw.filter((h) => h.kind === 'reference')
  if (refs.length === 0) refs = raw.filter((h) => h.kind === 'definition').slice(1)
  if (refs.length === 0) return 'No references found for symbol "' + symbol + '".'
  const lines = ['References: ' + symbol + ' (' + refs.length + ')']
  for (const h of refs) lines.push('- ' + h.file + ':' + h.line + ' (' + h.kind + ')')
  return lines.join('\\n')
}

function moduleDeps(index, file) {
  const rel = normalizeHint(file) || file
  const entry = index.files[rel] || Object.entries(index.files).find(([p]) => p === rel || p.endsWith('/' + rel))?.[1]
  const imports = (entry && entry.imports) || []
  const importedBy = []
  for (const [path, fe] of Object.entries(index.files || {})) {
    if ((fe.imports || []).some((imp) => imp === rel || imp.endsWith('/' + rel) || imp === './' + rel)) {
      importedBy.push(path)
    }
  }
  const lines = ['Module deps: ' + rel, 'imports (' + imports.length + '):']
  for (const i of imports) lines.push('- ' + i)
  lines.push('importedBy (' + importedBy.length + '):')
  for (const i of importedBy) lines.push('- ' + i)
  return lines.join('\\n')
}

function handleCodegraphTool(id, toolName, params) {
  const args = (params && params.arguments) || {}
  const index = loadCodegraphIndex()
  if (!index) {
    send({
      jsonrpc: '2.0',
      id,
      result: { content: [{ type: 'text', text: 'CodeGraph index unavailable.' }], isError: false },
    })
    return
  }
  let text = ''
  if (toolName === 'repo_graph_find_definition') {
    text = findDefinition(index, typeof args.symbol === 'string' ? args.symbol : '', args.hintFile)
  } else if (toolName === 'repo_graph_find_references') {
    text = findReferences(index, typeof args.symbol === 'string' ? args.symbol : '', args.hintFile)
  } else if (toolName === 'repo_graph_module_deps') {
    text = moduleDeps(index, typeof args.file === 'string' ? args.file : '')
  }
  send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: false } })
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
  if (
    toolName === 'repo_graph_find_definition' ||
    toolName === 'repo_graph_find_references' ||
    toolName === 'repo_graph_module_deps'
  ) {
    handleCodegraphTool(id, toolName, params)
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
  codegraphIndexPath?: string
}

/**
 * `ResolvedMcpDef` do MCP interno `engrenacode`.
 * Exige ao menos skills snapshot, port/token de delegação, ou índice CodeGraph.
 */
export function buildEngrenaCodeMcpDef(opts: EngrenaCodeMcpDefOptions): ResolvedMcpDef {
  const hasSkills = typeof opts.skillsSnapshotPath === 'string' && opts.skillsSnapshotPath.length > 0
  const hasDelegate = opts.port !== undefined && typeof opts.token === 'string' && opts.token.length > 0
  const hasCodegraph = typeof opts.codegraphIndexPath === 'string' && opts.codegraphIndexPath.length > 0
  if (!hasSkills && !hasDelegate && !hasCodegraph) {
    throw new Error('buildEngrenaCodeMcpDef: informe skillsSnapshotPath, port+token e/ou codegraphIndexPath')
  }

  const args = [ensureSubagentMcpServerScript()]
  if (hasSkills) {
    args.push('--skills-snapshot', opts.skillsSnapshotPath as string)
  }
  if (hasDelegate) {
    args.push('--port', String(opts.port), '--token', opts.token as string)
  }
  if (hasCodegraph) {
    args.push('--codegraph-index', opts.codegraphIndexPath as string)
  }

  return {
    name: SUBAGENT_MCP_NAME,
    transport: 'stdio',
    command: process.execPath,
    args,
    env: { ELECTRON_RUN_AS_NODE: '1' },
  }
}

/** Compat F11: só call_subagent. */
export function buildSubagentMcpDef(port: number, token: string): ResolvedMcpDef {
  return buildEngrenaCodeMcpDef({ port, token })
}

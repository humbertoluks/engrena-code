import { randomBytes } from 'crypto'
import http from 'http'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { vaultService } from '../vault/vault-service.js'
import { getValidAccessToken } from '../mcps/oauth.js'
import type { Mcp } from '../db/repositories/mcps.js'
import type { ThreadProvider } from '../db/repositories/threads.js'

export type McpOmissionReason =
  | 'vault_locked'
  | 'missing_secret'
  | 'header_secret_ref'
  | 'server_dist_missing'
  | 'wrapper_unavailable'
  | 'oauth_unavailable'
  | 'codex_auth_required'
  | 'unsupported_transport'

export interface McpOmission {
  name: string
  reason: McpOmissionReason
}

export interface ResolvedMcpDef {
  name: string
  transport: 'stdio' | 'http' | 'sse'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

export interface PrepareMcpsResult {
  resolved: ResolvedMcpDef[]
  omitted: McpOmission[]
  /** Encerra o loopback de segredos aberto para esta preparação (chamar após o turno terminar). */
  cleanup: () => void
}

const OMISSION_ACTION: Record<McpOmissionReason, string> = {
  vault_locked: 'desbloqueie o cofre antes de iniciar outro turno',
  missing_secret: 'configure a credencial exigida na tela de MCPs',
  header_secret_ref: 'corrija a configuração de autenticação do MCP',
  server_dist_missing: 'recompile o servidor MCP instalado',
  wrapper_unavailable: 'recompile o wrapper seguro de MCPs',
  oauth_unavailable: 'reconecte via OAuth na tela de MCPs',
  codex_auth_required: 'configure OAuth para usar este MCP HTTP no Codex',
  unsupported_transport: 'use um transporte suportado pelo provider selecionado',
}

/** Mensagem de `mcp.notice` — mesmo template de docs/F09-mcps/copy.md `mcpsTurn.notice.*`. */
export function mcpOmissionMessage(name: string, reason: McpOmissionReason): string {
  return `MCP '${name}' fora deste turno: ${OMISSION_ACTION[reason]}.`
}

/** Providers que não sabem consumir `--mcp-config` (driver HTTP puro, sem CLI agentic). */
export const MCP_UNSUPPORTED_PROVIDERS: ReadonlySet<ThreadProvider> = new Set(['minimax'])

function resolveWrapperDir(): string {
  const override = process.env.ENGRENACODE_USER_DATA
  const dir = override ?? app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return dir
}

const WRAPPER_SOURCE = `#!/usr/bin/env node
import { spawn } from 'node:child_process'

function flag(name) {
  const i = process.argv.indexOf(\`--\${name}\`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const port = flag('port')
const token = flag('token')
const name = flag('name')
const command = flag('command')
const cmdArgs = JSON.parse(flag('args') ?? '[]')

const res = await fetch(\`http://127.0.0.1:\${port}/env/\${encodeURIComponent(name)}\`, {
  headers: { 'x-secret-token': token },
})

if (!res.ok) {
  process.stderr.write('engrenacode: falha ao obter segredo do MCP\\n')
  process.exit(1)
}

const { env } = await res.json()
const child = spawn(command, cmdArgs, { env: { ...process.env, ...env }, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 1))
child.on('error', () => process.exit(1))
`

/** Escreve o wrapper loopback (idempotente) — evita colocar segredos no argv/env do `--mcp-config` em disco. */
export function ensureWrapperScript(): string {
  const path = join(resolveWrapperDir(), 'mcp-secret-wrapper.mjs')
  if (!existsSync(path) || readFileSync(path, 'utf-8') !== WRAPPER_SOURCE) {
    writeFileSync(path, WRAPPER_SOURCE, { mode: 0o600 })
  }
  return path
}

async function createSecretServer(entries: Map<string, Record<string, string>>): Promise<{ port: number; token: string; close: () => void }> {
  const token = randomBytes(24).toString('hex')

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const match = /^\/env\/(.+)$/.exec(url.pathname)
    const providedToken = req.headers['x-secret-token']

    if (!match || providedToken !== token) {
      res.writeHead(403)
      res.end()
      return
    }

    const env = entries.get(decodeURIComponent(match[1]))
    if (env === undefined) {
      res.writeHead(404)
      res.end()
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ env }))
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  return { port, token, close: () => server.close() }
}

function resolveStdioEnv(mcp: Mcp): { env: Record<string, string>; missingSecret: boolean } {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(mcp.env)) {
    if (!value.startsWith('vault:')) {
      env[key] = value
      continue
    }
    const secretKey = value.slice('vault:'.length)
    const secret = vaultService.getSecret(`mcpSecrets:${secretKey}`)
    if (!secret) return { env, missingSecret: true }
    env[key] = secret
  }
  return { env, missingSecret: false }
}

/** Resolve MCPs vinculados em tools do driver ou motivo de omissão — nunca aborta o turno (spec §5.6/§7). */
export async function prepareMcpsForDispatch(mcps: Mcp[], opts: { provider: ThreadProvider }): Promise<PrepareMcpsResult> {
  const resolved: ResolvedMcpDef[] = []
  const omitted: McpOmission[] = []
  const wrapperEntries = new Map<string, Record<string, string>>()

  if (MCP_UNSUPPORTED_PROVIDERS.has(opts.provider)) {
    return { resolved: [], omitted: mcps.map((m) => ({ name: m.name, reason: 'unsupported_transport' as const })), cleanup: () => {} }
  }

  for (const mcp of mcps) {
    if (vaultService.isLocked()) {
      omitted.push({ name: mcp.name, reason: 'vault_locked' })
      continue
    }

    if (mcp.transport === 'stdio') {
      if (!mcp.command) {
        omitted.push({ name: mcp.name, reason: 'server_dist_missing' })
        continue
      }
      const { env, missingSecret } = resolveStdioEnv(mcp)
      if (missingSecret) {
        omitted.push({ name: mcp.name, reason: 'missing_secret' })
        continue
      }

      const hasSecretRef = Object.values(mcp.env).some((v) => v.startsWith('vault:'))
      if (!hasSecretRef) {
        resolved.push({ name: mcp.name, transport: 'stdio', command: mcp.command, args: mcp.args, env })
        continue
      }
      wrapperEntries.set(mcp.name, env)
      // command/args resolvidos depois de criar o servidor (precisa da porta/token) — placeholder substituído abaixo.
      resolved.push({ name: mcp.name, transport: 'stdio', command: '__WRAPPER__', args: [mcp.command, JSON.stringify(mcp.args)] })
      continue
    }

    // http / sse
    const hasHeaderSecretRef = Object.values(mcp.headers).some((v) => v.startsWith('vault:'))
    if (hasHeaderSecretRef) {
      omitted.push({ name: mcp.name, reason: 'header_secret_ref' })
      continue
    }

    if (opts.provider === 'codex' && mcp.authMode !== 'oauth') {
      omitted.push({ name: mcp.name, reason: 'codex_auth_required' })
      continue
    }

    if (mcp.authMode === 'oauth') {
      const token = await getValidAccessToken(mcp.id)
      if (!token) {
        omitted.push({ name: mcp.name, reason: 'oauth_unavailable' })
        continue
      }
      resolved.push({
        name: mcp.name,
        transport: mcp.transport,
        url: mcp.url ?? undefined,
        headers: { ...mcp.headers, Authorization: `Bearer ${token}` },
      })
      continue
    }

    resolved.push({ name: mcp.name, transport: mcp.transport, url: mcp.url ?? undefined, headers: mcp.headers })
  }

  if (wrapperEntries.size === 0) {
    return { resolved, omitted, cleanup: () => {} }
  }

  let wrapperPath: string
  try {
    wrapperPath = ensureWrapperScript()
  } catch {
    for (const def of resolved) {
      if (def.command === '__WRAPPER__') omitted.push({ name: def.name, reason: 'wrapper_unavailable' })
    }
    return { resolved: resolved.filter((d) => d.command !== '__WRAPPER__'), omitted, cleanup: () => {} }
  }

  const secretServer = await createSecretServer(wrapperEntries)
  const finalResolved = resolved.map((def) => {
    if (def.command !== '__WRAPPER__') return def
    const [realCommand, realArgsJson] = def.args as [string, string]
    return {
      name: def.name,
      transport: 'stdio' as const,
      command: process.execPath,
      args: [
        wrapperPath,
        '--port', String(secretServer.port),
        '--token', secretServer.token,
        '--name', def.name,
        '--command', realCommand,
        '--args', realArgsJson,
      ],
    }
  })

  return { resolved: finalResolved, omitted, cleanup: secretServer.close }
}

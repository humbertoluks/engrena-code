import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

/**
 * Hook `PreToolUse` do Claude CLI (spawnado via `--settings`, ver `cli-driver.ts`) — só existe
 * porque `--permission-mode default` exige aprovação interativa via stdin, que não existe no
 * spawn headless (`-p`). O hook substitui isso: lê `tool_name`/`tool_input` do stdin (contrato
 * documentado do PreToolUse), segura a decisão em `POST /permission` do `permission-broker.ts`
 * até a UI responder, e traduz pra `hookSpecificOutput.permissionDecision` (`allow` exit 0,
 * `deny` exit 2 — stdout/stderr conforme o contrato de hooks do Claude Code).
 * Falha de rede/parse fecha em `deny` (fail-closed), nunca deixa a tool passar sem decisão.
 */
const SCRIPT_SOURCE = `#!/usr/bin/env node
function flag(name) {
  const i = process.argv.indexOf(\`--\${name}\`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const port = flag('port')
const token = flag('token')

function allow() {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { permissionDecision: 'allow' } }))
  process.exit(0)
}

function deny(message) {
  process.stderr.write(
    JSON.stringify({ hookSpecificOutput: { permissionDecision: 'deny' }, systemMessage: message })
  )
  process.exit(2)
}

async function main() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  let input
  try {
    input = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
  } catch {
    deny('permission-hook: stdin inválido do Claude CLI.')
    return
  }

  if (!port || !token) {
    deny('permission-hook: broker de permissão indisponível (port/token ausentes).')
    return
  }

  try {
    const res = await fetch(\`http://127.0.0.1:\${port}/permission\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': token },
      body: JSON.stringify({ toolName: input.tool_name, toolInput: input.tool_input }),
    })
    const body = await res.json()
    if (body && body.allow === true) allow()
    else deny('Usuário negou a permissão.')
  } catch (err) {
    deny(\`permission-hook: falha ao consultar broker (\${err && err.message ? err.message : String(err)}).\`)
  }
}

void main()
`

function resolveScriptDir(): string {
  const override = process.env.ENGRENACODE_USER_DATA
  const dir = override ?? app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Escreve o script do hook (idempotente) — mesmo padrão de `ensureSubagentMcpServerScript`. */
export function ensurePermissionHookScript(): string {
  const path = join(resolveScriptDir(), 'permission-hook.mjs')
  if (!existsSync(path) || readFileSync(path, 'utf-8') !== SCRIPT_SOURCE) {
    writeFileSync(path, SCRIPT_SOURCE, { mode: 0o600 })
  }
  return path
}

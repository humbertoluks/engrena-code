import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import {
  PERMISSION_HOOK_LAUNCHER_NAME,
  PERMISSION_HOOK_SCRIPT_NAME,
} from './providers/permission-contract.js'

/**
 * Hook `PreToolUse` + `PermissionRequest` do Claude CLI (via `--settings`, ver `cli-driver.ts`).
 *
 * Em headless (`-p`), o CLI não tem TTY para aprovar tool. Duas portas:
 * - `PreToolUse` — decide com `permissionDecision` (allow/deny)
 * - `PermissionRequest` — decide com `decision.behavior` (allow/deny). Sem este hook, o CLI
 *   nega com "Claude requested permissions to write to X, but you haven't granted it yet"
 *   mesmo depois do PreToolUse permitir (visto no smoke Haiku 2026-08-12: Write→erro após
 *   aprovar pedido `unknown` no broker).
 *
 * `hookEventName` no output deve espelhar o evento do stdin — senão o CLI ignora a decisão.
 */

const SCRIPT_SOURCE = `#!/usr/bin/env node
function flag(name) {
  const i = process.argv.indexOf('--' + name)
  return i === -1 ? undefined : process.argv[i + 1]
}

const port = flag('port')
const token = flag('token')

function pickString(...candidates) {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() !== '') return c
  }
  return undefined
}

/** Quando o payload chega sem tool_name (stdin engolido no Windows / shape nova), infere pela input. */
function inferToolName(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return undefined
  const o = toolInput
  if (typeof o.command === 'string') return 'Bash'
  if (typeof o.file_path === 'string' || typeof o.filePath === 'string') {
    if (typeof o.old_string === 'string' || typeof o.oldString === 'string') return 'Edit'
    if (typeof o.content === 'string') return 'Write'
    return 'Write'
  }
  if (typeof o.pattern === 'string') return 'Glob'
  if (typeof o.query === 'string' || typeof o.regex === 'string') return 'Grep'
  return undefined
}

function decide(eventName, allow, reason) {
  if (eventName === 'PermissionRequest') {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: allow
            ? { behavior: 'allow' }
            : { behavior: 'deny', message: reason },
        },
      })
    )
  } else {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: allow ? 'allow' : 'deny',
          permissionDecisionReason: reason,
        },
      })
    )
  }
  process.exit(0)
}

async function main() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf-8')
  let input
  try {
    input = JSON.parse(raw || '{}')
  } catch {
    decide('PreToolUse', false, 'permission-hook: stdin inválido do Claude CLI.')
    return
  }

  const eventName =
    pickString(input.hook_event_name, input.hookEventName) === 'PermissionRequest'
      ? 'PermissionRequest'
      : 'PreToolUse'

  if (!port || !token) {
    decide(eventName, false, 'permission-hook: broker de permissão indisponível (port/token ausentes).')
    return
  }

  try {
    const toolInput = input.tool_input ?? input.toolInput ?? input.input ?? null
    const toolName =
      pickString(input.tool_name, input.toolName, input.tool, input.name) ||
      inferToolName(toolInput) ||
      'unknown'

    const res = await fetch('http://127.0.0.1:' + port + '/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': token },
      body: JSON.stringify({ toolName, toolInput }),
    })
    // Sem checar res.ok, um 403 (token errado) / 404 / 413 devolve corpo vazio, res.json() lança e
    // o deny sai com diagnóstico genérico de rede. Fail-closed com o status na mensagem.
    if (!res.ok) {
      decide(
        eventName,
        false,
        'permission-hook: broker recusou a consulta (HTTP ' + res.status + ').'
      )
      return
    }
    const body = await res.json()
    if (body && body.allow === true) {
      decide(eventName, true, 'Permissão concedida pelo usuário no EngrenaCode.')
    } else {
      decide(eventName, false, 'Usuário negou a permissão.')
    }
  } catch (err) {
    decide(
      eventName,
      false,
      'permission-hook: falha ao consultar broker (' +
        (err && err.message ? err.message : String(err)) +
        ').'
    )
  }
}

void main()
`

/** Launcher Windows: preserva stdin (cmd /c set VAR=…&& engolia o pipe em alguns hosts do CLI). */
const CMD_LAUNCHER_SOURCE = `@echo off
set ELECTRON_RUN_AS_NODE=1
{{EXE}} {{SCRIPT}} %*
`

function resolveScriptDir(): string {
  const override = process.env.ENGRENACODE_USER_DATA
  const dir = override ?? app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Escreve o script do hook (idempotente) — mesmo padrão de `ensureSubagentMcpServerScript`. */
export function ensurePermissionHookScript(): string {
  const path = join(resolveScriptDir(), PERMISSION_HOOK_SCRIPT_NAME)
  if (!existsSync(path) || readFileSync(path, 'utf-8') !== SCRIPT_SOURCE) {
    writeFileSync(path, SCRIPT_SOURCE, { mode: 0o600 })
  }
  return path
}

/**
 * No Windows devolve um `.cmd` que seta ELECTRON_RUN_AS_NODE e chama o `.mjs` com o mesmo
 * stdin/args. No Unix devolve o path do `.mjs` (o prefixo de env fica no comando do settings).
 */
export function ensurePermissionHookLauncher(): string {
  const scriptPath = ensurePermissionHookScript()
  if (process.platform !== 'win32') return scriptPath

  const exe = process.execPath
  const content = CMD_LAUNCHER_SOURCE.replace('{{EXE}}', JSON.stringify(exe)).replace(
    '{{SCRIPT}}',
    JSON.stringify(scriptPath)
  )
  const cmdPath = join(resolveScriptDir(), PERMISSION_HOOK_LAUNCHER_NAME)
  if (!existsSync(cmdPath) || readFileSync(cmdPath, 'utf-8') !== content) {
    writeFileSync(cmdPath, content, { mode: 0o700 })
  }
  return cmdPath
}

import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import path from 'path'
import fs from 'fs'
import type { IncomingMessage, ServerResponse } from 'http'
import { vaultService } from '../vault/vault-service.js'
import { validateGithubToken } from './github-token.js'
import { validateClaudeKey, validateCodexKey, validateMinimaxKey } from '../vault/provider-keys.js'
import type { ProviderKeyValidation } from '../vault/provider-keys.js'
import { runClaudeProbe } from './claude-probe.js'

const execAsync = promisify(exec)

const SESSION_HEADER = 'x-engrenacode-session'

export const DEFAULT_PROMPT =
  'Você é um agente de desenvolvimento no EngrenaCode. Ao executar tarefas:\n' +
  '• Analise o escopo antes de modificar arquivos\n' +
  '• Submeta alterações para revisão via diff — não aplique diretamente no disco\n' +
  '• Use subagents para subtarefas paralelas, skills para instruções especializadas e MCPs para ferramentas externas\n' +
  '• Documente decisões não-óbvias nos commits'

const IS_WIN = process.platform === 'win32'
const FIND_CMD = IS_WIN ? 'where' : 'which'

// ── Helpers ────────────────────────────────────────────────────────────────

function isAuthorized(req: IncomingMessage): boolean {
  const token = req.headers[SESSION_HEADER]
  if (typeof token !== 'string' || !token) return false
  const valid = vaultService.getSessionToken()
  return token === valid
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(json)
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function parseBody<T>(raw: string): T | null {
  try { return JSON.parse(raw) as T } catch { return null }
}

// ── CLI detection ───────────────────────────────────────────────────────────

export interface CLIStatus {
  installed: boolean
  loggedIn: boolean | null
  path?: string
}

async function detectCLIInstalled(name: string): Promise<{ installed: boolean; path?: string }> {
  try {
    const { stdout } = await execAsync(`${FIND_CMD} ${name}`, { timeout: 2000 })
    const cliPath = stdout.trim().split(/\r?\n/)[0].trim()
    return { installed: Boolean(cliPath), path: cliPath || undefined }
  } catch {
    return { installed: false }
  }
}

async function detectCLIFull(name: string): Promise<CLIStatus> {
  const base = await detectCLIInstalled(name)
  if (!base.installed) return { installed: false, loggedIn: false }

  let loggedIn = false

  if (name === 'claude') {
    loggedIn = fs.existsSync(path.join(os.homedir(), '.claude.json'))
  } else if (name === 'codex') {
    try {
      await execAsync('codex auth status', { timeout: 3000 })
      loggedIn = true
    } catch { loggedIn = false }
  } else if (name === 'kimi') {
    try {
      await execAsync('kimi auth status', { timeout: 3000 })
      loggedIn = true
    } catch { loggedIn = false }
  }

  return { installed: true, loggedIn, path: base.path }
}

// ── Handlers ────────────────────────────────────────────────────────────────

export interface ConfigStatus {
  claude: { mode: 'subscription' | 'api-key'; subscriptionOk: boolean }
  clis: { claude: CLIStatus; codex: CLIStatus; kimi: CLIStatus }
  prompt: { isDefault: boolean; isEmpty: boolean; currentText: string }
  github: { tokenPresent: boolean }
  keys: { claude: boolean; codex: boolean; minimax: boolean }
  providers: {
    claude: { available: boolean; reason?: string }
    codex: { available: boolean; reason?: string }
    kimi: { available: boolean; reason?: string }
    minimax: { available: boolean; reason?: string }
  }
}

/** Reunido para reuso por dashboard-handler.ts (F04) — mesmo shape de GET /api/config/status. */
export async function computeConfigStatus(): Promise<ConfigStatus> {
  const claudeMode = (vaultService.getSecret('claude:mode') ?? 'subscription') as 'subscription' | 'api-key'
  const claudeLoggedIn = fs.existsSync(path.join(os.homedir(), '.claude.json'))

  const promptStored = vaultService.getSecret('prompt:global')
  const isDefault = promptStored === undefined
  const isEmpty = promptStored === ''
  const currentText = isDefault ? DEFAULT_PROMPT : promptStored

  const githubToken = vaultService.getSecret('github:token')

  const keys = {
    claude: Boolean(vaultService.getSecret('keys:claude')),
    codex: Boolean(vaultService.getSecret('keys:codex')),
    minimax: Boolean(vaultService.getSecret('keys:minimax')),
  }

  // Fast PATH-only check for CLIs (login = null until Testar conexões)
  const [claudeCLI, codexCLI, kimiCLI] = await Promise.all([
    detectCLIInstalled('claude'),
    detectCLIInstalled('codex'),
    detectCLIInstalled('kimi'),
  ])

  const claudeAvailable = claudeMode === 'subscription' ? claudeLoggedIn : keys.claude
  const codexAvailable = codexCLI.installed || keys.codex

  const providers = {
    claude: claudeAvailable
      ? { available: true }
      : {
          available: false,
          reason:
            claudeMode === 'subscription'
              ? 'Assinatura selecionada, mas não detectei login do Claude Code. Rode `claude` no terminal para autenticar.'
              : 'Nenhuma key salva: os turnos vão falhar. Volte para Assinatura ou salve a key abaixo.',
        },
    codex: codexAvailable ? { available: true } : { available: false },
    kimi: kimiCLI.installed ? { available: true } : { available: false },
    minimax: keys.minimax
      ? { available: true }
      : { available: false, reason: 'Minimax sem key salva — configure em #configuracao.' },
  }

  return {
    claude: { mode: claudeMode, subscriptionOk: claudeLoggedIn },
    clis: {
      claude: { ...claudeCLI, loggedIn: claudeCLI.installed ? claudeLoggedIn : false },
      codex: { ...codexCLI, loggedIn: null },
      kimi: { ...kimiCLI, loggedIn: null },
    },
    prompt: { isDefault, isEmpty, currentText },
    github: { tokenPresent: Boolean(githubToken) },
    keys,
    providers,
  }
}

async function handleGetStatus(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: { code: 'unauthorized', message: 'Sessão inválida.' } })
  }

  sendJson(res, 200, await computeConfigStatus())
}

async function handleClaudeMode(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: { code: 'unauthorized', message: 'Sessão inválida.' } })
  }

  const data = parseBody<{ mode?: string }>(await readBody(req))
  if (!data || (data.mode !== 'subscription' && data.mode !== 'api-key')) {
    return sendJson(res, 400, { error: { code: 'validation_error', message: 'Modo inválido.' } })
  }

  if (data.mode === 'api-key' && !vaultService.getSecret('keys:claude')) {
    return sendJson(res, 400, {
      error: { code: 'validation_error', message: 'Salve uma key Claude abaixo para habilitar.' },
    })
  }

  vaultService.setSecret('claude:mode', data.mode)

  const subscriptionOk = data.mode === 'subscription'
    ? fs.existsSync(path.join(os.homedir(), '.claude.json'))
    : null

  sendJson(res, 200, { mode: data.mode, subscriptionOk })
}

async function handleClaudeTest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: { code: 'unauthorized', message: 'Sessão inválida.' } })
  }

  try {
    const mode = (vaultService.getSecret('claude:mode') ?? 'subscription') as 'subscription' | 'api-key'
    const apiKey = mode === 'api-key' ? vaultService.getSecret('keys:claude') : undefined
    const result = await runClaudeProbe(mode, apiKey)

    if (result.retryAfterSeconds !== undefined) {
      return sendJson(res, 429, result)
    }
    sendJson(res, 200, result)
  } catch {
    sendJson(res, 200, { success: false, detail: 'Não foi possível testar a conexão agora.' })
  }
}

async function handleClisTest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: { code: 'unauthorized', message: 'Sessão inválida.' } })
  }

  const [claudeCLI, codexCLI, kimiCLI] = await Promise.all([
    detectCLIFull('claude'),
    detectCLIFull('codex'),
    detectCLIFull('kimi'),
  ])

  const results = { claude: claudeCLI, codex: codexCLI, kimi: kimiCLI }
  const okCount = [claudeCLI, codexCLI, kimiCLI].filter((c) => c.loggedIn === true).length

  sendJson(res, 200, { results, summary: `Teste concluído: ${okCount}/3 CLIs logados.` })
}

async function handlePromptSave(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: { code: 'unauthorized', message: 'Sessão inválida.' } })
  }

  const data = parseBody<{ prompt?: string | null }>(await readBody(req))
  if (data === null) {
    return sendJson(res, 400, { error: { code: 'invalid_json', message: 'Corpo inválido.' } })
  }

  const promptValue = data.prompt ?? null

  if (typeof promptValue === 'string' && promptValue.length > 50000) {
    return sendJson(res, 400, { error: { code: 'too_long', message: 'Prompt muito longo (máx. 50.000 chars).' } })
  }

  if (promptValue === null) {
    vaultService.deleteSecret('prompt:global')
    return sendJson(res, 200, {
      isDefault: true,
      isEmpty: false,
      currentText: DEFAULT_PROMPT,
      message: 'Prompt global restaurado ao padrão do EngrenaCode.',
    })
  }

  vaultService.setSecret('prompt:global', promptValue)
  const isEmpty = promptValue === ''

  sendJson(res, 200, {
    isDefault: false,
    isEmpty,
    currentText: isEmpty ? '' : promptValue,
    message: isEmpty
      ? 'Prompt global desligado — nada será injetado nos turnos.'
      : 'Prompt global salvo. Vale a partir do próximo turno de qualquer provider.',
  })
}

async function handlePromptRestore(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: { code: 'unauthorized', message: 'Sessão inválida.' } })
  }

  vaultService.deleteSecret('prompt:global')

  sendJson(res, 200, {
    isDefault: true,
    isEmpty: false,
    currentText: DEFAULT_PROMPT,
    message: 'Prompt global restaurado ao padrão do EngrenaCode.',
  })
}

async function handleGithubToken(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: { code: 'unauthorized', message: 'Sessão inválida.' } })
  }

  const data = parseBody<{ token?: string }>(await readBody(req))
  if (data === null) {
    return sendJson(res, 400, { error: { code: 'invalid_json', message: 'Corpo inválido.' } })
  }

  const token = data.token ?? ''
  const validated = validateGithubToken(token)

  if (!validated.ok) {
    return sendJson(res, 400, { error: { code: 'validation_error', message: validated.message } })
  }

  if (validated.action === 'clear') {
    vaultService.deleteSecret('github:token')
    return sendJson(res, 200, { saved: true, message: 'Token removido.' })
  }

  vaultService.setSecret('github:token', validated.token)
  sendJson(res, 200, { saved: true, message: 'Token salvo localmente (não validado com o GitHub).' })
}

async function handleKeysSave(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: { code: 'unauthorized', message: 'Sessão inválida.' } })
  }

  const data = parseBody<{ claude?: string; codex?: string; minimax?: string }>(await readBody(req))
  if (data === null) {
    return sendJson(res, 400, { error: { code: 'invalid_json', message: 'Corpo inválido.' } })
  }

  const fields: Array<{ name: 'claude' | 'codex' | 'minimax'; value?: string; validate: (key: string) => ProviderKeyValidation }> = [
    { name: 'claude', value: data.claude, validate: validateClaudeKey },
    { name: 'codex', value: data.codex, validate: validateCodexKey },
    { name: 'minimax', value: data.minimax, validate: validateMinimaxKey },
  ]

  const details: Record<string, string> = {}
  const toApply: Array<{ name: 'claude' | 'codex' | 'minimax'; validation: Extract<ProviderKeyValidation, { ok: true }> }> = []

  for (const field of fields) {
    if (field.value === undefined) continue
    const validation = field.validate(field.value)
    if (!validation.ok) {
      details[field.name] = validation.message
      continue
    }
    toApply.push({ name: field.name, validation })
  }

  if (Object.keys(details).length > 0) {
    return sendJson(res, 400, {
      error: { code: 'validation_error', message: 'Algum campo tem formato inválido. Revise e tente novamente.', details },
    })
  }

  for (const { name, validation } of toApply) {
    if (validation.action === 'skip') continue
    vaultService.setSecret(`keys:${name}`, validation.key)
  }

  sendJson(res, 200, {
    saved: true,
    keys: {
      claude: Boolean(vaultService.getSecret('keys:claude')),
      codex: Boolean(vaultService.getSecret('keys:codex')),
      minimax: Boolean(vaultService.getSecret('keys:minimax')),
    },
    message: 'Chaves salvas localmente (não validadas com o provider).',
  })
}

// ── Router ──────────────────────────────────────────────────────────────────

export async function handleConfigRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url ?? ''
  const method = req.method ?? ''

  try {
    if (method === 'GET' && url === '/api/config/status') {
      await handleGetStatus(req, res)
      return true
    }
    if (method === 'POST' && url === '/api/config/claude/mode') {
      await handleClaudeMode(req, res)
      return true
    }
    if (method === 'POST' && url === '/api/config/claude/test') {
      await handleClaudeTest(req, res)
      return true
    }
    if (method === 'POST' && url === '/api/config/clis/test') {
      await handleClisTest(req, res)
      return true
    }
    if (method === 'POST' && url === '/api/config/prompt/save') {
      await handlePromptSave(req, res)
      return true
    }
    if (method === 'POST' && url === '/api/config/prompt/restore') {
      await handlePromptRestore(req, res)
      return true
    }
    if (method === 'POST' && url === '/api/config/github/token') {
      await handleGithubToken(req, res)
      return true
    }
    if (method === 'POST' && url === '/api/config/keys/save') {
      await handleKeysSave(req, res)
      return true
    }
  } catch (err) {
    console.error('[config-handler] Unhandled error:', err)
    if (!res.headersSent) {
      sendJson(res, 500, { error: { code: 'internal_error', message: 'Erro interno.' } })
    }
    return true
  }

  return false
}

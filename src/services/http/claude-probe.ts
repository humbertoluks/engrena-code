import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'

const execFileAsync = promisify(execFile)

export type ClaudeAuthMode = 'subscription' | 'api-key'

export interface ClaudeProbeResult {
  success: boolean
  detail: string
  retryAfterSeconds?: number
}

const PROBE_TIMEOUT_MS = 45_000
const PROBE_PROMPT = 'Responda apenas com a palavra: pong'

/** Injetável para testes — produção usa `execFile` real (spawna o binário `claude`). */
type ExecFileAsync = typeof execFileAsync
let execFileImpl: ExecFileAsync = execFileAsync
export function setExecFileForTesting(fn: ExecFileAsync): void {
  execFileImpl = fn
}
export function resetExecFileForTesting(): void {
  execFileImpl = execFileAsync
}

function detectSubscription(): boolean {
  return fs.existsSync(path.join(os.homedir(), '.claude.json'))
}

let subscriptionDetectedImpl: () => boolean = detectSubscription
export function setSubscriptionDetectedForTesting(fn: () => boolean): void {
  subscriptionDetectedImpl = fn
}
export function resetSubscriptionDetectedForTesting(): void {
  subscriptionDetectedImpl = detectSubscription
}

function isRateLimit(text: string): boolean {
  return /rate.?limit/i.test(text) || /\b429\b/.test(text)
}

interface ExecError {
  killed?: boolean
  signal?: string | null
  message?: string
  stderr?: string
  stdout?: string
}

function handleProbeError(err: unknown, mode: ClaudeAuthMode): ClaudeProbeResult {
  const execErr = err as ExecError
  const combined = `${execErr.message ?? ''} ${execErr.stderr ?? ''} ${execErr.stdout ?? ''}`

  if (execErr.killed === true || execErr.signal === 'SIGTERM') {
    return { success: false, detail: 'Tempo esgotado ao testar a conexao.' }
  }
  if (isRateLimit(combined)) {
    return {
      success: false,
      retryAfterSeconds: 60,
      detail:
        'Limite de uso da Anthropic (rate limit) — a credencial está válida, mas o limite impede o teste agora; tente de novo em alguns minutos.',
    }
  }
  return {
    success: false,
    detail: mode === 'subscription' ? '✗ Assinatura nao respondeu.' : '✗ API key nao respondeu.',
  }
}

/** "Testar conexão" do card Autenticação do Claude — reusa o mecanismo de spawn do CLI (sem dependência nova de SDK). */
export async function runClaudeProbe(mode: ClaudeAuthMode, apiKey?: string): Promise<ClaudeProbeResult> {
  if (mode === 'subscription') {
    if (!subscriptionDetectedImpl()) {
      return {
        success: false,
        detail:
          'Assinatura selecionada, mas não detectei login do Claude Code. Rode `claude` no terminal para autenticar.',
      }
    }

    try {
      await execFileImpl('claude', ['--version'], { timeout: PROBE_TIMEOUT_MS })
      return { success: true, detail: '✓ Assinatura (Claude Code) respondeu — conectado.' }
    } catch (err: unknown) {
      return handleProbeError(err, 'subscription')
    }
  }

  if (!apiKey) {
    return {
      success: false,
      detail: 'Nenhuma key salva: os turnos vão falhar. Volte para Assinatura ou salve a key abaixo.',
    }
  }

  try {
    await execFileImpl('claude', ['-p', PROBE_PROMPT, '--output-format', 'stream-json', '--verbose'], {
      timeout: PROBE_TIMEOUT_MS,
      env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
    })
    return { success: true, detail: '✓ API key respondeu — conectado (cobrando a API).' }
  } catch (err: unknown) {
    return handleProbeError(err, 'api-key')
  }
}

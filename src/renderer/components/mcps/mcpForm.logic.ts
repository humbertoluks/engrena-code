import type { McpTransport } from '../../services/mcps-service'

export const RESERVED_MCP_NAME = 'engrenacode'
const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/

export function isValidMcpName(name: string): boolean {
  return NAME_RE.test(name) && name !== RESERVED_MCP_NAME
}

export function parseArgsLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

export interface EnvParseResult {
  env: Record<string, string>
  errors: string[]
}

/** `KEY=VALUE` por linha — `vault:<chave>` é permitido em env (secret ref), spec §5.1. */
export function parseEnvLines(text: string): EnvParseResult {
  const env: Record<string, string> = {}
  const errors: string[] = []

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '') continue
    const eq = line.indexOf('=')
    if (eq <= 0) {
      errors.push(`Linha inválida (esperado KEY=VALUE): "${line}"`)
      continue
    }
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      errors.push(`Chave de env inválida: "${key}"`)
      continue
    }
    env[key] = value
  }

  return { env, errors }
}

export interface HeadersParseResult {
  headers: Record<string, string>
  errors: string[]
}

/** `Nome: valor` por linha — `vault:` é rejeitado (segredo só é suportado via env/stdio, spec §5.1). */
export function parseHeadersLines(text: string): HeadersParseResult {
  const headers: Record<string, string> = {}
  const errors: string[] = []

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '') continue
    const colon = line.indexOf(':')
    if (colon <= 0) {
      errors.push(`Linha inválida (esperado "Nome: valor"): "${line}"`)
      continue
    }
    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim()
    if (value.startsWith('vault:')) {
      errors.push(`Header secreto não é suportado no v1 (${key}): vault:<chave> só vale em env.`)
      continue
    }
    headers[key] = value
  }

  return { headers, errors }
}

export interface McpFormValues {
  name: string
  transport: McpTransport
  command: string
  url: string
  envErrors: string[]
  headerErrors: string[]
}

export function canSubmitMcpForm(values: McpFormValues, saving: boolean): boolean {
  if (saving) return false
  if (!isValidMcpName(values.name)) return false
  if (values.envErrors.length > 0 || values.headerErrors.length > 0) return false
  if (values.transport === 'stdio') return values.command.trim() !== ''
  return values.url.trim() !== ''
}

export function envToLines(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
}

export function headersToLines(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

/** Refs `vault:<chave>` presentes no env — usado para mostrar a seção "Segredos do cofre". */
export function extractSecretRefs(env: Record<string, string>): string[] {
  return Object.values(env)
    .filter((v) => v.startsWith('vault:'))
    .map((v) => v.slice('vault:'.length))
}

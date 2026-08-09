/**
 * Allowlist mínima de env pro shell do terminal dock (spec F26 §3.2) — herdar `process.env`
 * inteiro exporia keys de provider / tokens do host ao shell interativo do usuário.
 */
const ALLOWED_PTY_ENV_KEYS = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'TERM',
  'LANG',
  'LC_ALL',
  'SystemRoot',
  'COMSPEC',
] as const

export function buildPtyEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const key of ALLOWED_PTY_ENV_KEYS) {
    const value = source[key]
    if (value !== undefined) env[key] = value
  }
  return env
}

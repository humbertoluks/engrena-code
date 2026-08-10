export const GITHUB_PREFIXES = ['ghp_', 'github_pat_', 'gho_', 'ghu_', 'ghs_', 'ghr_'] as const

export type GithubTokenValidation =
  | { ok: true; action: 'clear' }
  | { ok: true; action: 'save'; token: string }
  | { ok: false; message: string }

/** Local PAT format checks (no remote ping). Empty string means clear/remove. */
export function validateGithubToken(token: string): GithubTokenValidation {
  if (token === '') {
    return { ok: true, action: 'clear' }
  }

  if (/\s/.test(token)) {
    return { ok: false, message: 'A chave não pode conter espaços.' }
  }

  if (token.length < 8) {
    return { ok: false, message: 'Chave muito curta para ser válida.' }
  }

  if (!GITHUB_PREFIXES.some((p) => token.startsWith(p))) {
    return { ok: false, message: 'Formato inválido. Esperado: ghp_… ou github_pat_…' }
  }

  return { ok: true, action: 'save', token }
}

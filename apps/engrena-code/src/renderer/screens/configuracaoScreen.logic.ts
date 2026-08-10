import {
  validateClaudeKey,
  validateCodexKey,
  validateMinimaxKey,
  validateGlmKey,
  validateGrokKey,
  validateOpenaiKey,
  validateGroqKey,
  type ProviderKeyValidation,
} from '../../services/vault/provider-keys.js'
import { validateGithubToken, type GithubTokenValidation } from '../../services/http/github-token.js'

/** Adapta o retorno tipado do validador servidor (`{ ok, message? }`) pra UX local (`string | null`). */
function toLocal(v: ProviderKeyValidation | GithubTokenValidation): string | null {
  return v.ok ? null : v.message
}

export function validateClaudeKeyLocal(v: string): string | null {
  return toLocal(validateClaudeKey(v))
}

export function validateCodexKeyLocal(v: string): string | null {
  return toLocal(validateCodexKey(v))
}

export function validateMinimaxKeyLocal(v: string): string | null {
  return toLocal(validateMinimaxKey(v))
}

export function validateGlmKeyLocal(v: string): string | null {
  return toLocal(validateGlmKey(v))
}

export function validateGrokKeyLocal(v: string): string | null {
  return toLocal(validateGrokKey(v))
}

export function validateOpenaiKeyLocal(v: string): string | null {
  return toLocal(validateOpenaiKey(v))
}

export function validateGroqKeyLocal(v: string): string | null {
  return toLocal(validateGroqKey(v))
}

export function validateGithubTokenLocal(token: string): string | null {
  return toLocal(validateGithubToken(token))
}

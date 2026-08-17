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

/**
 * Quando oferecer o "Remover token" do GitHub: sempre que houver token guardado, e só então.
 *
 * A remoção sempre existiu no backend — salvar o campo vazio apaga o segredo e responde "Token
 * removido." — mas isso não estava dito em lugar nenhum da tela: quem quisesse revogar o token não
 * tinha como descobrir a via.
 *
 * A primeira versão desta regra também escondia o botão enquanto houvesse rascunho digitado, para
 * ele não ser lido como "descartar o que acabei de escrever". O smoke mostrou o efeito colateral:
 * o campo **mantém** o texto depois de salvar, então o botão sumia exatamente depois de configurar
 * o token, que é quando alguém pensa em removê-lo. Depender só do que está guardado é previsível;
 * o que o botão faz está no rótulo e na confirmação.
 */
export function shouldOfferGithubTokenRemoval(tokenPresent: boolean): boolean {
  return tokenPresent
}

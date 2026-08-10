import type { ProviderTurnInput, ProviderTurnResult, ProviderUsage } from './provider-types.js'
import { ProviderError } from './provider-types.js'

/**
 * Endpoint/payload da BigModel (Zhipu AI) Chat Completions API — pesquisa pública, sem doc oficial
 * confirmada em ambiente com acesso à conta (docs/F23-providers-glm-grok/spec.md §3.3, mesma
 * ressalva de confiança que `minimax-driver.ts` já assume). Formato OpenAI-compatible.
 */
const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const GLM_MODEL_DEFAULT = 'glm-4-plus'
const PROBE_PROMPT = 'Responda apenas com a palavra: pong'

interface GlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GlmResponse {
  choices?: Array<{ message?: { content?: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

function extractUsage(payload: GlmResponse): ProviderUsage | undefined {
  const usage = payload.usage
  if (!usage || typeof usage.prompt_tokens !== 'number' || typeof usage.completion_tokens !== 'number') {
    return undefined
  }
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    cacheReadTokens: null,
    cacheCreationTokens: null,
  }
}

export type FetchFn = typeof fetch
let fetchImpl: FetchFn = fetch
export function setFetchForTesting(fn: FetchFn): void {
  fetchImpl = fn
}
export function resetFetchForTesting(): void {
  fetchImpl = fetch
}

function buildMessages(input: ProviderTurnInput): GlmMessage[] {
  const messages: GlmMessage[] = []
  if (input.systemPrompt) messages.push({ role: 'system', content: input.systemPrompt })
  messages.push({ role: 'user', content: input.prompt })
  return messages
}

/** Turno via HTTP para o GLM (sem CLI, mesmo modelo de `minimax-driver.ts`). Texto-only — sem loop de tool_use. */
export async function runHttpTurn(input: ProviderTurnInput): Promise<ProviderTurnResult> {
  if (!input.apiKey) {
    throw new ProviderError('provider_key_missing', 'Nenhuma key do GLM salva no cofre.')
  }
  if (input.images && input.images.length > 0) {
    throw new ProviderError('image_not_supported', 'O GLM não aceita anexos de imagem (provider text-only).')
  }

  let res: Response
  try {
    res = await fetchImpl(GLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model ?? GLM_MODEL_DEFAULT,
        messages: buildMessages(input),
        stream: false,
      }),
      signal: input.signal,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao chamar o GLM.'
    throw new ProviderError('provider_network_error', `Falha de rede ao chamar o GLM: ${message}`)
  }

  if (res.status === 401 || res.status === 403) {
    throw new ProviderError('provider_auth_error', `GLM rejeitou a key (${res.status} ${res.statusText}).`)
  }
  if (!res.ok) {
    throw new ProviderError('provider_turn_error', `GLM respondeu ${res.status} ${res.statusText}.`)
  }

  let payload: GlmResponse
  try {
    payload = (await res.json()) as GlmResponse
  } catch {
    throw new ProviderError('provider_turn_error', 'Resposta inválida do GLM (JSON malformado).')
  }

  const text = payload.choices?.[0]?.message?.content
  if (typeof text !== 'string') {
    throw new ProviderError('provider_turn_error', 'Resposta do GLM sem conteúdo de texto.')
  }

  input.onEvent({ type: 'text-delta', text })
  return { text, usage: extractUsage(payload) }
}

export interface TestConnectionResult {
  success: boolean
  detail: string
}

/**
 * "Testar conexão" do card GLM (`docs/F23-providers-glm-grok/spec.md` §3.2) — chama `runHttpTurn`
 * internamente com um prompt mínimo de sondagem, mesmo texto de `claude-probe.ts`. Sempre lê a key
 * já persistida no vault (nunca o draft ainda não salvo do formulário).
 */
export async function testConnection(apiKey: string | undefined): Promise<TestConnectionResult> {
  if (!apiKey) {
    return { success: false, detail: 'Nenhuma key do GLM salva. Salve uma key abaixo antes de testar.' }
  }

  try {
    await runHttpTurn({
      provider: 'glm',
      cwd: '.',
      prompt: PROBE_PROMPT,
      accessLevel: 'supervised',
      apiKey,
      onEvent: () => {},
    })
    return { success: true, detail: '✓ GLM respondeu — conectado (cobrando a API).' }
  } catch (err: unknown) {
    if (err instanceof ProviderError && err.code === 'provider_auth_error') {
      return { success: false, detail: 'Key do GLM inválida ou rejeitada pelo provider.' }
    }
    if (err instanceof ProviderError && err.code === 'provider_network_error') {
      return {
        success: false,
        detail: 'Falha de rede ao testar a conexão com o GLM. Verifique sua internet e tente novamente.',
      }
    }
    const message = err instanceof Error ? err.message : 'Erro desconhecido.'
    return { success: false, detail: `Não foi possível testar a conexão com o GLM: ${message}` }
  }
}

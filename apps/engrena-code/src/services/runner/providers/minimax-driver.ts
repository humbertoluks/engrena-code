import type { ProviderTurnInput, ProviderTurnResult, ProviderUsage } from './provider-types.js'
import { ProviderError } from './provider-types.js'

/**
 * Endpoint/payload da Minimax Chat Completion API — a confirmar contra a doc oficial
 * durante o rollout (docs/F10-api-keys-providers/spec.md § Assumptions). Formato assumido
 * aqui é o padrão "chat completions" (messages[] com role/content, choices[0].message.content).
 */
const MINIMAX_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2'
const MINIMAX_MODEL_DEFAULT = 'abab6.5s-chat'

interface MinimaxMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface MinimaxResponse {
  choices?: Array<{ message?: { content?: string } }>
  base_resp?: { status_code?: number; status_msg?: string }
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

/**
 * Formato OpenAI-compat assumido (`prompt_tokens`/`completion_tokens`) — sem doc oficial Minimax
 * confirmada neste ambiente (mesma ressalva de docs/F10-api-keys-providers/spec.md §3.3). Sem
 * `cache_read`/`cache_creation` na Chat Completion API — sempre `null`. Sem custo reportado pelo
 * SDK — `costUsd` do turno Minimax é sempre `undefined` (cost_source='table').
 */
function extractUsage(payload: MinimaxResponse): ProviderUsage | undefined {
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

function buildMessages(input: ProviderTurnInput): MinimaxMessage[] {
  const messages: MinimaxMessage[] = []
  if (input.systemPrompt) messages.push({ role: 'system', content: input.systemPrompt })
  messages.push({ role: 'user', content: input.prompt })
  return messages
}

/** Turno via HTTP para providers sem CLI (Minimax). Texto-only nesta fase — sem loop de tool_use. */
export async function runHttpTurn(input: ProviderTurnInput): Promise<ProviderTurnResult> {
  if (!input.apiKey) {
    throw new ProviderError('provider_key_missing', 'Nenhuma key da Minimax salva no cofre.')
  }
  if (input.images && input.images.length > 0) {
    throw new ProviderError('image_not_supported', 'A Minimax não aceita anexos de imagem (provider text-only).')
  }

  let res: Response
  try {
    res = await fetchImpl(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model ?? MINIMAX_MODEL_DEFAULT,
        messages: buildMessages(input),
        stream: false,
      }),
      signal: input.signal,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao chamar a Minimax.'
    throw new ProviderError('provider_network_error', `Falha de rede ao chamar a Minimax: ${message}`)
  }

  if (!res.ok) {
    throw new ProviderError('provider_turn_error', `Minimax respondeu ${res.status} ${res.statusText}.`)
  }

  let payload: MinimaxResponse
  try {
    payload = (await res.json()) as MinimaxResponse
  } catch {
    throw new ProviderError('provider_turn_error', 'Resposta inválida da Minimax (JSON malformado).')
  }

  if (payload.base_resp && payload.base_resp.status_code !== undefined && payload.base_resp.status_code !== 0) {
    throw new ProviderError(
      'provider_turn_error',
      payload.base_resp.status_msg ?? `Minimax retornou status ${payload.base_resp.status_code}.`
    )
  }

  const text = payload.choices?.[0]?.message?.content
  if (typeof text !== 'string') {
    throw new ProviderError('provider_turn_error', 'Resposta da Minimax sem conteúdo de texto.')
  }

  input.onEvent({ type: 'text-delta', text })
  return { text, usage: extractUsage(payload) }
}

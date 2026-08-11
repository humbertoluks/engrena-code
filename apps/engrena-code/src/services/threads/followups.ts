import type { ThreadProvider } from '../db/repositories/threads.js'
import { runCliTurn as defaultRunCliTurn } from '../runner/providers/cli-driver.js'

/**
 * Sugestões de follow-up ao fim do turno — equivalente ao `IChatFollowup` do chat do VS Code
 * (`chat/browser/widget/input/chatFollowups.ts`).
 *
 * Geração one-shot fora do turno, como `git-textgen.ts`: sem MCP, sem lease de agente e sem
 * escrita no repositório. Falha é silenciosa: sugestão é conforto, não pode quebrar a conversa.
 */

export const MAX_FOLLOWUPS = 3
export const MAX_FOLLOWUP_CHARS = 80

export interface FollowupInput {
  provider: ThreadProvider
  model?: string | null
  apiKey?: string
  cwd: string
  lastUserMessage: string
  lastAssistantMessage: string
}

export type RunCliTurn = typeof defaultRunCliTurn
let runCliTurnImpl: RunCliTurn = defaultRunCliTurn
export function setRunCliTurnForTesting(fn: RunCliTurn): void {
  runCliTurnImpl = fn
}
export function resetRunCliTurnForTesting(): void {
  runCliTurnImpl = defaultRunCliTurn
}

export function buildFollowupPrompt(lastUserMessage: string, lastAssistantMessage: string): string {
  return [
    'Você sugere próximos passos curtos para o usuário de uma IDE de desenvolvimento, a partir do último turno de uma conversa.',
    `Responda APENAS com um array JSON de até ${MAX_FOLLOWUPS} strings, sem markdown e sem explicação.`,
    `Cada string é uma frase curta em português do Brasil (até ${MAX_FOLLOWUP_CHARS} caracteres), escrita como pedido do usuário ao agente ("Rode os testes", "Explique o erro do build").`,
    'Sugira apenas o que faz sentido como próximo passo real; se não houver nada útil, responda [].',
    `Última mensagem do usuário:\n${lastUserMessage.slice(0, 2000)}`,
    `Última resposta do agente:\n${lastAssistantMessage.slice(0, 4000)}`,
  ].join('\n\n')
}

/** Aceita array cru ou cercado em bloco de código; qualquer outra coisa vira lista vazia. */
export function parseFollowups(text: string): string[] {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  const match = stripped.match(/\[[\s\S]*\]/)
  if (!match) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const seen = new Set<string>()
  const out: string[] = []
  for (const item of parsed) {
    if (typeof item !== 'string') continue
    const value = item.trim().replace(/\s+/g, ' ').slice(0, MAX_FOLLOWUP_CHARS)
    if (value === '' || seen.has(value.toLowerCase())) continue
    seen.add(value.toLowerCase())
    out.push(value)
    if (out.length === MAX_FOLLOWUPS) break
  }
  return out
}

export async function generateFollowups(input: FollowupInput): Promise<string[]> {
  if (input.lastAssistantMessage.trim() === '') return []
  try {
    const result = await runCliTurnImpl({
      provider: input.provider,
      cwd: input.cwd,
      prompt: buildFollowupPrompt(input.lastUserMessage, input.lastAssistantMessage),
      model: input.model ?? undefined,
      accessLevel: 'supervised',
      apiKey: input.apiKey,
      onEvent: () => {},
    })
    return parseFollowups(result.text ?? '')
  } catch {
    return []
  }
}

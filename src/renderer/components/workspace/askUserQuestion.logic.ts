import type { ToolCall } from '../../services/threads-service'

/** Fonte: `src/services/runner/ask-user-question.ts` — não importável no renderer (módulo server-only). */
export const ASK_USER_QUESTION_TOOL_NAME = 'mcp__engrenacode__ask_user_question'

export interface PendingAskUserQuestion {
  toolCallId: string
  prompt: string
  options: string[]
  multiSelect: boolean
}

/**
 * Deriva a pergunta pendente do `tool_call` mais recente `ask_user_question` ainda em
 * `running` (spec F21 §4) — só relevante quando `selectedThread.state === 'waiting_user'`.
 */
export function findPendingAskUserQuestion(toolCalls: ToolCall[]): PendingAskUserQuestion | null {
  for (let i = toolCalls.length - 1; i >= 0; i--) {
    const call = toolCalls[i]
    if (call.name !== ASK_USER_QUESTION_TOOL_NAME || call.status !== 'running') continue

    const params = (call.params ?? {}) as { prompt?: unknown; options?: unknown; multiSelect?: unknown }
    return {
      toolCallId: call.id,
      prompt: typeof params.prompt === 'string' ? params.prompt : '',
      options: Array.isArray(params.options) ? params.options.filter((o): o is string => typeof o === 'string') : [],
      multiSelect: params.multiSelect === true,
    }
  }
  return null
}

/** Mesmo bloqueio client-side do `POST /answer` (spec F21 §5.2) — ao menos uma opção ou texto livre não-vazio. */
export function validateAnswer(selectedOptions: string[], freeText: string): boolean {
  return selectedOptions.length > 0 || freeText.trim() !== ''
}

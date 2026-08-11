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

/**
 * Escolha única e sem texto livre digitado: o clique na opção já é a resposta inteira, então
 * enviar é um passo só — o mesmo que os botões de decisão do fallback fazem. Com múltipla escolha
 * (o usuário ainda vai marcar outras) ou com texto livre em andamento (que se perderia), o envio
 * continua no botão.
 */
export function submitsOnOptionClick(multiSelect: boolean, freeText: string): boolean {
  return !multiSelect && freeText.trim() === ''
}

/** Copy de erro do envio de resposta (F21 `copy.md` — `askQuestion.error.*`). */
export const ANSWER_ERROR_COPY = {
  generic: 'Não foi possível enviar a resposta. Tente novamente.',
  notWaiting: 'Esta pergunta não está mais pendente.',
} as const

/**
 * Os dois 409 de `POST /answer` que significam "a pergunta já foi embora": `thread_not_waiting`
 * (thread saiu de `waiting_user`) e `no_pending_question` (thread ainda no estado, mas o turno que
 * segurava a pergunta morreu). Ambos são definitivos, então não podem cair no `generic` — o "Tente
 * novamente" dele manda o usuário repetir algo que nunca vai funcionar.
 */
const STALE_QUESTION_CODES = new Set(['thread_not_waiting', 'no_pending_question'])

export function answerErrorMessage(code: string | undefined): string {
  return code !== undefined && STALE_QUESTION_CODES.has(code)
    ? ANSWER_ERROR_COPY.notWaiting
    : ANSWER_ERROR_COPY.generic
}

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
      options: Array.isArray(params.options)
        ? params.options.filter((o): o is string => typeof o === 'string')
        : [],
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
 * @deprecated O card não envia mais no clique — só preenche o composer. Mantido para testes antigos.
 */
export function fillsComposerOnOptionClick(multiSelect: boolean, _freeText = ''): boolean {
  void multiSelect
  void _freeText
  return true
}

/** @deprecated use fillsComposerOnOptionClick */
export function submitsOnOptionClick(multiSelect: boolean, freeText: string): boolean {
  return fillsComposerOnOptionClick(multiSelect, freeText)
}

/**
 * Texto do composer principal → corpo de `POST /answer` enquanto `waiting_user`.
 * Casa opção única; em multi, aceita lista separada por vírgula casando cada pedaço com uma opção.
 * Senão, freeText.
 */
export function composerAnswerForQuestion(
  text: string,
  options: string[],
  multiSelect = false
): { selectedOptions: string[]; freeText: string | null } {
  const trimmed = text.trim()
  if (trimmed === '') return { selectedOptions: [], freeText: null }

  const hit = options.find((o) => o.localeCompare(trimmed, undefined, { sensitivity: 'accent' }) === 0)
  if (hit !== undefined) return { selectedOptions: [hit], freeText: null }

  if (multiSelect && trimmed.includes(',')) {
    const parts = trimmed
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p !== '')
    const selected: string[] = []
    for (const part of parts) {
      const match = options.find((o) => o.localeCompare(part, undefined, { sensitivity: 'accent' }) === 0)
      if (match !== undefined && !selected.includes(match)) selected.push(match)
    }
    if (selected.length === parts.length && selected.length > 0) {
      return { selectedOptions: selected, freeText: null }
    }
  }

  return { selectedOptions: [], freeText: trimmed }
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

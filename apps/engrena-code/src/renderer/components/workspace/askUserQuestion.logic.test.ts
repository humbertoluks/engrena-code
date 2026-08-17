import { describe, expect, it } from 'vitest'
import {
  ANSWER_ERROR_COPY,
  ASK_USER_QUESTION_TOOL_NAME,
  answerErrorMessage,
  composerAnswerForQuestion,
  findPendingAskUserQuestion,
  fillsComposerOnOptionClick,
  validateAnswer,
} from './askUserQuestion.logic'
import type { ToolCall } from '../../services/threads-service'

function makeToolCall(overrides: Partial<ToolCall>): ToolCall {
  return {
    id: 'tool_1',
    threadId: 'thr_1',
    messageId: null,
    name: ASK_USER_QUESTION_TOOL_NAME,
    params: null,
    status: 'running',
    result: null,
    seq: 0,
    startedAt: Date.now(),
    endedAt: null,
    ...overrides,
  }
}

describe('validateAnswer', () => {
  it('test_validateAnswer_blocks_empty — blocks when there is no option and no free text', () => {
    expect(validateAnswer([], '')).toBe(false)
    expect(validateAnswer([], '   ')).toBe(false)
  })

  it('test_validateAnswer_accepts_freeText_only — accepts free text alone', () => {
    expect(validateAnswer([], 'texto livre')).toBe(true)
  })

  it('accepts a selected option alone', () => {
    expect(validateAnswer(['A'], '')).toBe(true)
  })
})

describe('findPendingAskUserQuestion', () => {
  it('returns null when there is no ask_user_question tool call', () => {
    expect(findPendingAskUserQuestion([makeToolCall({ name: 'Read', status: 'running' })])).toBeNull()
  })

  it('returns null when the ask_user_question tool call already ended', () => {
    expect(findPendingAskUserQuestion([makeToolCall({ status: 'completed' })])).toBeNull()
  })

  it('extracts prompt/options/multiSelect from the most recent pending tool call', () => {
    const toolCalls = [
      makeToolCall({ id: 'tool_old', status: 'completed', params: { prompt: 'antiga', options: ['X'] } }),
      makeToolCall({
        id: 'tool_new',
        status: 'running',
        params: { prompt: 'Qual caminho seguir?', options: ['Big bang', 'Incremental'], multiSelect: true },
      }),
    ]

    expect(findPendingAskUserQuestion(toolCalls)).toEqual({
      toolCallId: 'tool_new',
      prompt: 'Qual caminho seguir?',
      options: ['Big bang', 'Incremental'],
      multiSelect: true,
    })
  })

  it('defaults multiSelect to false and options to an empty array when absent', () => {
    const toolCalls = [makeToolCall({ params: { prompt: 'Confirma?' } })]
    expect(findPendingAskUserQuestion(toolCalls)).toEqual({
      toolCallId: 'tool_1',
      prompt: 'Confirma?',
      options: [],
      multiSelect: false,
    })
  })
})

describe('answerErrorMessage', () => {
  it('treats no_pending_question as a stale question, not a retryable failure', () => {
    expect(answerErrorMessage('no_pending_question')).toBe(ANSWER_ERROR_COPY.notWaiting)
  })

  it('treats thread_not_waiting as a stale question', () => {
    expect(answerErrorMessage('thread_not_waiting')).toBe(ANSWER_ERROR_COPY.notWaiting)
  })

  it('falls back to the retryable message for unknown codes and for network failures', () => {
    expect(answerErrorMessage('internal_error')).toBe(ANSWER_ERROR_COPY.generic)
    expect(answerErrorMessage(undefined)).toBe(ANSWER_ERROR_COPY.generic)
  })
})

describe('fillsComposerOnOptionClick', () => {
  it('sempre preenche o composer — o card não tem mais Enviar próprio', () => {
    expect(fillsComposerOnOptionClick(false)).toBe(true)
    expect(fillsComposerOnOptionClick(true)).toBe(true)
  })
})

describe('composerAnswerForQuestion', () => {
  it('casa opção exata como selectedOptions', () => {
    expect(composerAnswerForQuestion('Big bang', ['Big bang', 'Incremental'])).toEqual({
      selectedOptions: ['Big bang'],
      freeText: null,
    })
  })

  it('texto livre vira freeText quando não casa opção', () => {
    expect(composerAnswerForQuestion('outra via', ['Big bang', 'Incremental'])).toEqual({
      selectedOptions: [],
      freeText: 'outra via',
    })
  })

  it('multi: lista separada por vírgula casa cada opção', () => {
    expect(
      composerAnswerForQuestion('Big bang, Incremental', ['Big bang', 'Incremental'], true)
    ).toEqual({
      selectedOptions: ['Big bang', 'Incremental'],
      freeText: null,
    })
  })
})

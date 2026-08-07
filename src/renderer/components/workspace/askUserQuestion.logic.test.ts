import { describe, expect, it } from 'vitest'
import { ASK_USER_QUESTION_TOOL_NAME, findPendingAskUserQuestion, validateAnswer } from './askUserQuestion.logic'
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

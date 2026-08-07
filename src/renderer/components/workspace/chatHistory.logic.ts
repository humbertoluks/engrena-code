import type { ToolCall } from '../../services/threads-service'
import type { SubagentRun } from '../../services/subagents-service'

/** Fonte: `src/services/runner/subagent-registry.ts` (CALL_SUBAGENT_TOOL_NAME) — não importável no renderer (módulo server-only). */
export const CALL_SUBAGENT_TOOL_NAME = 'mcp__engrenacode__call_subagent'

/**
 * Casa cada tool call `call_subagent` do pai com o `subagent_runs` correspondente (spec F15 §3.2):
 * primeiro por `parentToolCallId`; o que sobrar casa por ordem FIFO.
 */
export function correlateSubagentRuns(toolCalls: ToolCall[], runs: SubagentRun[]): Map<string, SubagentRun> {
  const byToolCallId = new Map<string, SubagentRun>()
  const unmatchedRuns: SubagentRun[] = []
  for (const run of runs) {
    if (run.parentToolCallId) byToolCallId.set(run.parentToolCallId, run)
    else unmatchedRuns.push(run)
  }

  const unmatchedToolCalls = toolCalls.filter((t) => t.name === CALL_SUBAGENT_TOOL_NAME && !byToolCallId.has(t.id))
  for (let i = 0; i < unmatchedToolCalls.length && i < unmatchedRuns.length; i++) {
    byToolCallId.set(unmatchedToolCalls[i].id, unmatchedRuns[i])
  }
  return byToolCallId
}

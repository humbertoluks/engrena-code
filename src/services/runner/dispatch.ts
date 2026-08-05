import { getDb } from '../db/client.js'
import { getProject, type Project } from '../db/repositories/projects.js'
import {
  createThread,
  getThread,
  updateThread,
  type Thread,
  type ThreadAccessLevel,
  type ThreadExecutionMode,
  type ThreadProvider,
} from '../db/repositories/threads.js'
import { appendMessage, createToolCall, updateToolCall } from '../db/repositories/messages.js'
import { createDiff } from '../db/repositories/diffs.js'
import { diffWorkingTree } from '../git/git-client.js'
import { acquireLease, releaseLease } from './project-execution.js'
import { emit } from './ws-hub.js'
import { createSkillSnapshot } from './skill-registry.js'
import { RuleRegistry } from './rule-registry.js'
import { createSubagentsRepository } from '../db/repositories/subagents.js'
import { CALL_SUBAGENT_TOOL_NAME, resolveSubagentCatalog } from './subagent-registry.js'
import { canDelegateSubagent, type ParentAccessLevel, type ParentProvider } from './subagent-caller-gate.js'
import { McpRegistry } from './mcp-registry.js'
import { mcpOmissionMessage, prepareMcpsForDispatch } from './mcp-secrets.js'
import { vaultService } from '../vault/vault-service.js'
import { DEFAULT_PROMPT } from '../http/config-handler.js'
import { runCliTurn as defaultRunCliTurn, ProviderError, type ProviderTurnInput } from './providers/cli-driver.js'

export class DispatchValidationError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export interface DispatchNewThreadInput {
  projectId: string
  prompt: string
  provider: ThreadProvider
  model?: string | null
  accessLevel: ThreadAccessLevel
  executionMode: ThreadExecutionMode
}

export interface DispatchFollowUpInput {
  threadId: string
  prompt: string
  model?: string | null
  accessLevel?: ThreadAccessLevel
}

/** Injetável para testes — produção usa `runCliTurn` (spawn real do binário do provider). */
export type RunCliTurn = typeof defaultRunCliTurn
let runCliTurnImpl: RunCliTurn = defaultRunCliTurn

export function setRunCliTurnForTesting(fn: RunCliTurn): void {
  runCliTurnImpl = fn
}

export function resetRunCliTurnForTesting(): void {
  runCliTurnImpl = defaultRunCliTurn
}

const activeControllers = new Map<string, AbortController>()
const cancelledThreads = new Set<string>()

/** `stopping` imediato + aborta o processo do provider. Retorna false se não há execução ativa para a thread. */
export function cancelThread(threadId: string): boolean {
  const controller = activeControllers.get(threadId)
  if (!controller) return false

  cancelledThreads.add(threadId)
  updateThread(threadId, { state: 'stopping' })
  emit(threadId, { type: 'state.change', threadId, state: 'stopping' })
  controller.abort()
  return true
}

/** Resolve a API key do vault para o provider da thread — Claude só em modo api-key; Codex/Minimax quando salva. */
function resolveProviderApiKey(provider: ThreadProvider): string | undefined {
  if (provider === 'claude') {
    const mode = vaultService.getSecret('claude:mode') ?? 'subscription'
    return mode === 'api-key' ? vaultService.getSecret('keys:claude') : undefined
  }
  if (provider === 'codex') return vaultService.getSecret('keys:codex')
  if (provider === 'minimax') return vaultService.getSecret('keys:minimax')
  return undefined
}

function buildSystemPrompt(project: Project): string {
  const parts: string[] = []

  const promptGlobal = vaultService.getSecret('prompt:global')
  const globalPrompt = promptGlobal === undefined ? DEFAULT_PROMPT : promptGlobal
  if (globalPrompt) parts.push(globalPrompt)

  const rulesBlock = RuleRegistry.composeBlockForTurn(project.id)
  if (rulesBlock) parts.push(rulesBlock)

  const skillSnapshot = createSkillSnapshot(project.id)
  if (skillSnapshot.catalog.length > 0) {
    parts.push(
      `## Skills disponíveis (EngrenaCode)\n${skillSnapshot.catalog.map((s) => `- ${s.name}: ${s.description}`).join('\n')}`
    )
  }

  const subagentsRepo = createSubagentsRepository(getDb())
  const subagentCatalog = resolveSubagentCatalog(subagentsRepo, project.id)
  if (subagentCatalog.length > 0) {
    parts.push(
      `## SubAgents disponíveis via ${CALL_SUBAGENT_TOOL_NAME}\n${subagentCatalog
        .map((s) => `- ${s.name}: ${s.description}`)
        .join('\n')}`
    )
  }

  return parts.join('\n\n')
}

export function dispatchNewThread(input: DispatchNewThreadInput): Thread {
  const project = getProject(input.projectId)
  if (project === null) throw new DispatchValidationError('project_not_found', 'Projeto não encontrado.')

  acquireLease(project.id, 'agent', 'dispatch', null)

  let thread: Thread
  try {
    thread = createThread({
      projectId: project.id,
      provider: input.provider,
      model: input.model ?? null,
      accessLevel: input.accessLevel,
      executionMode: input.executionMode,
      state: 'running',
    })
  } catch (err) {
    releaseLease(project.id)
    throw err
  }

  void runTurn(project, thread, input.prompt)

  return thread
}

export function dispatchFollowUp(input: DispatchFollowUpInput): Thread {
  const thread = getThread(input.threadId)
  if (thread === null) throw new DispatchValidationError('thread_not_found', 'Thread não encontrada.')

  const project = getProject(thread.projectId)
  if (project === null) throw new DispatchValidationError('project_not_found', 'Projeto não encontrado.')

  acquireLease(project.id, 'agent', 'follow-up', thread.id)

  const patch: { accessLevel?: ThreadAccessLevel; model?: string | null; state: 'running' } = { state: 'running' }
  if (input.accessLevel) patch.accessLevel = input.accessLevel
  if (input.model !== undefined) patch.model = input.model

  let updated: Thread
  try {
    updated = updateThread(thread.id, patch) as Thread
  } catch (err) {
    releaseLease(project.id)
    throw err
  }

  emit(thread.id, { type: 'state.change', threadId: thread.id, state: 'running' })
  void runTurn(project, updated, input.prompt)

  return updated
}

async function runTurn(project: Project, thread: Thread, prompt: string): Promise<void> {
  let mcpsCleanup: () => void = () => {}
  try {
    appendMessage({ threadId: thread.id, role: 'user', content: prompt })

    const systemPrompt = buildSystemPrompt(project)
    const cwd = thread.executionMode === 'worktree' && thread.worktreePath ? thread.worktreePath : project.path

    const linkedMcps = McpRegistry.resolveForProject(project.id)
    const mcpsPrepared =
      linkedMcps.length > 0
        ? await prepareMcpsForDispatch(linkedMcps, { provider: thread.provider })
        : { resolved: [], omitted: [], cleanup: () => {} }
    mcpsCleanup = mcpsPrepared.cleanup

    for (const omission of mcpsPrepared.omitted) {
      emit(thread.id, {
        type: 'mcp.notice',
        threadId: thread.id,
        code: 'mcp-omitted',
        mcpName: omission.name,
        reason: omission.reason,
        message: mcpOmissionMessage(omission.name, omission.reason),
      })
    }

    let assistantText = ''
    const toolCallIdByProviderId = new Map<string, string>()
    const controller = new AbortController()
    activeControllers.set(thread.id, controller)

    const turnInput: ProviderTurnInput = {
      provider: thread.provider,
      cwd,
      prompt,
      systemPrompt: systemPrompt || undefined,
      model: thread.model,
      accessLevel: thread.accessLevel,
      apiKey: resolveProviderApiKey(thread.provider),
      mcpServers: mcpsPrepared.resolved,
      signal: controller.signal,
      onEvent: (event) => {
        if (event.type === 'text-delta') {
          assistantText += event.text
          emit(thread.id, { type: 'message.delta', threadId: thread.id, text: event.text })
          return
        }

        if (event.type === 'tool-start') {
          if (event.name === CALL_SUBAGENT_TOOL_NAME) {
            const gate = canDelegateSubagent({
              provider: thread.provider as ParentProvider,
              accessLevel: thread.accessLevel as ParentAccessLevel,
            })
            const row = createToolCall({ threadId: thread.id, name: event.name, params: event.params })
            toolCallIdByProviderId.set(event.id, row.id)
            emit(thread.id, { type: 'tool_call.start', threadId: thread.id, id: row.id, name: event.name, params: event.params })
            if (!gate.allowed) {
              updateToolCall(row.id, { status: 'error', result: { error: gate.reason }, ended: true })
              emit(thread.id, { type: 'tool_call.result', threadId: thread.id, id: row.id, status: 'error', result: { error: gate.reason } })
            }
            return
          }

          const row = createToolCall({ threadId: thread.id, name: event.name, params: event.params })
          toolCallIdByProviderId.set(event.id, row.id)
          emit(thread.id, { type: 'tool_call.start', threadId: thread.id, id: row.id, name: event.name, params: event.params })
          return
        }

        if (event.type === 'tool-result') {
          const rowId = toolCallIdByProviderId.get(event.id)
          if (rowId) {
            updateToolCall(rowId, { status: event.status, result: event.result, ended: true })
            emit(thread.id, { type: 'tool_call.result', threadId: thread.id, id: rowId, status: event.status, result: event.result })
          }
        }
      },
    }

    const result = await runCliTurnImpl(turnInput)
    const finalText = result.text || assistantText

    if (finalText) {
      appendMessage({ threadId: thread.id, role: 'assistant', content: finalText })
    }

    const diffs = await diffWorkingTree(cwd)
    for (const d of diffs) {
      const row = createDiff({
        threadId: thread.id,
        file: d.file,
        additions: d.additions,
        deletions: d.deletions,
        hunks: d.hunks,
        provider: thread.provider,
        worktreePath: cwd,
      })
      emit(thread.id, { type: 'diff.ready', threadId: thread.id, diffId: row.id, file: row.file })
    }

    updateThread(thread.id, { state: 'idle' })
    emit(thread.id, { type: 'state.change', threadId: thread.id, state: 'idle' })
  } catch (err) {
    const wasCancelled = cancelledThreads.delete(thread.id)
    const state = wasCancelled ? 'idle' : 'error'
    updateThread(thread.id, { state })
    emit(thread.id, { type: 'state.change', threadId: thread.id, state })

    if (!wasCancelled) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido no turno.'
      const code = err instanceof ProviderError ? err.code : 'turn_failed'
      emit(thread.id, { type: 'error', threadId: thread.id, code, message })
    }
  } finally {
    mcpsCleanup()
    activeControllers.delete(thread.id)
    releaseLease(project.id)
  }
}

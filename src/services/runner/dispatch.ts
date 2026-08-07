import { randomUUID } from 'crypto'
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
import { createLogEntry } from '../db/repositories/log-entries.js'
import { createUsageEvent } from '../db/repositories/usage-events.js'
import { resolveBillingMode, resolveProviderApiKey, resolveTurnCost } from './provider-resolution.js'
import { diffWorkingTree } from '../git/git-client.js'
import { createWorktree, WorktreeError } from '../git/worktree.js'
import { resolveThreadCwd } from './thread-cwd.js'
import { acquireLease, releaseLease } from './project-execution.js'
import { emit } from './ws-hub.js'
import { createSkillSnapshot, writeSkillSnapshotFile, LOAD_SKILL_TOOL_NAME, type SkillSnapshot } from './skill-registry.js'
import { RuleRegistry } from './rule-registry.js'
import { createSubagentsRepository } from '../db/repositories/subagents.js'
import { CALL_SUBAGENT_TOOL_NAME, resolveSubagentCatalog } from './subagent-registry.js'
import { createDelegationServer, type DelegationServerHandle } from './delegate.js'
import { buildEngrenaCodeMcpDef, SUBAGENT_MCP_NAME } from './subagent-mcp-server.js'
import { McpRegistry } from './mcp-registry.js'
import { MCP_UNSUPPORTED_PROVIDERS, mcpOmissionMessage, prepareMcpsForDispatch } from './mcp-secrets.js'
import { vaultService } from '../vault/vault-service.js'
import { DEFAULT_PROMPT } from '../http/config-handler.js'
import {
  runCliTurn as defaultRunCliTurn,
  ProviderError,
  type ProviderTurnInput,
  type ProviderUsage,
} from './providers/cli-driver.js'
import type { ComposerImageInput } from './providers/composer-images.js'

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
  reasoningLevel?: string | null
  accessLevel: ThreadAccessLevel
  executionMode: ThreadExecutionMode
  images?: ComposerImageInput[]
}

export interface DispatchFollowUpInput {
  threadId: string
  prompt: string
  model?: string | null
  reasoningLevel?: string | null
  accessLevel?: ThreadAccessLevel
  images?: ComposerImageInput[]
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

/** Grava 1 usage_event `source='agent'` por turno (spec F11 §3.2/§6) via a regra de custo compartilhada. */
function persistAgentUsage(params: {
  turnId: string
  project: Project
  thread: Thread
  usage: ProviderUsage
  costUsd: number | null | undefined
}): void {
  const { turnId, project, thread, usage, costUsd } = params
  const cost = resolveTurnCost(thread.provider, thread.model, usage, costUsd)

  createUsageEvent({
    turnId,
    projectId: project.id,
    threadId: thread.id,
    source: 'agent',
    provider: thread.provider,
    model: thread.model,
    billingMode: resolveBillingMode(thread.provider),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheCreationTokens: usage.cacheCreationTokens,
    ...cost,
  })
}

function buildSystemPrompt(project: Project, skillSnapshot: SkillSnapshot): string {
  const parts: string[] = []

  const promptGlobal = vaultService.getSecret('prompt:global')
  const globalPrompt = promptGlobal === undefined ? DEFAULT_PROMPT : promptGlobal
  if (globalPrompt) parts.push(globalPrompt)

  const rulesBlock = RuleRegistry.composeBlockForTurn(project.id)
  if (rulesBlock) parts.push(rulesBlock)

  if (skillSnapshot.catalog.length > 0) {
    parts.push(
      [
        `## Skills disponíveis (EngrenaCode)`,
        `Carregue o conteúdo sob demanda com a tool \`${LOAD_SKILL_TOOL_NAME}\` (argumento \`name\`).`,
        skillSnapshot.catalog.map((s) => `- ${s.name}: ${s.description}`).join('\n'),
      ].join('\n')
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

export async function dispatchNewThread(input: DispatchNewThreadInput): Promise<Thread> {
  const project = getProject(input.projectId)
  if (project === null) throw new DispatchValidationError('project_not_found', 'Projeto não encontrado.')

  acquireLease(project.id, 'agent', 'dispatch', null)

  let thread: Thread
  try {
    thread = createThread({
      projectId: project.id,
      provider: input.provider,
      model: input.model ?? null,
      reasoningLevel: input.reasoningLevel ?? null,
      accessLevel: input.accessLevel,
      executionMode: input.executionMode,
      state: 'running',
    })
  } catch (err) {
    releaseLease(project.id)
    throw err
  }

  // Worktree criada + persistida antes do turno (spec F13 §3.2) — falha nunca deixa o turno
  // rodar em `project.path` por engano; thread fica `error` e o dispatch inteiro rejeita.
  if (input.executionMode === 'worktree') {
    try {
      const worktreePath = await createWorktree(project.path, project.id, thread.id)
      thread = updateThread(thread.id, { worktreePath }) as Thread
    } catch (err) {
      releaseLease(project.id)
      updateThread(thread.id, { state: 'error' })
      if (err instanceof WorktreeError) throw new DispatchValidationError(err.code, err.message)
      throw err
    }
  }

  void runTurn(project, thread, input.prompt, input.images)

  return thread
}

export function dispatchFollowUp(input: DispatchFollowUpInput): Thread {
  const thread = getThread(input.threadId)
  if (thread === null) throw new DispatchValidationError('thread_not_found', 'Thread não encontrada.')

  const project = getProject(thread.projectId)
  if (project === null) throw new DispatchValidationError('project_not_found', 'Projeto não encontrado.')

  acquireLease(project.id, 'agent', 'follow-up', thread.id)

  const patch: {
    accessLevel?: ThreadAccessLevel
    model?: string | null
    reasoningLevel?: string | null
    state: 'running'
  } = { state: 'running' }
  if (input.accessLevel) patch.accessLevel = input.accessLevel
  if (input.model !== undefined) patch.model = input.model
  if (input.reasoningLevel !== undefined) patch.reasoningLevel = input.reasoningLevel

  let updated: Thread
  try {
    updated = updateThread(thread.id, patch) as Thread
  } catch (err) {
    releaseLease(project.id)
    throw err
  }

  emit(thread.id, { type: 'state.change', threadId: thread.id, state: 'running' })
  void runTurn(project, updated, input.prompt, input.images)

  return updated
}

async function runTurn(project: Project, thread: Thread, prompt: string, images?: ComposerImageInput[]): Promise<void> {
  let mcpsCleanup: () => void = () => {}
  let delegationServer: DelegationServerHandle | null = null
  const turnId = randomUUID()
  try {
    const imageBlocks =
      images && images.length > 0
        ? images.map((img) => ({ type: 'image' as const, mimeType: img.mimeType, name: img.name, dataBase64: img.dataBase64 }))
        : null
    appendMessage({ threadId: thread.id, role: 'user', content: prompt, blocks: imageBlocks })

    const skillSnapshot = createSkillSnapshot(project.id)
    const systemPrompt = buildSystemPrompt(project, skillSnapshot)
    const cwd = resolveThreadCwd(thread, project)

    const linkedMcps = McpRegistry.resolveForProject(project.id)
    const mcpsPrepared =
      linkedMcps.length > 0
        ? await prepareMcpsForDispatch(linkedMcps, { provider: thread.provider })
        : { resolved: [], omitted: [], cleanup: () => {} }
    mcpsCleanup = mcpsPrepared.cleanup

    // MCP interno `engrenacode` (F11 call_subagent + F12 load_skill). Um único server — o nome
    // `engrenacode` é reservado. Registrado quando há skills e/ou subagents e o provider aceita
    // --mcp-config (MCP_UNSUPPORTED_PROVIDERS, hoje só minimax).
    const subagentsRepo = createSubagentsRepository(getDb())
    const subagentCatalogForDelegation = resolveSubagentCatalog(subagentsRepo, project.id)
    const providerSupportsMcp = !MCP_UNSUPPORTED_PROVIDERS.has(thread.provider)
    const wantsLoadSkill = skillSnapshot.catalog.length > 0
    const wantsCallSubagent = subagentCatalogForDelegation.length > 0

    // Lido por delegate.ts no início de cada delegação (spec F15 §3.2) para correlacionar o run
    // com a tool-call `call_subagent` do pai na timeline. Delegações no mesmo turno são
    // serializadas em FIFO, e o evento tool-start do pai chega antes da chamada HTTP `/delegate`.
    let lastCallSubagentToolCallId: string | null = null

    if ((wantsLoadSkill || wantsCallSubagent) && providerSupportsMcp) {
      let skillsSnapshotPath: string | undefined
      if (wantsLoadSkill) {
        skillsSnapshotPath = writeSkillSnapshotFile(skillSnapshot)
      }
      if (wantsCallSubagent) {
        delegationServer = await createDelegationServer({
          repo: subagentsRepo,
          project,
          parentThread: thread,
          parentTurnId: turnId,
          getParentToolCallId: () => lastCallSubagentToolCallId,
        })
      }
      mcpsPrepared.resolved.push(
        buildEngrenaCodeMcpDef({
          skillsSnapshotPath,
          port: delegationServer?.port,
          token: delegationServer?.token,
        })
      )
    } else if (wantsLoadSkill && !providerSupportsMcp) {
      emit(thread.id, {
        type: 'mcp.notice',
        threadId: thread.id,
        code: 'mcp-omitted',
        mcpName: SUBAGENT_MCP_NAME,
        reason: 'provider_unsupported',
        message: `load_skill (${LOAD_SKILL_TOOL_NAME}) indisponível neste provider — o catálogo permanece só no prompt.`,
      })
    }

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
          // call_subagent (mcp__engrenacode__call_subagent) chega aqui como qualquer outra tool
          // MCP real agora — o gate (canDelegateSubagent) roda dentro do servidor de delegação
          // (delegate.ts:runDelegatedSubagentTurn) antes do spawn; bloqueio vira tool_result de
          // erro, já coberto pelo tratamento genérico abaixo (spec F11 §3.2).
          const row = createToolCall({ threadId: thread.id, name: event.name, params: event.params })
          toolCallIdByProviderId.set(event.id, row.id)
          if (event.name === CALL_SUBAGENT_TOOL_NAME) lastCallSubagentToolCallId = row.id
          emit(thread.id, { type: 'tool_call.start', threadId: thread.id, id: row.id, name: event.name, params: event.params })
          return
        }

        if (event.type === 'tool-result') {
          const rowId = toolCallIdByProviderId.get(event.id)
          if (rowId) {
            const updated = updateToolCall(rowId, { status: event.status, result: event.result, ended: true })
            emit(thread.id, { type: 'tool_call.result', threadId: thread.id, id: rowId, status: event.status, result: event.result })
            if (updated) {
              createLogEntry({ threadId: thread.id, kind: 'tool', event: `${updated.name} (${updated.status})` })
            }
          }
        }
      },
    }

    const result = await runCliTurnImpl(turnInput)
    const finalText = result.text || assistantText

    if (result.usage) {
      persistAgentUsage({ turnId, project, thread, usage: result.usage, costUsd: result.costUsd })
    } else {
      console.warn(`[dispatch] Turno ${thread.id}: provider "${thread.provider}" não reportou usage — nenhum usage_event gravado.`)
    }

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
      // Turno falhou mas o provider já reportou usage/custo (spec F11 §3.2) — captura mesmo no erro.
      if (err instanceof ProviderError && err.usage) {
        persistAgentUsage({ turnId, project, thread, usage: err.usage, costUsd: err.costUsd })
      }

      const message = err instanceof Error ? err.message : 'Erro desconhecido no turno.'
      const code = err instanceof ProviderError ? err.code : 'turn_failed'
      emit(thread.id, { type: 'error', threadId: thread.id, code, message })
    }
  } finally {
    mcpsCleanup()
    delegationServer?.close()
    activeControllers.delete(thread.id)
    releaseLease(project.id)
  }
}

import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { getProject, type Project } from '../db/repositories/projects.js'
import {
  createThread,
  getThread,
  updateThread,
  type Thread,
  type ThreadAccessLevel,
  type ThreadExecutionMode,
  type ThreadProvider,
  type ThreadState,
} from '../db/repositories/threads.js'
import { appendMessage, createToolCall, updateToolCall } from '../db/repositories/messages.js'
import { createDiff } from '../db/repositories/diffs.js'
import { createLogEntry } from '../db/repositories/log-entries.js'
import { createUsageEvent } from '../db/repositories/usage-events.js'
import { resolveBillingMode, resolveProviderApiKey, resolveTurnCost } from './provider-resolution.js'
import { diffWorkingTree } from '../git/git-client.js'
import { createWorktree, WorktreeError } from '../git/worktree.js'
import { resolveThreadCwd } from './thread-cwd.js'
import { acquireLease, getLease, releaseLease } from './project-execution.js'
import { emit } from './ws-hub.js'
import {
  consumeThreadCancelled,
  getActiveController,
  markThreadCancelled,
  registerActiveController,
  unregisterActiveController,
} from './turn-control.js'
import { parseSlashCommand } from './slash-commands.js'
import { deriveThreadTitle } from './thread-title.js'
import { runPipelineCommand } from './pipeline-runner.js'
import { assertUsageLimitNotExceeded } from './usage-limit-eval.js'
import { getActivePipelineForThread, updatePipeline } from '../db/repositories/pipelines.js'
import {
  createSkillSnapshot,
  writeSkillSnapshotFile,
  LOAD_SKILL_TOOL_NAME,
  type SkillSnapshot,
} from './skill-registry.js'
import { RuleRegistry } from './rule-registry.js'
import { MemoryRegistry } from './memory-registry.js'
import { createMemoryWriteServer, type MemoryWriteServerHandle } from './memory-write-server.js'
import { CALL_SUBAGENT_TOOL_NAME, resolveSubagentCatalog } from './subagent-registry.js'
import { createDelegationServer, type DelegationServerHandle } from './delegate.js'
import {
  createAskUserQuestionServer,
  rejectAskUserQuestion,
  ASK_USER_QUESTION_TOOL_NAME,
  type AskUserQuestionServerHandle,
} from './ask-user-question.js'
import { createPermissionServer, denyPendingPermissionsForThread, type PermissionServerHandle } from './permission-broker.js'
import { buildEngrenaCodeMcpDef, SUBAGENT_MCP_NAME } from './subagent-mcp-server.js'
import { McpRegistry } from './mcp-registry.js'
import { MCP_UNSUPPORTED_PROVIDERS, mcpOmissionMessage, prepareMcpsForDispatch } from './mcp-secrets.js'
import { ensureIndexForTurn } from '../codegraph/ensure.js'
import { vaultService } from '../vault/vault-service.js'
import { DEFAULT_PROMPT } from '../config/defaults.js'
import { RUNTIME_SAFETY_PROMPT } from './runtime-safety-prompt.js'
import {
  runCliTurn as defaultRunCliTurn,
  ProviderError,
  type ProviderTurnInput,
  type ProviderUsage,
} from './providers/cli-driver.js'
import type { ComposerImageInput } from './providers/composer-images.js'
import {
  attachmentLabel,
  composePromptWithContext,
  truncateAttachmentContent,
  type ContextAttachmentInput,
  type ResolvedAttachment,
} from './providers/context-attachments.js'
import { resolveProjectFilePath } from '../project-files/path-guard.js'
import { resolveChatMode } from '../prompts/chat-mode-resolver.js'
import { composeModeBlock } from '../prompts/prompt-spec.js'
import { isPathIgnored } from '../ignore/ignore-service.js'

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
  contextAttachments?: ContextAttachmentInput[]
  /** Nome do modo de chat (F28 §3.4) — fica na thread e reentra no system prompt a cada turno. */
  chatMode?: string | null
}

export interface DispatchFollowUpInput {
  threadId: string
  prompt: string
  model?: string | null
  reasoningLevel?: string | null
  accessLevel?: ThreadAccessLevel
  images?: ComposerImageInput[]
  contextAttachments?: ContextAttachmentInput[]
  chatMode?: string | null
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

/** Estados de onde um cancelamento manual ainda faz sentido; o resto já assentou. */
const CANCELLABLE_STATES: ReadonlySet<ThreadState> = new Set<ThreadState>(['running', 'stopping', 'waiting_user'])

/**
 * Cancelamento manual. Com execução ativa: `stopping` imediato + aborta o processo do provider (o
 * turno assenta em `cancelled` no cleanup). Sem execução ativa: a thread ficou órfã porque o turno
 * morreu sem passar pelo cleanup (ex.: pergunta pendente de F21 cujo processo caiu com o app de pé),
 * então o cancelamento assenta o estado aqui mesmo — antes disso a thread ficava presa
 * indefinidamente, com o endpoint devolvendo `{cancelled:false}` e a UI oferecendo um "Parar
 * execução" que não fazia nada. Retorna false só quando não há nada a cancelar.
 */
export function cancelThread(threadId: string): boolean {
  const controller = getActiveController(threadId)
  if (controller) {
    markThreadCancelled(threadId)
    updateThread(threadId, { state: 'stopping' })
    emit(threadId, { type: 'state.change', threadId, state: 'stopping' })
    controller.abort()
    return true
  }

  const thread = getThread(threadId)
  if (thread === null || !CANCELLABLE_STATES.has(thread.state)) return false

  // A pergunta pendente (se houver) precisa ser rejeitada antes do estado assentar, senão o
  // `POST /ask` do MCP fica preso mesmo sem thread para respondê-lo (path normal F21 e checkpoint
  // órfão de pipeline F22, que reusa o mesmo mecanismo).
  rejectAskUserQuestion(threadId, 'thread cancelada pelo usuário')
  denyPendingPermissionsForThread(threadId)

  // Pipeline órfão (processo caiu sem passar pelo finally de pipeline-runner) — assenta aqui, já
  // que ninguém mais vai fechar aquele registro.
  const activePipeline = getActivePipelineForThread(threadId)
  if (activePipeline) updatePipeline(activePipeline.id, { status: 'cancelled', finishedAt: Date.now() })

  // Lease é por projeto: só libera se for esta thread que a detém, nunca a de outra execução.
  if (getLease(thread.projectId)?.ownerThreadId === threadId) releaseLease(thread.projectId)

  updateThread(threadId, { state: 'cancelled' })
  emit(threadId, { type: 'state.change', threadId, state: 'cancelled' })
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

function buildSystemPrompt(
  project: Project,
  threadId: string,
  skillSnapshot: SkillSnapshot,
  chatMode: string | null
): string {
  const parts: string[] = []

  const promptGlobal = vaultService.getSecret('prompt:global')
  const globalPrompt = promptGlobal === undefined ? DEFAULT_PROMPT : promptGlobal
  if (globalPrompt) parts.push(globalPrompt)

  parts.push(RUNTIME_SAFETY_PROMPT)

  const rulesBlock = RuleRegistry.composeBlockForTurn(project.id)
  if (rulesBlock) parts.push(rulesBlock)

  const memoryBlock = MemoryRegistry.composeBlockForTurn(project.id, threadId)
  if (memoryBlock) parts.push(memoryBlock)

  // Modo de chat depois das rules: é escolha do turno, então fala por último entre as instruções.
  const modeBlock = composeModeBlock(resolveChatMode(project, chatMode))
  if (modeBlock) parts.push(modeBlock)

  if (skillSnapshot.catalog.length > 0) {
    parts.push(
      [
        `## Skills disponíveis (EngrenaCode)`,
        `Carregue o conteúdo sob demanda com a tool \`${LOAD_SKILL_TOOL_NAME}\` (argumento \`name\`).`,
        skillSnapshot.catalog.map((s) => `- ${s.name}: ${s.description}`).join('\n'),
      ].join('\n')
    )
  }

  const subagentCatalog = resolveSubagentCatalog(project.id)
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

  // Slash inválido/desconhecido/sem args nunca chega a criar thread nem acquirir lease (spec F22
  // §5.2 "nenhum estágio inicia") — falha rápido, igual às demais validações de dispatch.
  const slash = parseSlashCommand(input.prompt)
  if (slash.kind === 'error') throw new DispatchValidationError(slash.code, slash.message)

  // Gate de teto de consumo (spec F25 §3.2/§5.4) — antes do lease, igual à validação de slash acima.
  assertUsageLimitNotExceeded(project.id)

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
      title: deriveThreadTitle(input.prompt),
      chatMode: input.chatMode ?? null,
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

  if (slash.kind === 'command') {
    void runPipelineCommand({ project, thread, command: slash.command, prompt: input.prompt, argsText: slash.args })
  } else {
    void runTurn(project, thread, input.prompt, input.images, input.contextAttachments)
  }

  return thread
}

export function dispatchFollowUp(input: DispatchFollowUpInput): Thread {
  const thread = getThread(input.threadId)
  if (thread === null) throw new DispatchValidationError('thread_not_found', 'Thread não encontrada.')

  const project = getProject(thread.projectId)
  if (project === null) throw new DispatchValidationError('project_not_found', 'Projeto não encontrado.')

  const slash = parseSlashCommand(input.prompt)
  if (slash.kind === 'error') throw new DispatchValidationError(slash.code, slash.message)

  assertUsageLimitNotExceeded(project.id)

  acquireLease(project.id, 'agent', 'follow-up', thread.id)

  const patch: {
    accessLevel?: ThreadAccessLevel
    model?: string | null
    reasoningLevel?: string | null
    chatMode?: string | null
    state: 'running'
  } = { state: 'running' }
  if (input.accessLevel) patch.accessLevel = input.accessLevel
  if (input.model !== undefined) patch.model = input.model
  if (input.reasoningLevel !== undefined) patch.reasoningLevel = input.reasoningLevel
  // Trocar de modo no meio da thread vale para os turnos seguintes, como trocar de modelo.
  if (input.chatMode !== undefined) patch.chatMode = input.chatMode

  let updated: Thread
  try {
    updated = updateThread(thread.id, patch) as Thread
  } catch (err) {
    releaseLease(project.id)
    throw err
  }

  emit(thread.id, { type: 'state.change', threadId: thread.id, state: 'running' })
  if (slash.kind === 'command') {
    void runPipelineCommand({ project, thread: updated, command: slash.command, prompt: input.prompt, argsText: slash.args })
  } else {
    void runTurn(project, updated, input.prompt, input.images, input.contextAttachments)
  }

  return updated
}

/**
 * Lê o conteúdo de cada anexo agora, no turno: seleção vem pronta do renderer, arquivo é lido do
 * disco (path checado pela guarda compartilhada). Anexo que sumiu ou é inseguro some do contexto
 * em silêncio — atrapalhar o turno inteiro por um chip velho seria pior.
 */
function resolveContextAttachments(project: Project, attachments?: ContextAttachmentInput[]): ResolvedAttachment[] {
  if (!attachments || attachments.length === 0) return []
  const resolved: ResolvedAttachment[] = []
  for (const attachment of attachments) {
    const label = attachmentLabel(attachment)
    if (attachment.kind === 'selection') {
      resolved.push({ label, content: truncateAttachmentContent(attachment.text) })
      continue
    }
    const safe = resolveProjectFilePath(project.path, attachment.path)
    if (!safe.ok) continue
    // Exclusão de conteúdo vale também para anexo: o chip pode ter sido criado antes da regra.
    if (isPathIgnored(project.path, safe.relPath)) continue
    try {
      resolved.push({ label, content: truncateAttachmentContent(readFileSync(safe.absPath, 'utf8')) })
    } catch {
      // arquivo removido entre anexar e enviar
    }
  }
  return resolved
}

async function runTurn(
  project: Project,
  thread: Thread,
  prompt: string,
  images?: ComposerImageInput[],
  contextAttachments?: ContextAttachmentInput[]
): Promise<void> {
  let mcpsCleanup: () => void = () => {}
  let delegationServer: DelegationServerHandle | null = null
  let askUserQuestionServer: AskUserQuestionServerHandle | null = null
  let memoryWriteServer: MemoryWriteServerHandle | null = null
  let permissionServer: PermissionServerHandle | null = null
  const turnId = randomUUID()
  try {
    const imageBlocks =
      images && images.length > 0
        ? images.map((img) => ({
            type: 'image' as const,
            mimeType: img.mimeType,
            name: img.name,
            dataBase64: img.dataBase64,
          }))
        : null
    const resolvedAttachments = resolveContextAttachments(project, contextAttachments)
    const contextBlocks =
      contextAttachments && contextAttachments.length > 0
        ? contextAttachments.map((att) => ({
            type: 'context' as const,
            kind: att.kind,
            path: att.path,
            label: attachmentLabel(att),
          }))
        : null
    const blocks =
      imageBlocks || contextBlocks ? [...(imageBlocks ?? []), ...(contextBlocks ?? [])] : null
    // O usuário vê no histórico o que digitou (+ chips); o conteúdo dos anexos só vai no prompt
    // do provider, lido do disco agora — nunca uma cópia velha guardada no banco.
    appendMessage({ threadId: thread.id, role: 'user', content: prompt, blocks })
    const withContext = composePromptWithContext(prompt, resolvedAttachments)

    const skillSnapshot = createSkillSnapshot(project.id)
    const systemPrompt = buildSystemPrompt(project, thread.id, skillSnapshot, thread.chatMode)
    // Turno retomado (`--resume`) reaproveita o system prompt gravado na sessão do CLI e ignora o
    // `--append-system-prompt` novo — sem isto, trocar de modo no meio da thread não valia nada.
    // Então o bloco do modo viaja no prompt do turno, como os anexos de contexto.
    const resumingClaude = thread.provider === 'claude' && thread.cliSessionId !== null
    const modeBlockForTurn = resumingClaude
      ? composeModeBlock(resolveChatMode(project, thread.chatMode))
      : ''
    const providerPrompt =
      modeBlockForTurn === '' ? withContext : modeBlockForTurn + '\n\n' + withContext
    const cwd = resolveThreadCwd(thread, project)

    const linkedMcps = McpRegistry.resolveForProject(project.id)
    const mcpsPrepared =
      linkedMcps.length > 0
        ? await prepareMcpsForDispatch(linkedMcps, { provider: thread.provider })
        : { resolved: [], omitted: [], cleanup: () => {} }
    mcpsCleanup = mcpsPrepared.cleanup

    // MCP interno `engrenacode` (F11 call_subagent + F12 load_skill + F19 repo_graph_*).
    // Um único server — o nome `engrenacode` é reservado. Registrado quando há skills,
    // subagents e/ou CodeGraph, e o provider aceita --mcp-config.
    const codegraphEnsure = ensureIndexForTurn(project.id, project.path)
    const subagentCatalogForDelegation = resolveSubagentCatalog(project.id)
    const providerSupportsMcp = !MCP_UNSUPPORTED_PROVIDERS.has(thread.provider)
    const wantsLoadSkill = skillSnapshot.catalog.length > 0
    const wantsCallSubagent = subagentCatalogForDelegation.length > 0

    // Lido por delegate.ts no início de cada delegação (spec F15 §3.2) para correlacionar o run
    // com a tool-call `call_subagent` do pai na timeline. Delegações no mesmo turno são
    // serializadas em FIFO, e o evento tool-start do pai chega antes da chamada HTTP `/delegate`.
    let lastCallSubagentToolCallId: string | null = null

    // ask_user_question (F21) é sempre registrada quando o provider aceita MCP, independente de
    // catálogo de skills/subagents vinculado ao projeto — diferente de load_skill/call_subagent.
    if (providerSupportsMcp) {
      let skillsSnapshotPath: string | undefined
      if (wantsLoadSkill) {
        skillsSnapshotPath = writeSkillSnapshotFile(skillSnapshot)
      }
      if (wantsCallSubagent) {
        delegationServer = await createDelegationServer({
          project,
          parentThread: thread,
          parentTurnId: turnId,
          getParentToolCallId: () => lastCallSubagentToolCallId,
        })
      }
      askUserQuestionServer = await createAskUserQuestionServer(thread.id)
      if (MemoryRegistry.isEnabledForProject(project.id)) {
        memoryWriteServer = await createMemoryWriteServer({ projectId: project.id, threadId: thread.id }, () => {
          emit(thread.id, { type: 'memory.entry', threadId: thread.id, projectId: project.id })
        })
      }
      mcpsPrepared.resolved.push(
        buildEngrenaCodeMcpDef({
          skillsSnapshotPath,
          port: delegationServer?.port,
          token: delegationServer?.token,
          codegraphIndexPath: codegraphEnsure.indexPath ?? undefined,
          askPort: askUserQuestionServer.port,
          askToken: askUserQuestionServer.token,
          memoryPort: memoryWriteServer?.port,
          memoryToken: memoryWriteServer?.token,
        })
      )
    } else {
      emit(thread.id, {
        type: 'mcp.notice',
        threadId: thread.id,
        code: 'mcp-omitted',
        mcpName: SUBAGENT_MCP_NAME,
        reason: 'provider_unsupported',
        message: `ask_user_question (${ASK_USER_QUESTION_TOOL_NAME})${wantsLoadSkill ? ` e load_skill (${LOAD_SKILL_TOOL_NAME})` : ''} indisponível neste provider — o turno segue sem essas tools.`,
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
    registerActiveController(thread.id, controller)

    // PermissionBroker (spec supervised) — só Claude: `--permission-mode default` sozinho exige
    // stdin interativo, inexistente no spawn headless. O hook `PreToolUse` (cli-driver.ts) segura
    // cada tool call aqui até a UI responder via `POST /api/threads/:id/permission`.
    if (thread.provider === 'claude' && thread.accessLevel === 'supervised') {
      permissionServer = await createPermissionServer(thread.id, ({ requestId, toolName, params }) => {
        emit(thread.id, { type: 'permission.request', threadId: thread.id, requestId, toolName, params })
      })
    }

    const turnInput: ProviderTurnInput = {
      provider: thread.provider,
      cwd,
      prompt: providerPrompt,
      systemPrompt: systemPrompt || undefined,
      model: thread.model,
      reasoningLevel: thread.reasoningLevel,
      accessLevel: thread.accessLevel,
      apiKey: resolveProviderApiKey(thread.provider),
      mcpServers: mcpsPrepared.resolved,
      permissionPort: permissionServer?.port,
      permissionToken: permissionServer?.token,
      resumeSessionId: thread.provider === 'claude' ? thread.cliSessionId : undefined,
      images,
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
          const row = createToolCall({
            threadId: thread.id,
            name: event.name,
            params: event.params,
          })
          toolCallIdByProviderId.set(event.id, row.id)
          if (event.name === CALL_SUBAGENT_TOOL_NAME) lastCallSubagentToolCallId = row.id
          emit(thread.id, {
            type: 'tool_call.start',
            threadId: thread.id,
            id: row.id,
            name: event.name,
            params: event.params,
          })
          // Pausa o turno (F21 §3.2) — não conta como `running` para lease/thread_busy; a UI
          // resolve via POST /answer, que libera o `POST /ask` preso em ask-user-question.ts.
          if (event.name === ASK_USER_QUESTION_TOOL_NAME) {
            updateThread(thread.id, { state: 'waiting_user' })
            emit(thread.id, { type: 'state.change', threadId: thread.id, state: 'waiting_user' })
          }
          return
        }

        if (event.type === 'tool-result') {
          const rowId = toolCallIdByProviderId.get(event.id)
          if (rowId) {
            const updated = updateToolCall(rowId, {
              status: event.status,
              result: event.result,
              ended: true,
            })
            emit(thread.id, {
              type: 'tool_call.result',
              threadId: thread.id,
              id: rowId,
              status: event.status,
              result: event.result,
            })
            if (updated) {
              createLogEntry({
                threadId: thread.id,
                kind: 'tool',
                event: `${updated.name} (${updated.status})`,
              })
              // Resposta do usuário chegou (resolveAskUserQuestion liberou o /ask preso) — retoma
              // o turno sem reabrir a thread (F21 §3.2).
              if (updated.name === ASK_USER_QUESTION_TOOL_NAME) {
                updateThread(thread.id, { state: 'running' })
                emit(thread.id, { type: 'state.change', threadId: thread.id, state: 'running' })
              }
            }
          }
        }
      },
    }

    const result = await runCliTurnImpl(turnInput)
    const finalText = result.text || assistantText

    // Claude: grava session_id para o próximo follow-up usar `--resume` (continuidade headless).
    if (result.sessionId && thread.provider === 'claude') {
      updateThread(thread.id, { cliSessionId: result.sessionId })
    }

    if (result.usage) {
      persistAgentUsage({ turnId, project, thread, usage: result.usage, costUsd: result.costUsd })
    } else {
      console.warn(
        `[dispatch] Turno ${thread.id}: provider "${thread.provider}" não reportou usage — nenhum usage_event gravado.`
      )
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
    const wasCancelled = consumeThreadCancelled(thread.id)
    // Cancelado pelo usuário assenta em `cancelled`, não `idle`: o mesmo destino do cancelamento de
    // uma thread órfã, e um sinal de auditoria que `idle` (indistinguível de turno concluído) apagava.
    const state: ThreadState = wasCancelled ? 'cancelled' : 'error'
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
    // Libera um `POST /ask` ainda preso (turno cancelado/erro antes da resposta chegar) antes de
    // fechar o servidor — sem isso o `tools/call` do MCP filho ficaria pendurado (F21 §3.2).
    rejectAskUserQuestion(thread.id, 'Turno encerrado antes da resposta do usuário.')
    askUserQuestionServer?.close()
    memoryWriteServer?.close()
    // Mesmo cuidado do `POST /ask`: nega permissão pendente antes de fechar o server, senão o
    // hook `PreToolUse` do CLI filho fica preso mesmo sem thread pra respondê-lo.
    denyPendingPermissionsForThread(thread.id)
    permissionServer?.close()
    unregisterActiveController(thread.id)
    releaseLease(project.id)
  }
}

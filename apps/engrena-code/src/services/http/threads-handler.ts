import type { IncomingMessage, ServerResponse } from 'http'
import { guard, parseBody, readBody, sendError, sendJson, sendTransportError } from './_transport.js'
import {
  getThread,
  deleteThread,
  listThreadsForProject,
  searchThreadsForProject,
  updateThread,
} from '../db/repositories/threads.js'
import { listMessagesForThread, listToolCallsForThread } from '../db/repositories/messages.js'
import { listDiffsForThread, deleteDiffsForThread } from '../db/repositories/diffs.js'
import { getProject } from '../db/repositories/projects.js'
import { listSubagentRunsForParentThread } from '../db/repositories/subagents.js'
import {
  listPipelinesForThread,
  listStagesForPipeline,
  type Pipeline,
  type PipelineStage,
} from '../db/repositories/pipelines.js'
import {
  cancelThread,
  dispatchFollowUp,
  dispatchNewThread,
  DispatchValidationError,
  type DispatchFollowUpInput,
  type DispatchNewThreadInput,
} from '../runner/dispatch.js'
import { applyDiffAction, ApplyDiffValidationError, type AcceptDiffInput } from '../runner/apply-diff.js'
import { validateContextAttachments, type ContextAttachmentInput } from '../runner/providers/context-attachments.js'
import { isValidPromptName } from '../prompts/prompt-spec.js'
import {
  buildExportSnapshot,
  exportFileName,
  exportThreadAsJson,
  exportThreadAsMarkdown,
} from '../threads/thread-export.js'
import { primeFollowupsForTurn } from '../threads/followups-runner.js'
import { clearMessageFeedback, listFeedbackForThread, setMessageFeedback } from '../db/repositories/message-feedback.js'
import { UsageLimitExceededError } from '../runner/usage-limit-eval.js'
import {
  clearAllowedToolsForThread,
  clearBrokerGrantsForThread,
  grantAlwaysAllowedTool,
} from '../runner/permission-broker.js'
import {
  allowOpenPermissionGates,
  listOpenGates,
  resolvePermissionGate,
  resolveQuestionGate,
  type GateAnswer,
} from '../runner/gate.js'
import { acquireLease, LeaseBusyError, releaseLease } from '../runner/project-execution.js'
import { removeWorktreeIfSafe } from '../git/worktree.js'
import { emit } from '../runner/ws-hub.js'
import { DiffConflictResolutionError, resolveParallelConflict } from '../runner/parallel-merge.js'
import { resolveThreadCwd } from '../runner/thread-cwd.js'
import {
  getComposerCatalog,
  isMultimodal,
  isValidModel,
  isValidProvider,
  isValidReasoningLevel,
} from '../runner/providers/provider-catalog.js'
import { validateComposerImages, type ComposerImageInput } from '../runner/providers/composer-images.js'

const ACCESS_LEVELS = ['supervised', 'auto-accept-edits', 'full-access'] as const
const EXECUTION_MODES = ['main', 'worktree'] as const

function threadBusyDetails(err: LeaseBusyError): object {
  return {
    threadId: err.info.ownerThreadId,
    ownerType: err.info.ownerType,
    operation: err.info.operation,
    ownerThreadId: err.info.ownerThreadId,
    startedAt: err.info.startedAt,
  }
}

function handleDispatchError(res: ServerResponse, err: unknown): void {
  if (err instanceof LeaseBusyError) {
    sendError(res, 409, 'thread_busy', err.message, threadBusyDetails(err))
    return
  }
  if (err instanceof UsageLimitExceededError) {
    sendError(res, 409, err.code, err.message, err.details)
    return
  }
  if (err instanceof DispatchValidationError) {
    const status = err.code === 'project_not_found' || err.code === 'thread_not_found' ? 404 : 400
    sendError(res, status, err.code, err.message)
    return
  }
  console.error('[threads-handler] Unhandled dispatch error:', err)
  sendError(res, 500, 'internal_error', 'Erro interno.')
}

function handleAcceptError(res: ServerResponse, err: unknown): void {
  if (err instanceof LeaseBusyError) {
    sendError(res, 409, 'thread_busy', err.message, threadBusyDetails(err))
    return
  }
  if (err instanceof ApplyDiffValidationError) {
    const status =
      err.code === 'thread_not_found' || err.code === 'project_not_found' || err.code === 'diff_not_found'
        ? 404
        : err.code === 'diff_apply_failed' || err.code === 'diff_conflict'
          ? 409
          : 400
    sendError(res, status, err.code, err.message)
    return
  }
  console.error('[threads-handler] Unhandled accept-diff error:', err)
  sendError(res, 500, 'internal_error', 'Erro interno.')
}

function streamPathFor(threadId: string): { ws: string } {
  return { ws: `/?threadId=${threadId}` }
}

const MAX_CLIENT_MESSAGE_ID = 128

/**
 * `clientMessageId` (identidade da bolha otimista do chat) é opcional — cliente que não manda
 * segue exatamente como antes, com `null` em `messages.client_id`. Quando vem, tem que ser texto
 * curto: é só uma chave de reconciliação, nunca conteúdo.
 */
function narrowClientMessageId(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false }
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.length > MAX_CLIENT_MESSAGE_ID) return { ok: false }
  return { ok: true, value: trimmed }
}

// ── Dispatch handlers ────────────────────────────────────────────────────────

interface CreateThreadBody {
  prompt?: string
  provider?: string
  model?: string | null
  reasoningLevel?: string | null
  accessLevel?: string
  executionMode?: string
  images?: unknown[]
  contextAttachments?: unknown
  chatMode?: string | null
  clientMessageId?: unknown
}

async function handleCreateThread(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  const data = parseBody<CreateThreadBody>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')

  if (typeof data.prompt !== 'string' || data.prompt.trim() === '') {
    return sendError(res, 400, 'validation_error', 'prompt é obrigatório.')
  }
  if (typeof data.provider !== 'string' || !isValidProvider(data.provider)) {
    return sendError(res, 400, 'validation_error', 'provider deve ser claude, codex, kimi, minimax, glm ou grok.')
  }
  if (typeof data.accessLevel !== 'string' || !(ACCESS_LEVELS as readonly string[]).includes(data.accessLevel)) {
    return sendError(res, 400, 'validation_error', 'accessLevel inválido.')
  }
  if (typeof data.executionMode !== 'string' || !(EXECUTION_MODES as readonly string[]).includes(data.executionMode)) {
    return sendError(res, 400, 'validation_error', 'executionMode inválido.')
  }

  const provider = data.provider as DispatchNewThreadInput['provider']

  if (data.model !== undefined && data.model !== null && !isValidModel(provider, data.model)) {
    return sendError(res, 400, 'validation_error', 'model fora do catálogo do provider.')
  }
  if (
    data.reasoningLevel !== undefined &&
    data.reasoningLevel !== null &&
    !isValidReasoningLevel(provider, data.reasoningLevel)
  ) {
    return sendError(res, 400, 'validation_error', 'reasoningLevel fora do catálogo do provider.')
  }

  let images: ComposerImageInput[] | undefined
  if (data.images !== undefined && data.images.length > 0) {
    if (!isMultimodal(provider)) {
      return sendError(res, 400, 'image_not_supported', `Provider "${provider}" não aceita anexos de imagem.`)
    }
    const imgErr = validateComposerImages(data.images)
    if (imgErr) return sendError(res, 400, imgErr.code, imgErr.message)
    images = data.images as ComposerImageInput[]
  }

  let contextAttachments: ContextAttachmentInput[] | undefined
  if (data.contextAttachments !== undefined) {
    const attErr = validateContextAttachments(data.contextAttachments)
    if (attErr) return sendError(res, 400, attErr.code, attErr.message)
    contextAttachments = data.contextAttachments as ContextAttachmentInput[]
  }

  if (data.chatMode !== undefined && data.chatMode !== null && !isValidPromptName(data.chatMode)) {
    return sendError(res, 400, 'validation_error', 'chatMode inválido.')
  }

  const clientMessageId = narrowClientMessageId(data.clientMessageId)
  if (!clientMessageId.ok) {
    return sendError(res, 400, 'validation_error', 'clientMessageId deve ser texto curto não vazio.')
  }

  try {
    const thread = await dispatchNewThread({
      projectId,
      prompt: data.prompt,
      clientMessageId: clientMessageId.value,
      provider,
      model: data.model ?? null,
      reasoningLevel: data.reasoningLevel ?? null,
      accessLevel: data.accessLevel as DispatchNewThreadInput['accessLevel'],
      executionMode: data.executionMode as DispatchNewThreadInput['executionMode'],
      images,
      contextAttachments,
      chatMode: data.chatMode ?? null,
    })
    sendJson(res, 201, { thread, stream: streamPathFor(thread.id) })
  } catch (err) {
    handleDispatchError(res, err)
  }
}

interface FollowUpBody {
  prompt?: string
  provider?: string
  model?: string | null
  reasoningLevel?: string | null
  accessLevel?: string
  executionMode?: string
  images?: unknown[]
  contextAttachments?: unknown
  chatMode?: string | null
  clientMessageId?: unknown
}

async function handleFollowUp(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const data = parseBody<FollowUpBody>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')

  if (data.provider !== undefined) {
    return sendError(res, 400, 'validation_error', 'provider é imutável após a criação da thread.')
  }
  if (data.executionMode !== undefined) {
    return sendError(res, 400, 'validation_error', 'executionMode é travado após o primeiro envio.')
  }
  if (typeof data.prompt !== 'string' || data.prompt.trim() === '') {
    return sendError(res, 400, 'validation_error', 'prompt é obrigatório.')
  }
  if (data.accessLevel !== undefined && !(ACCESS_LEVELS as readonly string[]).includes(data.accessLevel)) {
    return sendError(res, 400, 'validation_error', 'accessLevel inválido.')
  }

  const existingThread = getThread(threadId)
  if (existingThread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')

  if (data.model !== undefined && data.model !== null && !isValidModel(existingThread.provider, data.model)) {
    return sendError(res, 400, 'validation_error', 'model fora do catálogo do provider.')
  }
  if (
    data.reasoningLevel !== undefined &&
    data.reasoningLevel !== null &&
    !isValidReasoningLevel(existingThread.provider, data.reasoningLevel)
  ) {
    return sendError(res, 400, 'validation_error', 'reasoningLevel fora do catálogo do provider.')
  }

  let images: ComposerImageInput[] | undefined
  if (data.images !== undefined && data.images.length > 0) {
    if (!isMultimodal(existingThread.provider)) {
      return sendError(
        res,
        400,
        'image_not_supported',
        `Provider "${existingThread.provider}" não aceita anexos de imagem.`
      )
    }
    const imgErr = validateComposerImages(data.images)
    if (imgErr) return sendError(res, 400, imgErr.code, imgErr.message)
    images = data.images as ComposerImageInput[]
  }

  if (data.contextAttachments !== undefined) {
    const attErr = validateContextAttachments(data.contextAttachments)
    if (attErr) return sendError(res, 400, attErr.code, attErr.message)
  }

  if (data.chatMode !== undefined && data.chatMode !== null && !isValidPromptName(data.chatMode)) {
    return sendError(res, 400, 'validation_error', 'chatMode inválido.')
  }

  const clientMessageId = narrowClientMessageId(data.clientMessageId)
  if (!clientMessageId.ok) {
    return sendError(res, 400, 'validation_error', 'clientMessageId deve ser texto curto não vazio.')
  }

  const input: DispatchFollowUpInput = {
    threadId,
    prompt: data.prompt,
    clientMessageId: clientMessageId.value,
  }
  if (data.chatMode !== undefined) input.chatMode = data.chatMode
  if (data.contextAttachments !== undefined) {
    input.contextAttachments = data.contextAttachments as ContextAttachmentInput[]
  }
  if (data.model !== undefined) input.model = data.model
  if (data.reasoningLevel !== undefined) input.reasoningLevel = data.reasoningLevel
  if (data.accessLevel !== undefined) input.accessLevel = data.accessLevel as DispatchFollowUpInput['accessLevel']
  if (images) input.images = images

  try {
    const thread = dispatchFollowUp(input)
    sendJson(res, 201, { thread, stream: streamPathFor(thread.id) })
  } catch (err) {
    handleDispatchError(res, err)
  }
}

/** `?q=` filtra por título ou conteúdo de mensagem (busca de conversas, F28 Onda 2). */
function handleListThreads(req: IncomingMessage, res: ServerResponse, projectId: string): void {
  const query = new URL(req.url ?? '', 'http://127.0.0.1').searchParams.get('q')
  const threads = query === null || query.trim() === ''
    ? listThreadsForProject(projectId)
    : searchThreadsForProject(projectId, query)
  sendJson(res, 200, { threads })
}

interface RenameThreadBody {
  title?: unknown
}

const MAX_THREAD_TITLE = 120

/** Renomear conversa — título vazio volta ao automático (null). */
async function handleRenameThread(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')

  const data = parseBody<RenameThreadBody>(await readBody(req))
  if (data === null || data.title === undefined) {
    return sendError(res, 400, 'validation_error', 'Informe title.')
  }
  if (data.title !== null && typeof data.title !== 'string') {
    return sendError(res, 400, 'validation_error', 'title deve ser texto ou null.')
  }
  const raw = typeof data.title === 'string' ? data.title.trim() : ''
  if (raw.length > MAX_THREAD_TITLE) {
    return sendError(res, 400, 'validation_error', `title excede ${MAX_THREAD_TITLE} caracteres.`)
  }

  const updated = updateThread(threadId, { title: raw === '' ? null : raw })
  if (updated === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')
  sendJson(res, 200, { thread: updated })
}

/**
 * Exporta a conversa em markdown (leitura) ou json (histórico cru).
 * Permitido em qualquer estado (running / waiting_permission / cancelled / idle / …):
 * o snapshot usa o histórico persistido; buildExportSnapshot assenta tools órfãs em cancelled.
 */
function handleExportThread(req: IncomingMessage, res: ServerResponse, threadId: string): void {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')

  const format = new URL(req.url ?? '', 'http://127.0.0.1').searchParams.get('format') ?? 'md'
  if (format !== 'md' && format !== 'json') {
    return sendError(res, 400, 'validation_error', 'format deve ser md ou json.')
  }

  const input = buildExportSnapshot({
    thread,
    messages: listMessagesForThread(threadId),
    toolCalls: listToolCallsForThread(threadId),
  })
  sendJson(res, 200, {
    fileName: exportFileName(thread, format),
    format,
    content: format === 'md' ? exportThreadAsMarkdown(input) : exportThreadAsJson(input),
  })
}

/** Cache por turno: a mesma última resposta não gera duas vezes (a UI pode remontar). */

/**
 * Sugestões de próximo passo. Só com a thread assentada — durante o turno a resposta ainda muda,
 * e gerar ali competiria com o agente pelo provider.
 */
async function handleFollowups(_req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')
  if (
    thread.state === 'running' ||
    thread.state === 'stopping' ||
    thread.state === 'waiting_user' ||
    thread.state === 'waiting_permission'
  ) {
    return sendJson(res, 200, { followups: [], messageId: null })
  }

  const messages = listMessagesForThread(threadId)
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  if (lastAssistant === undefined || (lastAssistant.content ?? '').trim() === '') {
    return sendJson(res, 200, { followups: [], messageId: null })
  }

  const project = getProject(thread.projectId)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')

  // Normalmente já resolvido: o fim do turno adianta a geração (`primeFollowupsForTurn`).
  const followups = await primeFollowupsForTurn({
    thread,
    project,
    messageId: lastAssistant.id,
    lastUserMessage: lastUser?.content ?? '',
    lastAssistantMessage: lastAssistant.content ?? '',
  })

  sendJson(res, 200, { followups, messageId: lastAssistant.id })
}

interface FeedbackBody {
  vote?: unknown
  note?: unknown
}

/** Voto por resposta: `up`/`down` grava, `null` limpa (toggle vindo da UI). */
async function handleMessageFeedback(
  req: IncomingMessage,
  res: ServerResponse,
  threadId: string,
  messageId: string
): Promise<void> {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')

  const message = listMessagesForThread(threadId).find((m) => m.id === messageId)
  if (message === undefined) return sendError(res, 404, 'message_not_found', 'Mensagem não encontrada nesta thread.')
  if (message.role !== 'assistant') {
    return sendError(res, 400, 'validation_error', 'Só respostas do agente recebem voto.')
  }

  const data = parseBody<FeedbackBody>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')

  if (data.vote === null) {
    clearMessageFeedback(messageId)
    return sendJson(res, 200, { feedback: null })
  }
  if (data.vote !== 'up' && data.vote !== 'down') {
    return sendError(res, 400, 'validation_error', 'vote deve ser up, down ou null.')
  }
  if (data.note !== undefined && data.note !== null && typeof data.note !== 'string') {
    return sendError(res, 400, 'validation_error', 'note deve ser texto.')
  }

  const feedback = setMessageFeedback({
    messageId,
    threadId,
    vote: data.vote,
    note: typeof data.note === 'string' ? data.note.slice(0, 2000) : null,
  })
  sendJson(res, 200, { feedback })
}

/** Pipeline mais recente da thread (rodando ou já encerrado) + estágios — rehydrate de UI (spec F22 §4). */
function resolveHistoryPipeline(threadId: string): { pipeline: Pipeline; stages: PipelineStage[] } | null {
  const pipeline = listPipelinesForThread(threadId)[0]
  if (pipeline === undefined) return null
  return { pipeline, stages: listStagesForPipeline(pipeline.id) }
}

function handleHistory(_req: IncomingMessage, res: ServerResponse, threadId: string): void {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')
  sendJson(res, 200, {
    messages: listMessagesForThread(threadId),
    feedback: listFeedbackForThread(threadId),
    toolCalls: listToolCallsForThread(threadId),
    subagentRuns: listSubagentRunsForParentThread(threadId),
    pipeline: resolveHistoryPipeline(threadId),
  })
}

function handleDiffsList(_req: IncomingMessage, res: ServerResponse, threadId: string): void {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')
  sendJson(res, 200, { diffs: listDiffsForThread(threadId) })
}

function handleCancel(_req: IncomingMessage, res: ServerResponse, threadId: string): void {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')
  const cancelled = cancelThread(threadId)
  sendJson(res, 200, { cancelled })
}

/**
 * GET /api/threads/:id/gate — snapshot unificado dos gates abertos (permissão **e** pergunta), na
 * ordem em que foram abertos. É a fonte do card na abertura da thread e depois de um reconnect, e
 * o que permite remontar mais de um card de uma vez.
 */
function handleListGates(_req: IncomingMessage, res: ServerResponse, threadId: string): void {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')
  sendJson(res, 200, { gates: listOpenGates(threadId) })
}

interface ResolveGateBody {
  kind?: unknown
  /** kind='permission' */
  allow?: unknown
  always?: unknown
  scope?: unknown
  /** kind='question' */
  selectedOptions?: unknown
  freeText?: unknown
}

/**
 * POST /api/threads/:id/gate/:gateId/resolve — resolve **um** gate identificado, com corpo
 * discriminado por `kind`. Única rota de resolução: é o `gateId` do card em tela que chega aqui,
 * então nunca há heurística de "o pedido mais recente da thread".
 *
 * O vínculo thread × gate é validado dentro do gate (`thread_mismatch` → o gate continua pendente
 * para a thread dona), nunca aqui.
 */
async function handleResolveGate(
  req: IncomingMessage,
  res: ServerResponse,
  threadId: string,
  gateId: string
): Promise<void> {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')

  const data = parseBody<ResolveGateBody>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  if (data.kind !== 'permission' && data.kind !== 'question') {
    return sendError(res, 400, 'validation_error', 'kind deve ser "permission" ou "question".')
  }

  if (data.kind === 'permission') {
    if (typeof data.allow !== 'boolean') {
      return sendError(res, 400, 'validation_error', 'allow deve ser booleano.')
    }
    if (data.always !== undefined && typeof data.always !== 'boolean') {
      return sendError(res, 400, 'validation_error', 'always deve ser booleano.')
    }
    if (data.always === true && data.allow !== true) {
      return sendError(res, 400, 'validation_error', 'always exige allow=true.')
    }

    const allow = data.allow
    const scope = data.scope === 'project' ? 'project' : 'thread'
    const resolved = resolvePermissionGate(threadId, gateId, allow, {
      onGranted:
        data.always === true ? ({ toolName }) => grantAlwaysAllowedTool(threadId, toolName, scope) : undefined,
    })
    if (!resolved.ok) return sendGateResolveError(res, resolved.code)
    return sendJson(res, 200, { resolved: true, kind: 'permission', always: data.always === true, toolName: resolved.toolName })
  }

  const selectedOptions = Array.isArray(data.selectedOptions)
    ? data.selectedOptions.filter((o): o is string => typeof o === 'string')
    : []
  const freeText = typeof data.freeText === 'string' ? data.freeText.trim() : ''
  if (selectedOptions.length === 0 && freeText === '') {
    return sendError(res, 400, 'validation_error', 'Envie ao menos uma opção marcada ou um texto livre.')
  }

  // Defesa em profundidade (spec F21 §3.3), contra o payload do próprio gate — a pergunta que o
  // MCP registrou, não o que o cliente diz que perguntou. Gate sem `options` (checkpoint de
  // pipeline) não restringe nada.
  const target = listOpenGates(threadId).find((g) => g.gateId === gateId)
  const allowedOptions = (target?.payload as { options?: unknown } | null | undefined)?.options
  if (Array.isArray(allowedOptions) && allowedOptions.length > 0) {
    if (selectedOptions.some((o) => !allowedOptions.includes(o))) {
      return sendError(res, 400, 'validation_error', 'selectedOptions fora das opções da pergunta pendente.')
    }
  }

  const answer: GateAnswer = { selectedOptions, freeText: freeText || null }
  const resolved = resolveQuestionGate(threadId, gateId, answer)
  if (!resolved.ok) return sendGateResolveError(res, resolved.code)
  sendJson(res, 200, { resolved: true, kind: 'question' })
}

function sendGateResolveError(res: ServerResponse, code: 'not_found' | 'thread_mismatch'): void {
  if (code === 'thread_mismatch') {
    return sendError(res, 409, 'gate_thread_mismatch', 'Este gate pertence a outra thread e continua pendente lá.')
  }
  sendError(res, 409, 'gate_not_found', 'Nenhum gate aberto com este id para esta thread.')
}

interface PatchThreadBody {
  accessLevel?: string
}

/**
 * PATCH /api/threads/:id — persiste Access sem exigir follow-up (pill no composer).
 * Upgrade fora de supervised libera permissões pendentes do turno atual.
 */
async function handlePatchThread(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')

  const data = parseBody<PatchThreadBody>(await readBody(req))
  if (data === null || data.accessLevel === undefined) {
    return sendError(res, 400, 'validation_error', 'Informe accessLevel.')
  }
  if (!(ACCESS_LEVELS as readonly string[]).includes(data.accessLevel)) {
    return sendError(res, 400, 'validation_error', 'accessLevel inválido.')
  }

  const nextAccess = data.accessLevel as (typeof ACCESS_LEVELS)[number]
  const previousAccess = thread.accessLevel
  const updated = updateThread(threadId, { accessLevel: nextAccess })
  if (updated === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')

  // Trocar o nível mid-turn libera o que o novo nível auto-aprova (edição em auto-accept-edits,
  // tudo em full-access); o resto continua no card em vez de passar em silêncio.
  // `gate.resolved` de cada gate liberado sai de dentro de `allowOpenPermissionGates`.
  if (nextAccess !== previousAccess) allowOpenPermissionGates(threadId, nextAccess)

  sendJson(res, 200, { thread: updated })
}

interface AcceptBody {
  action?: string
  ids?: string[]
  paths?: string[]
}

async function handleAccept(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const data = parseBody<AcceptBody>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')

  if (data.action !== undefined && data.action !== 'accept' && data.action !== 'reject') {
    return sendError(res, 400, 'validation_error', 'action deve ser "accept" ou "reject".')
  }

  if (
    data.ids !== undefined &&
    !(Array.isArray(data.ids) && data.ids.every((i) => typeof i === 'string'))
  ) {
    return sendError(res, 400, 'validation_error', 'ids deve ser um array de strings.')
  }
  if (
    data.paths !== undefined &&
    !(Array.isArray(data.paths) && data.paths.every((p) => typeof p === 'string'))
  ) {
    return sendError(res, 400, 'validation_error', 'paths deve ser um array de strings.')
  }

  const input: AcceptDiffInput = { threadId }
  if (data.action !== undefined) input.action = data.action as AcceptDiffInput['action']
  if (data.ids !== undefined) input.ids = data.ids
  if (data.paths !== undefined) input.paths = data.paths

  try {
    const result = await applyDiffAction(input)
    sendJson(res, 200, result)
  } catch (err) {
    handleAcceptError(res, err)
  }
}

interface ResolveConflictBody {
  winningChildThreadId?: string
}

/** POST /api/threads/:id/diffs/:diffId/resolve-conflict (spec F18 §5.2): escolhe o vencedor do merge paralelo. */
async function handleResolveConflict(
  req: IncomingMessage,
  res: ServerResponse,
  threadId: string,
  diffId: string
): Promise<void> {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')
  const project = getProject(thread.projectId)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')

  const data = parseBody<ResolveConflictBody>(await readBody(req))
  if (data === null || typeof data.winningChildThreadId !== 'string' || data.winningChildThreadId.trim() === '') {
    return sendError(res, 400, 'validation_error', 'winningChildThreadId é obrigatório.')
  }

  try {
    acquireLease(project.id, 'agent', 'resolve-conflict', threadId)
  } catch (err) {
    if (err instanceof LeaseBusyError) {
      sendError(res, 409, 'thread_busy', err.message, threadBusyDetails(err))
      return
    }
    throw err
  }

  try {
    const parentCwd = resolveThreadCwd(thread, project)
    const diff = resolveParallelConflict(threadId, diffId, data.winningChildThreadId, parentCwd)
    emit(threadId, { type: 'diff.ready', threadId, diffId: diff.id, file: diff.file })
    sendJson(res, 200, { diff })
  } catch (err) {
    if (err instanceof DiffConflictResolutionError) {
      const status = err.code === 'diff_not_found' ? 404 : err.code === 'diff_not_conflict' ? 409 : 400
      sendError(res, status, err.code, err.message)
      return
    }
    throw err
  } finally {
    releaseLease(project.id)
  }
}

/** DELETE /api/threads/:id (spec F13 §5): apaga a thread e limpa a worktree quando seguro. */
async function handleDeleteThread(_req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')

  const project = getProject(thread.projectId)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')

  try {
    acquireLease(project.id, 'git', 'delete-thread', threadId)
  } catch (err) {
    if (err instanceof LeaseBusyError) {
      sendError(res, 409, 'thread_busy', err.message, threadBusyDetails(err))
      return
    }
    throw err
  }

  try {
    const cleanup = await removeWorktreeIfSafe(project.path, thread.worktreePath, thread.id)
    deleteDiffsForThread(thread.id)
    clearAllowedToolsForThread(thread.id)
    clearBrokerGrantsForThread(thread.id)
    deleteThread(thread.id)
    sendJson(res, 200, {
      deleted: true,
      worktreeCleanup: cleanup.result,
      warning: cleanup.warning,
    })
  } finally {
    releaseLease(project.id)
  }
}

// ── Router ──────────────────────────────────────────────────────────────────

const CREATE_THREAD_RE = /^\/api\/projects\/([^/]+)\/threads$/
const THREAD_RE = /^\/api\/threads\/([^/]+)$/
const MESSAGES_RE = /^\/api\/threads\/([^/]+)\/messages$/
const HISTORY_RE = /^\/api\/threads\/([^/]+)\/history$/
const DIFFS_RE = /^\/api\/threads\/([^/]+)\/diffs$/
const CANCEL_RE = /^\/api\/threads\/([^/]+)\/cancel$/
const GATES_LIST_RE = /^\/api\/threads\/([^/]+)\/gate$/
const GATE_RESOLVE_RE = /^\/api\/threads\/([^/]+)\/gate\/([^/]+)\/resolve$/
const ACCEPT_RE = /^\/api\/threads\/([^/]+)\/accept$/
const RESOLVE_CONFLICT_RE = /^\/api\/threads\/([^/]+)\/diffs\/([^/]+)\/resolve-conflict$/
const COMPOSER_CATALOG_RE = /^\/api\/composer\/catalog$/
const RENAME_RE = /^\/api\/threads\/([^/]+)\/title$/
const EXPORT_RE = /^\/api\/threads\/([^/]+)\/export$/
const FEEDBACK_RE = /^\/api\/threads\/([^/]+)\/messages\/([^/]+)\/feedback$/
const FOLLOWUPS_RE = /^\/api\/threads\/([^/]+)\/followups$/

export async function handleThreadsRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  const matchesThreadsRoute =
    CREATE_THREAD_RE.test(url) ||
    THREAD_RE.test(url) ||
    MESSAGES_RE.test(url) ||
    HISTORY_RE.test(url) ||
    DIFFS_RE.test(url) ||
    CANCEL_RE.test(url) ||
    // Rota nova entra nas DUAS listas (esta e o dispatch abaixo): sem o prefixo aqui o guarda
    // devolve false antes do dispatch e o request fica pendurado sem resposta nenhuma.
    GATES_LIST_RE.test(url) ||
    GATE_RESOLVE_RE.test(url) ||
    ACCEPT_RE.test(url) ||
    RESOLVE_CONFLICT_RE.test(url) ||
    RENAME_RE.test(url) ||
    EXPORT_RE.test(url) ||
    FEEDBACK_RE.test(url) ||
    FOLLOWUPS_RE.test(url) ||
    COMPOSER_CATALOG_RE.test(url)

  if (!matchesThreadsRoute) return false

  if (!guard(req, res)) return true

  try {
    if (COMPOSER_CATALOG_RE.test(url) && method === 'GET') {
      sendJson(res, 200, getComposerCatalog())
      return true
    }

    const createMatch = CREATE_THREAD_RE.exec(url)
    if (createMatch && method === 'POST') {
      await handleCreateThread(req, res, createMatch[1])
      return true
    }
    if (createMatch && method === 'GET') {
      handleListThreads(req, res, createMatch[1])
      return true
    }

    const renameMatch = RENAME_RE.exec(url)
    if (renameMatch && method === 'PATCH') {
      await handleRenameThread(req, res, renameMatch[1])
      return true
    }

    const exportMatch = EXPORT_RE.exec(url)
    if (exportMatch && method === 'GET') {
      handleExportThread(req, res, exportMatch[1])
      return true
    }

    const feedbackMatch = FEEDBACK_RE.exec(url)
    if (feedbackMatch && method === 'POST') {
      await handleMessageFeedback(req, res, feedbackMatch[1], feedbackMatch[2])
      return true
    }

    const followupsMatch = FOLLOWUPS_RE.exec(url)
    if (followupsMatch && method === 'GET') {
      await handleFollowups(req, res, followupsMatch[1])
      return true
    }

    const threadMatch = THREAD_RE.exec(url)
    if (threadMatch && method === 'DELETE') {
      await handleDeleteThread(req, res, threadMatch[1])
      return true
    }
    if (threadMatch && method === 'PATCH') {
      await handlePatchThread(req, res, threadMatch[1])
      return true
    }

    const messagesMatch = MESSAGES_RE.exec(url)
    if (messagesMatch && method === 'POST') {
      await handleFollowUp(req, res, messagesMatch[1])
      return true
    }

    const historyMatch = HISTORY_RE.exec(url)
    if (historyMatch && method === 'GET') {
      handleHistory(req, res, historyMatch[1])
      return true
    }

    const diffsMatch = DIFFS_RE.exec(url)
    if (diffsMatch && method === 'GET') {
      handleDiffsList(req, res, diffsMatch[1])
      return true
    }

    const cancelMatch = CANCEL_RE.exec(url)
    if (cancelMatch && method === 'POST') {
      handleCancel(req, res, cancelMatch[1])
      return true
    }

    const gatesListMatch = GATES_LIST_RE.exec(url)
    if (gatesListMatch && method === 'GET') {
      handleListGates(req, res, gatesListMatch[1])
      return true
    }

    const gateResolveMatch = GATE_RESOLVE_RE.exec(url)
    if (gateResolveMatch && method === 'POST') {
      await handleResolveGate(req, res, gateResolveMatch[1], gateResolveMatch[2])
      return true
    }

    const acceptMatch = ACCEPT_RE.exec(url)
    if (acceptMatch && method === 'POST') {
      await handleAccept(req, res, acceptMatch[1])
      return true
    }

    const resolveConflictMatch = RESOLVE_CONFLICT_RE.exec(url)
    if (resolveConflictMatch && method === 'POST') {
      await handleResolveConflict(req, res, resolveConflictMatch[1], resolveConflictMatch[2])
      return true
    }
  } catch (err) {
    if (sendTransportError(res, err)) return true
    console.error('[threads-handler] Unhandled error:', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    return true
  }

  return false
}

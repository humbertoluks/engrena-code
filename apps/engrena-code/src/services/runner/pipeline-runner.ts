import type { Project } from '../db/repositories/projects.js'
import { updateThread, type Thread } from '../db/repositories/threads.js'
import { appendMessage } from '../db/repositories/messages.js'
import { createDiff, countPendingForThread, listDiffsForThread } from '../db/repositories/diffs.js'
import {
  createPipeline,
  updatePipeline,
  createPipelineStage,
  updatePipelineStage,
  type Pipeline,
  type PipelineStageStatus,
  type PipelineStatus,
} from '../db/repositories/pipelines.js'
import { diffWorkingTree } from '../git/git-client.js'
import { resolveThreadCwd } from './thread-cwd.js'
import { emit } from './ws-hub.js'
import { findCatalogSubagent } from './subagent-registry.js'
import { runDelegatedSubagentTurn, type DelegationResult } from './delegate.js'
import { rejectAskUserQuestion, waitForAnswer } from './ask-user-question.js'
import { consumeThreadCancelled, registerActiveController, unregisterActiveController } from './turn-control.js'
import { releaseLease } from './project-execution.js'
import type { SlashCommandName } from './slash-commands.js'

/** Relógio de parede desde `pipelines.started_at` (spec F22 §3.2) — independente do hard-cap por filho (F15). */
export const PIPELINE_HARD_CAP_MS = 2 * 60 * 60 * 1000

let hardCapMsOverride: number | null = null
/** Só para teste — 2h reais é inviável de exercitar sem mockar o relógio. */
export function setPipelineHardCapMsForTesting(ms: number): void {
  hardCapMsOverride = ms
}
export function resetPipelineHardCapMsForTesting(): void {
  hardCapMsOverride = null
}
function currentHardCapMs(): number {
  return hardCapMsOverride ?? PIPELINE_HARD_CAP_MS
}

interface StageDef {
  stageId: string
  subagentName: string
}

const FEATDEVELOP_STAGES: readonly StageDef[] = [
  { stageId: 'planner', subagentName: 'planner' },
  { stageId: 'implementer', subagentName: 'implementer' },
  { stageId: 'reviewer', subagentName: 'reviewer' },
  { stageId: 'tester', subagentName: 'tester' },
]

export interface RunPipelineInput {
  project: Project
  thread: Thread
  command: SlashCommandName
  /** Texto exatamente como o usuário digitou (`/comando args…`) — vai pra `messages` como está. */
  prompt: string
  argsText: string
}

export class PipelineSubagentMissingError extends Error {
  code = 'pipeline_subagent_missing'
}

export class PipelineStageFailedError extends Error {
  code = 'pipeline_stage_failed'
}

class PipelineCancelledError extends Error {}
class PipelineHardCapError extends Error {}

function abortRejection(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(new PipelineCancelledError('Pipeline cancelado.'))
      return
    }
    signal.addEventListener('abort', () => reject(new PipelineCancelledError('Pipeline cancelado.')), { once: true })
  })
}

function hardCapRejection(remainingMs: number): { promise: Promise<never>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout>
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PipelineHardCapError('Pipeline excedeu o hard-cap de 2h.')), Math.max(0, remainingMs))
  })
  return { promise, cancel: () => clearTimeout(timer) }
}

function stageTotalFor(command: SlashCommandName): number {
  return command === 'featdevelop' ? FEATDEVELOP_STAGES.length : 1
}

/** Só cria diff para paths ainda não registrados nesta thread — evita duplicar (mesma lição do bug real de F18). */
async function captureNewDiffs(threadId: string, cwd: string, provider: string): Promise<void> {
  const files = await diffWorkingTree(cwd)
  if (files.length === 0) return
  const already = new Set(listDiffsForThread(threadId).map((d) => d.file))
  for (const f of files) {
    if (already.has(f.file)) continue
    const row = createDiff({
      threadId,
      file: f.file,
      additions: f.additions,
      deletions: f.deletions,
      hunks: f.hunks,
      provider,
      worktreePath: cwd,
    })
    emit(threadId, { type: 'diff.ready', threadId, diffId: row.id, file: row.file })
  }
}

function emitPipelineState(thread: Thread, pipeline: Pipeline, status: PipelineStatus, stageIndex: number, stageTotal: number): void {
  emit(thread.id, {
    type: 'pipeline.state',
    threadId: thread.id,
    pipelineId: pipeline.id,
    command: pipeline.command,
    status,
    stageIndex,
    stageTotal,
  })
}

interface RunStageParams {
  project: Project
  thread: Thread
  pipeline: Pipeline
  stage: StageDef
  index: number
  total: number
  task: string
  controller: AbortController
}

/**
 * Roda 1 estágio: valida catálogo (F07/F17 nomes canônicos) → cria row `pending` → delega via
 * `runDelegatedSubagentTurn` (mesmo path F15/F18, sem `tasks[]`) → persiste resultado → emite
 * `pipeline.stage`. Lança `PipelineSubagentMissingError`/`PipelineStageFailedError` em falha —
 * quem chama decide o destino do pipeline inteiro.
 */
async function runStage(params: RunStageParams): Promise<DelegationResult> {
  const { project, thread, pipeline, stage, index, total, task, controller } = params

  const subagent = findCatalogSubagent(project.id, stage.subagentName)
  if (!subagent) {
    throw new PipelineSubagentMissingError(`Subagent "${stage.subagentName}" não encontrado ou não vinculado a este projeto.`)
  }

  const stageRow = createPipelineStage({
    pipelineId: pipeline.id,
    stageId: stage.stageId,
    stageIndex: index,
    subagentName: stage.subagentName,
  })
  updatePipelineStage(stageRow.id, { status: 'running', startedAt: Date.now() })
  emit(thread.id, {
    type: 'pipeline.stage',
    threadId: thread.id,
    pipelineId: pipeline.id,
    stageId: stage.stageId,
    index,
    total,
    phase: 'start',
    subagentName: stage.subagentName,
    status: 'running',
  })

  const result = await runDelegatedSubagentTurn(
    { project, parentThread: thread, parentTurnId: pipeline.id },
    { name: stage.subagentName, task },
    { externalSignal: controller.signal }
  )

  // `result.isError` sozinho não basta pra saber se o filho falhou de verdade: por design F15,
  // uma falha/timeout do filho ainda devolve `isError: false` (o tool call em si "funcionou", só
  // o trabalho do filho que não terminou) — `result.status` é o status real do run persistido.
  const finalStatus: PipelineStageStatus =
    result.status === 'completed' || (result.status === undefined && !result.isError)
      ? 'completed'
      : result.status === 'timeout'
        ? 'timeout'
        : 'failed'
  updatePipelineStage(stageRow.id, {
    status: finalStatus,
    finishedAt: Date.now(),
    // F29: liga stage → subagent_runs.child_thread_id (coluna já existia desde F22, nunca populada).
    ...(result.childThreadId ? { subagentRunId: result.childThreadId } : {}),
  })
  emit(thread.id, {
    type: 'pipeline.stage',
    threadId: thread.id,
    pipelineId: pipeline.id,
    stageId: stage.stageId,
    index,
    total,
    phase: finalStatus === 'completed' ? 'done' : finalStatus === 'timeout' ? 'timeout' : 'error',
    subagentName: stage.subagentName,
    status: finalStatus,
  })

  if (finalStatus !== 'completed') {
    throw new PipelineStageFailedError(result.text)
  }

  return result
}

function checkHardCap(pipeline: Pipeline): void {
  if (Date.now() - pipeline.startedAt >= currentHardCapMs()) {
    throw new PipelineHardCapError('Pipeline excedeu o hard-cap de 2h.')
  }
}

/**
 * Pausa em `waiting_user` (F21, reaproveitando `waitForAnswer` fora de qualquer tool-call ao vivo)
 * até a UI responder via `POST /answer`, cancelamento ou hard-cap — o que vier primeiro.
 */
async function runCheckpoint(
  thread: Thread,
  pipeline: Pipeline,
  stage: StageDef,
  stageIndex: number,
  stageTotal: number,
  controller: AbortController
): Promise<void> {
  updatePipeline(pipeline.id, { status: 'waiting_checkpoint' })
  updateThread(thread.id, { state: 'waiting_user' })
  emit(thread.id, { type: 'state.change', threadId: thread.id, state: 'waiting_user' })
  emitPipelineState(thread, pipeline, 'waiting_checkpoint', stageIndex, stageTotal)
  emit(thread.id, {
    type: 'pipeline.stage',
    threadId: thread.id,
    pipelineId: pipeline.id,
    stageId: stage.stageId,
    index: stageIndex,
    total: stageTotal,
    phase: 'waiting_checkpoint',
    subagentName: stage.subagentName,
    status: 'waiting_checkpoint',
  })

  const remaining = currentHardCapMs() - (Date.now() - pipeline.startedAt)
  const { promise: capPromise, cancel: cancelCap } = hardCapRejection(remaining)
  try {
    await Promise.race([waitForAnswer(thread.id), abortRejection(controller.signal), capPromise])
  } catch (err) {
    rejectAskUserQuestion(thread.id, 'Checkpoint do pipeline interrompido.')
    throw err
  } finally {
    cancelCap()
  }

  updatePipeline(pipeline.id, { status: 'running' })
  updateThread(thread.id, { state: 'running' })
  emit(thread.id, { type: 'state.change', threadId: thread.id, state: 'running' })
}

function buildStageTask(stageId: string, argsText: string, priorText: string): string {
  switch (stageId) {
    case 'planner':
      return `Planeje a implementação do pedido a seguir; devolva um plano de passos claro.\n\nPedido: ${argsText}`
    case 'implementer':
      return `Implemente conforme o plano abaixo. Pedido original: ${argsText}\n\nPlano do estágio anterior:\n${priorText}`
    case 'reviewer':
      return `Revise as mudanças feitas para o pedido a seguir e aponte problemas relevantes.\n\nPedido: ${argsText}\n\nResumo do implementador:\n${priorText}`
    case 'tester':
      return `Escreva e/ou rode os testes necessários para validar o pedido a seguir.\n\nPedido: ${argsText}\n\nResumo do revisor:\n${priorText}`
    default:
      return argsText
  }
}

async function runSpec(project: Project, thread: Thread, pipeline: Pipeline, argsText: string, controller: AbortController): Promise<string> {
  const task = `Gere uma spec técnica (spec.md) e um plano de implementação (plan.md) como texto estruturado para o pedido a seguir. Devolva dois blocos markdown claramente delimitados com os headings "## spec.md" e "## plan.md". Não grave nenhum ficheiro no disco — a resposta deve ser só o texto.\n\nPedido: ${argsText}`
  const result = await runStage({
    project,
    thread,
    pipeline,
    stage: { stageId: 'planner', subagentName: 'planner' },
    index: 1,
    total: 1,
    task,
    controller,
  })
  return result.text
}

async function runFeatdevelop(project: Project, thread: Thread, pipeline: Pipeline, argsText: string, controller: AbortController): Promise<string> {
  const total = FEATDEVELOP_STAGES.length
  const cwd = resolveThreadCwd(thread, project)
  let lastText = ''

  for (let i = 0; i < FEATDEVELOP_STAGES.length; i++) {
    checkHardCap(pipeline)
    const stage = FEATDEVELOP_STAGES[i]
    const index = i + 1
    const task = buildStageTask(stage.stageId, argsText, lastText)
    const result = await runStage({ project, thread, pipeline, stage, index, total, task, controller })
    lastText = result.text

    if (stage.stageId === 'implementer') {
      await captureNewDiffs(thread.id, cwd, thread.provider)
      if (countPendingForThread(thread.id) > 0) {
        await runCheckpoint(thread, pipeline, stage, index, total, controller)
      }
    }
  }

  // Safety net: reviewer/tester raramente escrevem, mas se escreverem, isto captura sem duplicar
  // o que o passo do implementer já registrou (captureNewDiffs só adiciona paths novos).
  await captureNewDiffs(thread.id, cwd, thread.provider)
  return lastText
}

async function runFeatbuild(project: Project, thread: Thread, pipeline: Pipeline, argsText: string, controller: AbortController): Promise<string> {
  const cwd = resolveThreadCwd(thread, project)
  const task = `Execute o plano abaixo exatamente como descrito, sem replanejar.\n\n${argsText}`
  const result = await runStage({
    project,
    thread,
    pipeline,
    stage: { stageId: 'implementer', subagentName: 'implementer' },
    index: 1,
    total: 1,
    task,
    controller,
  })
  // Checkpoint de /featbuild = fluxo DiffViewer F03 normal (spec §3.2): os diffs ficam `pending`
  // pro usuário revisar no próprio painel, sem pausa ativa via F21 como em /featdevelop.
  await captureNewDiffs(thread.id, cwd, thread.provider)
  return result.text
}

/**
 * Entrada única chamada por `dispatch.ts` quando o prompt é um slash nativo válido — substitui o
 * `runTurn` normal para essa thread (spec F22 §2/§3.2). `dispatch.ts` já fez `acquireLease`/criou a
 * thread antes de chamar isto; esta função é dona de liberar a lease no fim, como `runTurn` faz.
 */
export async function runPipelineCommand(input: RunPipelineInput): Promise<void> {
  const { project, thread, command, prompt, argsText } = input
  appendMessage({ threadId: thread.id, role: 'user', content: prompt })

  const controller = new AbortController()
  registerActiveController(thread.id, controller)

  const pipeline = createPipeline({ threadId: thread.id, projectId: project.id, command, argsText })
  const total = stageTotalFor(command)
  emitPipelineState(thread, pipeline, 'running', 0, total)

  try {
    let finalText: string
    if (command === 'spec') finalText = await runSpec(project, thread, pipeline, argsText, controller)
    else if (command === 'featdevelop') finalText = await runFeatdevelop(project, thread, pipeline, argsText, controller)
    else finalText = await runFeatbuild(project, thread, pipeline, argsText, controller)

    updatePipeline(pipeline.id, { status: 'completed', finishedAt: Date.now() })
    if (finalText) appendMessage({ threadId: thread.id, role: 'assistant', content: finalText })
    updateThread(thread.id, { state: 'idle' })
    emit(thread.id, { type: 'state.change', threadId: thread.id, state: 'idle' })
    emitPipelineState(thread, pipeline, 'completed', total, total)
  } catch (err) {
    const wasCancelled = consumeThreadCancelled(thread.id) || err instanceof PipelineCancelledError
    const isTimeout = err instanceof PipelineHardCapError
    const code = err instanceof PipelineSubagentMissingError || err instanceof PipelineStageFailedError ? err.code : null
    const message = err instanceof Error ? err.message : 'Erro desconhecido no pipeline.'

    const status: PipelineStatus = wasCancelled ? 'cancelled' : isTimeout ? 'timeout' : 'failed'
    updatePipeline(pipeline.id, {
      status,
      finishedAt: Date.now(),
      errorCode: code ?? (isTimeout ? 'pipeline_timeout' : wasCancelled ? 'pipeline_cancelled' : 'pipeline_failed'),
      errorMessage: message,
    })

    const threadState = wasCancelled ? 'cancelled' : 'idle'
    updateThread(thread.id, { state: threadState })
    emit(thread.id, { type: 'state.change', threadId: thread.id, state: threadState })

    if (!wasCancelled) {
      appendMessage({ threadId: thread.id, role: 'assistant', content: `Pipeline ${status}: ${message}` })
    }
    emitPipelineState(thread, pipeline, status, 0, total)
  } finally {
    rejectAskUserQuestion(thread.id, 'Pipeline encerrado.')
    unregisterActiveController(thread.id)
    releaseLease(project.id)
  }
}

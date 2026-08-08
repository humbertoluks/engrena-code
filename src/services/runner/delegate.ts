import { randomUUID, randomBytes } from 'crypto'
import http from 'http'
import {
  createSubagentRun,
  getSubagentRun,
  updateSubagentRun,
  type Subagent,
  type SubagentRunStatus,
} from '../db/repositories/subagents.js'
import type { Project } from '../db/repositories/projects.js'
import type { Thread, ThreadAccessLevel, ThreadProvider } from '../db/repositories/threads.js'
import { findCatalogSubagent } from './subagent-registry.js'
import { canDelegateSubagent, type ParentAccessLevel, type ParentProvider } from './subagent-caller-gate.js'
import { createUsageEvent } from '../db/repositories/usage-events.js'
import { resolveBillingMode, resolveProviderApiKey, resolveTurnCost } from './provider-resolution.js'
import { emit } from './ws-hub.js'
import { resolveThreadCwd } from './thread-cwd.js'
import { runCliTurn as defaultRunCliTurn, ProviderError, type ProviderTurnInput } from './providers/cli-driver.js'
import { createWorktree, removeWorktreeIfSafe, WorktreeError } from '../git/worktree.js'
import { diffWorkingTree } from '../git/git-client.js'
import { mergeParallelChildDiffs, type ChildDiffSet } from './parallel-merge.js'

export const DEFAULT_IDLE_TIMEOUT_MINUTES = 20
export const HARD_CAP_MS = 2 * 60 * 60 * 1000

/**
 * Relógio de um run efêmero. A tabela subagent_runs (spec §6) não persiste "última atividade" —
 * é estado de runtime, não precisa sobreviver a restart do processo.
 */
export class DelegatedRun {
  readonly childThreadId: string
  readonly createdAt: number
  private lastActivityAt: number
  private status: SubagentRunStatus = 'running'
  private readonly idleTimeoutMinutes: number | null

  constructor(params: { childThreadId: string; idleTimeoutMinutes: number | null; now?: number }) {
    this.childThreadId = params.childThreadId
    this.idleTimeoutMinutes = params.idleTimeoutMinutes
    this.createdAt = params.now ?? Date.now()
    this.lastActivityAt = this.createdAt
  }

  recordActivity(now: number = Date.now()): void {
    this.lastActivityAt = now
  }

  isIdleTimedOut(now: number = Date.now()): boolean {
    const minutes = this.idleTimeoutMinutes ?? DEFAULT_IDLE_TIMEOUT_MINUTES
    return now - this.lastActivityAt >= minutes * 60_000
  }

  isHardCapped(now: number = Date.now()): boolean {
    return now - this.createdAt >= HARD_CAP_MS
  }

  isTimedOut(now: number = Date.now()): boolean {
    return this.status === 'running' && (this.isIdleTimedOut(now) || this.isHardCapped(now))
  }

  currentStatus(): SubagentRunStatus {
    return this.status
  }

  markStatus(status: SubagentRunStatus): void {
    this.status = status
  }
}

export interface StartDelegatedRunInput {
  parentThreadId: string
  parentToolCallId?: string | null
  subagent: Subagent
  /** Reservado por quem chama quando o worktree do filho precisa existir antes do run (batch paralelo F18). */
  childThreadId?: string
  /** UUID do batch `tasks[]` (spec F18 §3.2); omitido/`null` no path serial F15. */
  parallelBatchId?: string | null
  now?: number
}

export function startDelegatedRun(input: StartDelegatedRunInput): DelegatedRun {
  const now = input.now ?? Date.now()
  const childThreadId = input.childThreadId ?? randomUUID()
  createSubagentRun({
    childThreadId,
    parentThreadId: input.parentThreadId,
    parentToolCallId: input.parentToolCallId ?? null,
    subagentName: input.subagent.name,
    provider: input.subagent.provider,
    model: input.subagent.model,
    reasoningLevel: input.subagent.reasoningLevel,
    status: 'running',
    parallelBatchId: input.parallelBatchId ?? null,
  })
  return new DelegatedRun({
    childThreadId,
    idleTimeoutMinutes: input.subagent.idleTimeoutMinutes,
    now,
  })
}

/** Chamar periodicamente (watchdog) ou sob demanda; persiste + retorna true se o run virou timeout agora. */
export function checkIdleTimeout(run: DelegatedRun, now: number = Date.now()): boolean {
  if (!run.isTimedOut(now)) return false
  updateSubagentRun(run.childThreadId, { status: 'timeout', durationMs: now - run.createdAt })
  run.markStatus('timeout')
  return true
}

export interface CompleteRunResult {
  text: string | null
  actionCount?: number
  usageJson?: string | null
}

export function completeDelegatedRun(run: DelegatedRun, result: CompleteRunResult, now: number = Date.now()): void {
  updateSubagentRun(run.childThreadId, {
    status: 'completed',
    text: result.text,
    actionCount: result.actionCount ?? 0,
    usageJson: result.usageJson ?? null,
    durationMs: now - run.createdAt,
  })
  run.markStatus('completed')
}

export function cancelDelegatedRun(run: DelegatedRun, now: number = Date.now()): void {
  updateSubagentRun(run.childThreadId, { status: 'cancelled', durationMs: now - run.createdAt })
  run.markStatus('cancelled')
}

export function failDelegatedRun(run: DelegatedRun, message: string, now: number = Date.now()): void {
  updateSubagentRun(run.childThreadId, {
    status: 'error',
    text: message,
    durationMs: now - run.createdAt,
  })
  run.markStatus('error')
}

// ── Execução real de call_subagent (spec F11 §2/§3.2) ──────────────────────
//
// Fecha o gap herdado de F03/F07: até aqui, startDelegatedRun/completeDelegatedRun/
// checkIdleTimeout só eram exercitados em teste isolado. runDelegatedSubagentTurn é o
// orquestrador real, chamado pelo servidor de delegação loopback (createDelegationServer)
// que o MCP interno `subagent-mcp-server.ts` invoca via HTTP no `tools/call`.

/** Intervalo do watchdog de idle/hard-cap — mesma constante conceitual da fonte legada. */
const WATCHDOG_INTERVAL_MS = 30_000

/** Injetável para testes — produção usa `runCliTurn` real. */
export type RunCliTurn = typeof defaultRunCliTurn
let runCliTurnImpl: RunCliTurn = defaultRunCliTurn
export function setRunCliTurnForTesting(fn: RunCliTurn): void {
  runCliTurnImpl = fn
}
export function resetRunCliTurnForTesting(): void {
  runCliTurnImpl = defaultRunCliTurn
}

export interface DelegationContext {
  project: Project
  parentThread: Thread
  /** `turnId` do turno pai (dispatch.ts) — liga o usage_event do subagent ao mesmo turno. */
  parentTurnId: string
  /**
   * Lido no momento em que a delegação inicia (spec F15 §3.2 "quando disponível") — dispatch.ts
   * mantém o id da última tool-call `call_subagent` vista no stream do pai. Como as delegações no
   * mesmo turno são serializadas em FIFO (createDelegationServer) e o evento tool-start do pai
   * chega antes do MCP filho abrir a chamada HTTP `/delegate`, o valor lido aqui é o correto na
   * grande maioria dos casos; sem correlação exata, `parentToolCallId` fica `null` (UI casa por
   * ordem/nome como fallback).
   */
  getParentToolCallId?: () => string | null
}

export interface DelegationRequest {
  name: string
  task: string
  context?: string
}

export interface DelegationResult {
  text: string
  isError?: boolean
}

function resolveChildProvider(subagent: Subagent, parentProvider: ThreadProvider): ThreadProvider {
  return subagent.provider === 'inherit' ? parentProvider : subagent.provider
}

export interface DelegationRunOptions {
  /** Worktree já criado do filho (batch paralelo F18) — quando ausente, usa `resolveThreadCwd(pai)` (path serial F15). */
  childThreadId?: string
  cwdOverride?: string
  parallelBatchId?: string | null
}

/**
 * Gate → resolve subagent do catálogo do projeto → spawna o turno filho via `runCliTurnImpl`
 * direto (sem diffs/lease/`--mcp-config` — profundidade 1 estrutural, spec F11 §3.2) → watchdog
 * idle/hard-cap reusando `checkIdleTimeout` já testado → persiste `subagent_runs` +
 * `usage_event source='subagent'` → devolve o texto final pro MCP interno (que devolve ao pai).
 * Bloqueante para quem chama (mesma semântica MCP tool-call→tool-result da fonte).
 */
export async function runDelegatedSubagentTurn(
  ctx: DelegationContext,
  request: DelegationRequest,
  options: DelegationRunOptions = {}
): Promise<DelegationResult> {
  const gate = canDelegateSubagent({
    provider: ctx.parentThread.provider as ParentProvider,
    accessLevel: ctx.parentThread.accessLevel as ParentAccessLevel,
  })
  if (!gate.allowed) {
    return {
      text: gate.reason ?? 'Delegação de subagent bloqueada para este provider/access level.',
      isError: true,
    }
  }

  const subagent = findCatalogSubagent(ctx.project.id, request.name)
  if (!subagent) {
    return {
      text: `Subagent "${request.name}" não encontrado ou não vinculado a este projeto.`,
      isError: true,
    }
  }

  const provider = resolveChildProvider(subagent, ctx.parentThread.provider)
  const model = subagent.model
  const cwd = options.cwdOverride ?? resolveThreadCwd(ctx.parentThread, ctx.project)

  const run = startDelegatedRun({
    parentThreadId: ctx.parentThread.id,
    parentToolCallId: ctx.getParentToolCallId?.() ?? null,
    subagent,
    childThreadId: options.childThreadId,
    parallelBatchId: options.parallelBatchId,
  })

  emit(ctx.parentThread.id, {
    type: 'subagent.start',
    threadId: ctx.parentThread.id,
    childThreadId: run.childThreadId,
    name: subagent.name,
    parallelBatchId: options.parallelBatchId ?? null,
  })

  const controller = new AbortController()
  const watchdog = setInterval(() => {
    if (checkIdleTimeout(run) && !controller.signal.aborted) {
      controller.abort()
    }
  }, WATCHDOG_INTERVAL_MS)

  let assistantText = ''
  const turnInput: ProviderTurnInput = {
    provider,
    cwd,
    prompt: request.context ? `${request.task}\n\n${request.context}` : request.task,
    systemPrompt: subagent.prompt,
    model,
    accessLevel: ctx.parentThread.accessLevel as ThreadAccessLevel,
    apiKey: resolveProviderApiKey(provider),
    // Sem mcpServers: nem MCPs externos do projeto (F09) nem call_subagent recursivo chegam ao
    // filho — omitir --mcp-config é o mecanismo estrutural que impede profundidade > 1 (spec §3.2).
    signal: controller.signal,
    onEvent: (event) => {
      // Idle = silêncio de stream (spec F15 §3.2): qualquer evento do filho conta como atividade,
      // não só texto — evita timeout de um filho ativo em tool calls longas sem texto.
      run.recordActivity()
      if (event.type === 'text-delta') assistantText += event.text
    },
  }

  const persistSubagentUsage = (
    usage: NonNullable<Awaited<ReturnType<RunCliTurn>>['usage']>,
    sdkCostUsd: number | null | undefined
  ) => {
    const cost = resolveTurnCost(provider, model, usage, sdkCostUsd)
    createUsageEvent({
      turnId: ctx.parentTurnId,
      projectId: ctx.project.id,
      threadId: ctx.parentThread.id,
      source: 'subagent',
      subagentName: subagent.name,
      provider,
      model,
      billingMode: resolveBillingMode(provider),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheCreationTokens: usage.cacheCreationTokens,
      ...cost,
    })
  }

  try {
    const result = await runCliTurnImpl(turnInput)
    clearInterval(watchdog)
    const finalText = result.text || assistantText

    if (run.currentStatus() === 'running') {
      completeDelegatedRun(run, {
        text: finalText,
        usageJson: result.usage ? JSON.stringify(result.usage) : null,
      })
    }
    if (result.usage) persistSubagentUsage(result.usage, result.costUsd)

    emit(ctx.parentThread.id, {
      type: 'subagent.result',
      threadId: ctx.parentThread.id,
      childThreadId: run.childThreadId,
      status: run.currentStatus(),
      parallelBatchId: options.parallelBatchId ?? null,
    })

    return { text: finalText }
  } catch (err) {
    clearInterval(watchdog)
    const message = err instanceof Error ? err.message : 'Erro desconhecido no subagent.'

    if (run.currentStatus() === 'running') {
      failDelegatedRun(run, message)
    }
    if (err instanceof ProviderError && err.usage) persistSubagentUsage(err.usage, err.costUsd)

    emit(ctx.parentThread.id, {
      type: 'subagent.result',
      threadId: ctx.parentThread.id,
      childThreadId: run.childThreadId,
      status: run.currentStatus(),
      parallelBatchId: options.parallelBatchId ?? null,
    })

    const prefix = run.currentStatus() === 'timeout' ? 'interrompido por timeout' : 'falhou'
    return { text: `[subagent '${subagent.name}' ${prefix}: ${message}]`, isError: false }
  }
}

// ── Batch paralelo (spec F18 §3/§5.1) ───────────────────────────────────────
//
// `call_subagent` com `tasks[]` (1–4) substitui o path serial FIFO por spawn concorrente, cada
// filho isolado num worktree próprio derivado do cwd resolvido do pai (não do `project.path` fixo
// — se o pai já roda num worktree, os filhos nascem dali, herdando o mesmo ponto de partida).

export const MAX_PARALLEL_TASKS = 4

export type ParallelTaskStatus = 'completed' | 'error' | 'timeout' | 'skipped'

export interface ParallelTaskResult {
  childThreadId: string
  subagentName: string
  status: ParallelTaskStatus
  text: string
  worktreePath: string | null
}

export interface ParallelBatchResult {
  parallelBatchId: string
  results: ParallelTaskResult[]
  hadConflict: boolean
}

function isValidDelegationRequest(value: unknown): value is DelegationRequest {
  if (typeof value !== 'object' || value === null) return false
  const req = value as Record<string, unknown>
  return typeof req.name === 'string' && req.name.trim() !== '' && typeof req.task === 'string' && req.task.trim() !== ''
}

/**
 * Reserva um worktree por item **sequencialmente** (spec §3.2 — `git worktree add` concorrente na
 * mesma administrative area do repo é frágil), depois roda os turnos filhos em paralelo via
 * `Promise.all`. Falha ao criar um worktree — ou item com shape inválido — não aborta o batch:
 * esse item vira `skipped` e os demais seguem (PRD Tratamento de Erros).
 */
export async function runParallelDelegatedBatch(
  ctx: DelegationContext,
  tasks: DelegationRequest[]
): Promise<ParallelBatchResult> {
  const parallelBatchId = randomUUID()
  const baseCwd = resolveThreadCwd(ctx.parentThread, ctx.project)

  interface PreparedTask {
    task: DelegationRequest
    childThreadId: string
    worktreePath: string | null
    skipReason: string | null
  }

  const prepared: PreparedTask[] = []
  for (const task of tasks) {
    const childThreadId = randomUUID()
    if (!isValidDelegationRequest(task)) {
      prepared.push({ task, childThreadId, worktreePath: null, skipReason: 'name e task são obrigatórios.' })
      continue
    }
    try {
      const worktreePath = await createWorktree(baseCwd, ctx.project.id, childThreadId)
      prepared.push({ task, childThreadId, worktreePath, skipReason: null })
    } catch (err) {
      const message = err instanceof WorktreeError ? err.message : 'Não foi possível criar o worktree do filho.'
      prepared.push({ task, childThreadId, worktreePath: null, skipReason: message })
    }
  }

  const results = await Promise.all(
    prepared.map(async (p): Promise<ParallelTaskResult> => {
      if (p.skipReason || !p.worktreePath) {
        return {
          childThreadId: p.childThreadId,
          subagentName: p.task.name ?? '',
          status: 'skipped',
          text: p.skipReason ?? 'Item ignorado.',
          worktreePath: null,
        }
      }

      const outcome = await runDelegatedSubagentTurn(ctx, p.task, {
        childThreadId: p.childThreadId,
        cwdOverride: p.worktreePath,
        parallelBatchId,
      })
      // Sem run persistido = gate bloqueou ou o nome do subagent não existe no catálogo (falha
      // antes de startDelegatedRun) — conta como 'error', não 'skipped' (o item chegou a ser tentado).
      const persistedRun = getSubagentRun(p.childThreadId)
      const status: ParallelTaskStatus =
        persistedRun?.status === 'completed' || persistedRun?.status === 'timeout' ? persistedRun.status : 'error'

      return {
        childThreadId: p.childThreadId,
        subagentName: p.task.name,
        status,
        text: outcome.text,
        worktreePath: p.worktreePath,
      }
    })
  )

  // Merge por union de path (spec §3.2/§6): cada filho com worktree é diffado contra seu próprio
  // HEAD, agregado no thread do pai. Roda mesmo para filhos 'error'/'timeout' — um filho que falhou
  // no meio ainda pode ter escrito algo real que vale mostrar (PRD Tratamento de Erros).
  const childDiffSets: ChildDiffSet[] = []
  for (const p of prepared) {
    if (!p.worktreePath) continue
    const files = await diffWorkingTree(p.worktreePath)
    if (files.length > 0) {
      childDiffSets.push({
        childThreadId: p.childThreadId,
        subagentName: p.task.name,
        worktreePath: p.worktreePath,
        files,
      })
    }
  }

  let hadConflict = false
  if (childDiffSets.length > 0) {
    const createdDiffs = mergeParallelChildDiffs({
      parentThreadId: ctx.parentThread.id,
      parentCwd: baseCwd,
      provider: ctx.parentThread.provider,
      children: childDiffSets,
    })
    for (const d of createdDiffs) {
      emit(ctx.parentThread.id, { type: 'diff.ready', threadId: ctx.parentThread.id, diffId: d.id, file: d.file })
      if (d.status === 'conflict') hadConflict = true
    }
  }

  // Cleanup (spec §3.2 step 9) — mesma política segura de F13: worktree com alterações locais
  // (o caso comum aqui, já que acabou de materializar/servir de candidato de conflito) é retido
  // com aviso, nunca removido às cegas.
  for (const p of prepared) {
    if (!p.worktreePath) continue
    await removeWorktreeIfSafe(baseCwd, p.worktreePath, p.childThreadId)
  }

  return { parallelBatchId, results, hadConflict }
}

function formatBatchReport(batch: ParallelBatchResult): string {
  const lines = [`Batch paralelo ${batch.parallelBatchId} — ${batch.results.length} tarefa(s):`]
  for (const r of batch.results) {
    lines.push(`- ${r.subagentName} (${r.childThreadId}): ${r.status} — ${r.text}`)
  }
  if (batch.hadConflict) {
    lines.push('Atenção: há arquivo(s) em conflito (tocados por mais de um filho) aguardando resolução no pai.')
  }
  return lines.join('\n')
}

export interface DelegationServerHandle {
  port: number
  token: string
  close: () => void
}

/**
 * Servidor HTTP loopback efêmero por turno (spec F11 §3.2 — mesmo padrão de token aleatório de
 * `mcp-secrets.ts:createSecretServer`) que o MCP interno (`subagent-mcp-server.ts`) chama em
 * `tools/call`. Chamadas concorrentes no mesmo turno são serializadas (fila FIFO) — troca
 * deliberada vs. o RW-lock por cwd da fonte (spec §3.2): sem paralelismo, sem risco de escrita
 * concorrente na mesma working tree.
 */
export function createDelegationServer(ctx: DelegationContext): Promise<DelegationServerHandle> {
  const token = randomBytes(24).toString('hex')
  let queue: Promise<unknown> = Promise.resolve()

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/delegate') {
      res.writeHead(404)
      res.end()
      return
    }
    if (req.headers['x-delegate-token'] !== token) {
      res.writeHead(403)
      res.end()
      return
    }

    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      const run = async (): Promise<void> => {
        let result: DelegationResult
        try {
          const parsed = JSON.parse(body) as DelegationRequest & { tasks?: unknown }
          if (parsed.tasks !== undefined) {
            if (parsed.name !== undefined || parsed.task !== undefined) {
              result = { text: 'Ambíguo: envie "tasks" ou "name"/"task", não os dois.', isError: true }
            } else if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0 || parsed.tasks.length > MAX_PARALLEL_TASKS) {
              result = { text: `tasks deve ter entre 1 e ${MAX_PARALLEL_TASKS} itens.`, isError: true }
            } else {
              const batch = await runParallelDelegatedBatch(ctx, parsed.tasks as DelegationRequest[])
              const allFailed = batch.results.every((r) => r.status === 'error' || r.status === 'skipped')
              result = { text: formatBatchReport(batch), isError: allFailed }
            }
          } else {
            result = await runDelegatedSubagentTurn(ctx, parsed)
          }
        } catch (err) {
          result = {
            text: err instanceof Error ? err.message : 'Erro na delegação.',
            isError: true,
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      }
      queue = queue.then(run, run)
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({ port, token, close: () => server.close() })
    })
  })
}

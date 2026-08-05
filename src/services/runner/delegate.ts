import { randomUUID, randomBytes } from 'crypto'
import http from 'http'
import type { Subagent, SubagentRunStatus, SubagentsRepository } from '../db/repositories/subagents.js'
import type { Project } from '../db/repositories/projects.js'
import type { Thread, ThreadAccessLevel, ThreadProvider } from '../db/repositories/threads.js'
import { findCatalogSubagent } from './subagent-registry.js'
import { canDelegateSubagent, type ParentAccessLevel, type ParentProvider } from './subagent-caller-gate.js'
import { createUsageEvent } from '../db/repositories/usage-events.js'
import { resolveBillingMode, resolveProviderApiKey, resolveTurnCost } from './provider-resolution.js'
import { emit } from './ws-hub.js'
import {
  runCliTurn as defaultRunCliTurn,
  ProviderError,
  type ProviderTurnInput,
} from './providers/cli-driver.js'

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
  now?: number
}

export function startDelegatedRun(repo: SubagentsRepository, input: StartDelegatedRunInput): DelegatedRun {
  const now = input.now ?? Date.now()
  const childThreadId = randomUUID()
  repo.createRun({
    childThreadId,
    parentThreadId: input.parentThreadId,
    parentToolCallId: input.parentToolCallId ?? null,
    subagentName: input.subagent.name,
    provider: input.subagent.provider,
    model: input.subagent.model,
    reasoningLevel: input.subagent.reasoningLevel,
    status: 'running',
  })
  return new DelegatedRun({ childThreadId, idleTimeoutMinutes: input.subagent.idleTimeoutMinutes, now })
}

/** Chamar periodicamente (watchdog) ou sob demanda; persiste + retorna true se o run virou timeout agora. */
export function checkIdleTimeout(repo: SubagentsRepository, run: DelegatedRun, now: number = Date.now()): boolean {
  if (!run.isTimedOut(now)) return false
  repo.updateRun(run.childThreadId, { status: 'timeout' })
  run.markStatus('timeout')
  return true
}

export interface CompleteRunResult {
  text: string | null
  actionCount?: number
  usageJson?: string | null
}

export function completeDelegatedRun(repo: SubagentsRepository, run: DelegatedRun, result: CompleteRunResult): void {
  repo.updateRun(run.childThreadId, {
    status: 'completed',
    text: result.text,
    actionCount: result.actionCount ?? 0,
    usageJson: result.usageJson ?? null,
  })
  run.markStatus('completed')
}

export function cancelDelegatedRun(repo: SubagentsRepository, run: DelegatedRun): void {
  repo.updateRun(run.childThreadId, { status: 'cancelled' })
  run.markStatus('cancelled')
}

export function failDelegatedRun(repo: SubagentsRepository, run: DelegatedRun, message: string): void {
  repo.updateRun(run.childThreadId, { status: 'error', text: message })
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
  repo: SubagentsRepository
  project: Project
  parentThread: Thread
  /** `turnId` do turno pai (dispatch.ts) — liga o usage_event do subagent ao mesmo turno. */
  parentTurnId: string
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

function resolveChildCwd(parentThread: Thread, project: Project): string {
  return parentThread.executionMode === 'worktree' && parentThread.worktreePath ? parentThread.worktreePath : project.path
}

function resolveChildProvider(subagent: Subagent, parentProvider: ThreadProvider): ThreadProvider {
  return subagent.provider === 'inherit' ? parentProvider : subagent.provider
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
  request: DelegationRequest
): Promise<DelegationResult> {
  const gate = canDelegateSubagent({
    provider: ctx.parentThread.provider as ParentProvider,
    accessLevel: ctx.parentThread.accessLevel as ParentAccessLevel,
  })
  if (!gate.allowed) {
    return { text: gate.reason ?? 'Delegação de subagent bloqueada para este provider/access level.', isError: true }
  }

  const subagent = findCatalogSubagent(ctx.repo, ctx.project.id, request.name)
  if (!subagent) {
    return {
      text: `Subagent "${request.name}" não encontrado ou não vinculado a este projeto.`,
      isError: true,
    }
  }

  const provider = resolveChildProvider(subagent, ctx.parentThread.provider)
  const model = subagent.model
  const cwd = resolveChildCwd(ctx.parentThread, ctx.project)

  const run = startDelegatedRun(ctx.repo, {
    parentThreadId: ctx.parentThread.id,
    subagent,
  })

  emit(ctx.parentThread.id, {
    type: 'subagent.start',
    threadId: ctx.parentThread.id,
    childThreadId: run.childThreadId,
    name: subagent.name,
  })

  const controller = new AbortController()
  const watchdog = setInterval(() => {
    if (checkIdleTimeout(ctx.repo, run) && !controller.signal.aborted) {
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
      if (event.type === 'text-delta') assistantText += event.text
    },
  }

  const persistSubagentUsage = (usage: NonNullable<Awaited<ReturnType<RunCliTurn>>['usage']>, sdkCostUsd: number | null | undefined) => {
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
      completeDelegatedRun(ctx.repo, run, {
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
    })

    return { text: finalText }
  } catch (err) {
    clearInterval(watchdog)
    const message = err instanceof Error ? err.message : 'Erro desconhecido no subagent.'

    if (run.currentStatus() === 'running') {
      failDelegatedRun(ctx.repo, run, message)
    }
    if (err instanceof ProviderError && err.usage) persistSubagentUsage(err.usage, err.costUsd)

    emit(ctx.parentThread.id, {
      type: 'subagent.result',
      threadId: ctx.parentThread.id,
      childThreadId: run.childThreadId,
      status: run.currentStatus(),
    })

    const prefix = run.currentStatus() === 'timeout' ? 'interrompido por timeout' : 'falhou'
    return { text: `[subagent '${subagent.name}' ${prefix}: ${message}]`, isError: false }
  }
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
          const request = JSON.parse(body) as DelegationRequest
          result = await runDelegatedSubagentTurn(ctx, request)
        } catch (err) {
          result = { text: err instanceof Error ? err.message : 'Erro na delegação.', isError: true }
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

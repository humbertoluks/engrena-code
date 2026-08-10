import { randomUUID } from 'crypto'
import { getDb } from '../client.js'
import type { SlashCommandName } from '../../runner/slash-commands.js'

export type PipelineStatus = 'running' | 'waiting_checkpoint' | 'completed' | 'failed' | 'timeout' | 'cancelled'
export type PipelineStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'skipped'

export interface Pipeline {
  id: string
  threadId: string
  projectId: string
  command: SlashCommandName
  status: PipelineStatus
  argsText: string
  startedAt: number
  finishedAt: number | null
  errorCode: string | null
  errorMessage: string | null
}

export interface PipelineStage {
  id: string
  pipelineId: string
  stageId: string
  stageIndex: number
  subagentName: string
  status: PipelineStageStatus
  subagentRunId: string | null
  startedAt: number | null
  finishedAt: number | null
}

export interface CreatePipelineInput {
  threadId: string
  projectId: string
  command: SlashCommandName
  argsText: string
}

export interface PipelinePatch {
  status?: PipelineStatus
  finishedAt?: number | null
  errorCode?: string | null
  errorMessage?: string | null
}

export interface CreatePipelineStageInput {
  pipelineId: string
  stageId: string
  stageIndex: number
  subagentName: string
  status?: PipelineStageStatus
}

export interface PipelineStagePatch {
  status?: PipelineStageStatus
  subagentRunId?: string | null
  startedAt?: number | null
  finishedAt?: number | null
}

interface PipelineRow {
  id: string
  thread_id: string
  project_id: string
  command: string
  status: string
  args_text: string
  started_at: number
  finished_at: number | null
  error_code: string | null
  error_message: string | null
}

function toPipeline(row: PipelineRow): Pipeline {
  return {
    id: row.id,
    threadId: row.thread_id,
    projectId: row.project_id,
    command: row.command as SlashCommandName,
    status: row.status as PipelineStatus,
    argsText: row.args_text,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
  }
}

interface PipelineStageRow {
  id: string
  pipeline_id: string
  stage_id: string
  stage_index: number
  subagent_name: string
  status: string
  subagent_run_id: string | null
  started_at: number | null
  finished_at: number | null
}

function toPipelineStage(row: PipelineStageRow): PipelineStage {
  return {
    id: row.id,
    pipelineId: row.pipeline_id,
    stageId: row.stage_id,
    stageIndex: row.stage_index,
    subagentName: row.subagent_name,
    status: row.status as PipelineStageStatus,
    subagentRunId: row.subagent_run_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}

export function createPipeline(input: CreatePipelineInput): Pipeline {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(
    `INSERT INTO pipelines (id, thread_id, project_id, command, status, args_text, started_at)
       VALUES (?, ?, ?, ?, 'running', ?, ?)`
  ).run(id, input.threadId, input.projectId, input.command, input.argsText, now)
  return getPipeline(id) as Pipeline
}

export function getPipeline(id: string): Pipeline | null {
  const row = getDb().prepare('SELECT * FROM pipelines WHERE id = ?').get(id) as PipelineRow | undefined
  return row === undefined ? null : toPipeline(row)
}

export function updatePipeline(id: string, patch: PipelinePatch): Pipeline | null {
  const existing = getPipeline(id)
  if (existing === null) return null
  const db = getDb()
  db.prepare('UPDATE pipelines SET status = ?, finished_at = ?, error_code = ?, error_message = ? WHERE id = ?').run(
    patch.status ?? existing.status,
    patch.finishedAt !== undefined ? patch.finishedAt : existing.finishedAt,
    patch.errorCode !== undefined ? patch.errorCode : existing.errorCode,
    patch.errorMessage !== undefined ? patch.errorMessage : existing.errorMessage,
    id
  )
  return getPipeline(id)
}

/** Mais recente primeiro (spec §6 índice `thread_id, started_at DESC`) — rehydrate de UI usa `[0]`. */
export function listPipelinesForThread(threadId: string): Pipeline[] {
  const rows = getDb()
    .prepare('SELECT * FROM pipelines WHERE thread_id = ? ORDER BY started_at DESC')
    .all(threadId) as unknown as PipelineRow[]
  return rows.map(toPipeline)
}

export function getActivePipelineForThread(threadId: string): Pipeline | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM pipelines WHERE thread_id = ? AND status IN ('running','waiting_checkpoint') ORDER BY started_at DESC LIMIT 1`
    )
    .get(threadId) as PipelineRow | undefined
  return row === undefined ? null : toPipeline(row)
}

export function createPipelineStage(input: CreatePipelineStageInput): PipelineStage {
  const db = getDb()
  const id = randomUUID()
  db.prepare(
    `INSERT INTO pipeline_stages (id, pipeline_id, stage_id, stage_index, subagent_name, status)
       VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.pipelineId, input.stageId, input.stageIndex, input.subagentName, input.status ?? 'pending')
  return getPipelineStage(id) as PipelineStage
}

export function getPipelineStage(id: string): PipelineStage | null {
  const row = getDb().prepare('SELECT * FROM pipeline_stages WHERE id = ?').get(id) as PipelineStageRow | undefined
  return row === undefined ? null : toPipelineStage(row)
}

export function updatePipelineStage(id: string, patch: PipelineStagePatch): PipelineStage | null {
  const existing = getPipelineStage(id)
  if (existing === null) return null
  const db = getDb()
  db.prepare(
    'UPDATE pipeline_stages SET status = ?, subagent_run_id = ?, started_at = ?, finished_at = ? WHERE id = ?'
  ).run(
    patch.status ?? existing.status,
    patch.subagentRunId !== undefined ? patch.subagentRunId : existing.subagentRunId,
    patch.startedAt !== undefined ? patch.startedAt : existing.startedAt,
    patch.finishedAt !== undefined ? patch.finishedAt : existing.finishedAt,
    id
  )
  return getPipelineStage(id)
}

export function listStagesForPipeline(pipelineId: string): PipelineStage[] {
  const rows = getDb()
    .prepare('SELECT * FROM pipeline_stages WHERE pipeline_id = ? ORDER BY stage_index ASC')
    .all(pipelineId) as unknown as PipelineStageRow[]
  return rows.map(toPipelineStage)
}

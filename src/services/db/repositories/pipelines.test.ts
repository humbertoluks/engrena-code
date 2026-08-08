import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f22_pipelines_repo_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const { createThread } = await import('./threads.js')
const {
  createPipeline,
  getPipeline,
  updatePipeline,
  listPipelinesForThread,
  getActivePipelineForThread,
  createPipelineStage,
  getPipelineStage,
  updatePipelineStage,
  listStagesForPipeline,
} = await import('./pipelines.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f22_pipelines_repo_fixture_'))

function makeProjectDir(name: string): string {
  const dir = join(fixtureRoot, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

function makeThread() {
  const project = createProject({ path: makeProjectDir(`project-${Math.random()}`) })
  const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'full-access', executionMode: 'main' })
  return { project, thread }
}

beforeEach(() => {
  getDb().exec('DELETE FROM pipeline_stages')
  getDb().exec('DELETE FROM pipelines')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('pipelines repository', () => {
  it('creates a pipeline in running status and reads it back', () => {
    const { project, thread } = makeThread()
    const pipeline = createPipeline({ threadId: thread.id, projectId: project.id, command: 'spec', argsText: 'Adicionar X' })
    expect(pipeline.status).toBe('running')
    expect(pipeline.finishedAt).toBeNull()
    expect(getPipeline(pipeline.id)).toEqual(pipeline)
  })

  it('updates status and finishedAt', () => {
    const { project, thread } = makeThread()
    const pipeline = createPipeline({ threadId: thread.id, projectId: project.id, command: 'spec', argsText: 'x' })
    const updated = updatePipeline(pipeline.id, { status: 'completed', finishedAt: 12345 })
    expect(updated?.status).toBe('completed')
    expect(updated?.finishedAt).toBe(12345)
  })

  it('records errorCode/errorMessage on failure', () => {
    const { project, thread } = makeThread()
    const pipeline = createPipeline({ threadId: thread.id, projectId: project.id, command: 'featdevelop', argsText: 'x' })
    const updated = updatePipeline(pipeline.id, {
      status: 'failed',
      errorCode: 'pipeline_subagent_missing',
      errorMessage: 'Subagent "implementer" não encontrado.',
    })
    expect(updated?.status).toBe('failed')
    expect(updated?.errorCode).toBe('pipeline_subagent_missing')
  })

  it('lists pipelines for a thread most-recent first', () => {
    const { project, thread } = makeThread()
    const first = createPipeline({ threadId: thread.id, projectId: project.id, command: 'spec', argsText: 'a' })
    updatePipeline(first.id, { status: 'completed', finishedAt: Date.now() })
    const second = createPipeline({ threadId: thread.id, projectId: project.id, command: 'featbuild', argsText: 'b' })
    const listed = listPipelinesForThread(thread.id)
    expect(listed.map((p) => p.id)).toEqual([second.id, first.id])
  })

  it('getActivePipelineForThread returns only running/waiting_checkpoint, most recent', () => {
    const { project, thread } = makeThread()
    const done = createPipeline({ threadId: thread.id, projectId: project.id, command: 'spec', argsText: 'a' })
    updatePipeline(done.id, { status: 'completed', finishedAt: Date.now() })
    expect(getActivePipelineForThread(thread.id)).toBeNull()

    const active = createPipeline({ threadId: thread.id, projectId: project.id, command: 'featdevelop', argsText: 'b' })
    expect(getActivePipelineForThread(thread.id)?.id).toBe(active.id)

    updatePipeline(active.id, { status: 'waiting_checkpoint' })
    expect(getActivePipelineForThread(thread.id)?.status).toBe('waiting_checkpoint')
  })

  it('creates stages defaulting to pending and updates them', () => {
    const { project, thread } = makeThread()
    const pipeline = createPipeline({ threadId: thread.id, projectId: project.id, command: 'featdevelop', argsText: 'x' })
    const stage = createPipelineStage({ pipelineId: pipeline.id, stageId: 'planner', stageIndex: 1, subagentName: 'planner' })
    expect(stage.status).toBe('pending')

    const updated = updatePipelineStage(stage.id, { status: 'running', startedAt: 1000, subagentRunId: 'run-1' })
    expect(updated?.status).toBe('running')
    expect(updated?.subagentRunId).toBe('run-1')
    expect(getPipelineStage(stage.id)?.startedAt).toBe(1000)
  })

  it('lists stages for a pipeline ordered by stageIndex', () => {
    const { project, thread } = makeThread()
    const pipeline = createPipeline({ threadId: thread.id, projectId: project.id, command: 'featdevelop', argsText: 'x' })
    createPipelineStage({ pipelineId: pipeline.id, stageId: 'tester', stageIndex: 4, subagentName: 'tester' })
    createPipelineStage({ pipelineId: pipeline.id, stageId: 'planner', stageIndex: 1, subagentName: 'planner' })
    createPipelineStage({ pipelineId: pipeline.id, stageId: 'implementer', stageIndex: 2, subagentName: 'implementer' })
    createPipelineStage({ pipelineId: pipeline.id, stageId: 'reviewer', stageIndex: 3, subagentName: 'reviewer' })

    const stages = listStagesForPipeline(pipeline.id)
    expect(stages.map((s) => s.stageId)).toEqual(['planner', 'implementer', 'reviewer', 'tester'])
  })

  it('rejects a duplicate stageIndex for the same pipeline', () => {
    const { project, thread } = makeThread()
    const pipeline = createPipeline({ threadId: thread.id, projectId: project.id, command: 'featdevelop', argsText: 'x' })
    createPipelineStage({ pipelineId: pipeline.id, stageId: 'planner', stageIndex: 1, subagentName: 'planner' })
    expect(() =>
      createPipelineStage({ pipelineId: pipeline.id, stageId: 'implementer', stageIndex: 1, subagentName: 'implementer' })
    ).toThrow()
  })
})

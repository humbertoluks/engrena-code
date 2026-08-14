import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f22_pipeline_runner_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread, getThread } = await import('../db/repositories/threads.js')
const { createSubagent, upsertProjectSubagentLink } = await import('../db/repositories/subagents.js')
const { listPipelinesForThread, listStagesForPipeline } = await import('../db/repositories/pipelines.js')
const { listDiffsForThread } = await import('../db/repositories/diffs.js')
const { vaultService } = await import('../vault/vault-service.js')
const { clearAllSubscriptions } = await import('./ws-hub.js')
const { setRunCliTurnForTesting, resetRunCliTurnForTesting } = await import('./delegate.js')
const { listOpenQuestionGates, resolveQuestionGate } = await import('./gate.js')
const { cancelThread } = await import('./dispatch.js')
const {
  runPipelineCommand,
  setPipelineHardCapMsForTesting,
  resetPipelineHardCapMsForTesting,
} = await import('./pipeline-runner.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f22_pipeline_runner_fixture_'))

function makeGitProjectDir(name: string): string {
  const dir = join(fixtureRoot, name)
  execFileSync('git', ['init', dir])
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@local', '-C', dir, 'commit', '--allow-empty', '-m', 'init'])
  return dir
}

function makeContext(names: string[] = ['planner', 'implementer', 'reviewer', 'tester']) {
  const dir = makeGitProjectDir(`project-${Math.random()}`)
  const project = createProject({ path: dir })
  const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'full-access', executionMode: 'main' })
  for (const name of names) {
    const subagent = createSubagent({
      name,
      description: `Subagent de teste ${name}.`,
      prompt: `Você é o ${name}.`,
      provider: 'inherit',
    })
    upsertProjectSubagentLink(project.id, subagent.id, { enabled: true })
  }
  return { dir, project, thread }
}

function stageNameFromSystemPrompt(systemPrompt: string | undefined): string {
  const match = /Você é o (\w+)\./.exec(systemPrompt ?? '')
  return match?.[1] ?? 'unknown'
}

/** Poll em vez de sleep fixo — o passo espiado envolve spawns reais de `git`, cuja duração varia
 * bastante sob a suite completa rodando em paralelo (flakou uma vez com sleep(400) fixo). */
async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: timeout')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

beforeEach(() => {
  getDb().exec('DELETE FROM pipeline_stages')
  getDb().exec('DELETE FROM pipelines')
  getDb().exec('DELETE FROM subagent_runs')
  getDb().exec('DELETE FROM usage_events')
  getDb().exec('DELETE FROM diffs')
  getDb().exec('DELETE FROM messages')
  getDb().exec('DELETE FROM project_subagents')
  getDb().exec('DELETE FROM subagents')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
  vaultService.lock()
  vaultService.unlock('workspace-teste', 'senha-forte-123')
  clearAllSubscriptions()
})

afterEach(() => {
  resetRunCliTurnForTesting()
  resetPipelineHardCapMsForTesting()
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('runPipelineCommand — /spec', () => {
  it('calls only the planner and never writes a file', async () => {
    const { project, thread } = makeContext()
    const calledStages: string[] = []
    setRunCliTurnForTesting(async (input) => {
      calledStages.push(stageNameFromSystemPrompt(input.systemPrompt))
      return { text: '## spec.md\nfoo\n\n## plan.md\nbar' }
    })

    await runPipelineCommand({ project, thread, command: 'spec', prompt: '/spec Adicionar X', argsText: 'Adicionar X' })

    expect(calledStages).toEqual(['planner'])
    const pipelines = listPipelinesForThread(thread.id)
    expect(pipelines).toHaveLength(1)
    expect(pipelines[0].status).toBe('completed')
    const stages = listStagesForPipeline(pipelines[0].id)
    expect(stages).toHaveLength(1)
    // F29: stage ↔ subagent_runs via child_thread_id (antes ficava sempre null).
    expect(typeof stages[0].subagentRunId).toBe('string')
    expect(stages[0].subagentRunId?.length).toBeGreaterThan(0)
    expect(listDiffsForThread(thread.id)).toHaveLength(0)
    expect(getThread(thread.id)?.state).toBe('idle')
  })
})

describe('runPipelineCommand — /featdevelop', () => {
  it('runs the 4 stages in order and resumes after the checkpoint', async () => {
    const { dir, project, thread } = makeContext()
    const calledStages: string[] = []
    setRunCliTurnForTesting(async (input) => {
      const stage = stageNameFromSystemPrompt(input.systemPrompt)
      calledStages.push(stage)
      if (stage === 'implementer') {
        writeFileSync(join(input.cwd, 'novo-arquivo.txt'), 'conteudo\n')
      }
      return { text: `saida-${stage}` }
    })

    const runPromise = runPipelineCommand({
      project,
      thread,
      command: 'featdevelop',
      prompt: '/featdevelop Adicionar Y',
      argsText: 'Adicionar Y',
    })

    // Deixa o loop chegar no checkpoint (planner + implementer já rodaram, diffs capturados).
    await waitUntil(() => listPipelinesForThread(thread.id)[0]?.status === 'waiting_checkpoint')
    expect(calledStages).toEqual(['planner', 'implementer'])
    const pipelineMid = listPipelinesForThread(thread.id)[0]
    expect(pipelineMid.status).toBe('waiting_checkpoint')
    expect(getThread(thread.id)?.state).toBe('waiting_user')
    expect(listDiffsForThread(thread.id).map((d) => d.file)).toEqual(['novo-arquivo.txt'])

    const [checkpointGate] = listOpenQuestionGates(thread.id)
    const resolved = resolveQuestionGate(thread.id, checkpointGate.gateId, { selectedOptions: ['continuar'] })
    expect(resolved).toEqual({ ok: true })
    await runPromise

    expect(calledStages).toEqual(['planner', 'implementer', 'reviewer', 'tester'])
    const pipeline = listPipelinesForThread(thread.id)[0]
    expect(pipeline.status).toBe('completed')
    const stages = listStagesForPipeline(pipeline.id)
    expect(stages.map((s) => s.stageId)).toEqual(['planner', 'implementer', 'reviewer', 'tester'])
    expect(stages.every((s) => s.status === 'completed')).toBe(true)
    expect(getThread(thread.id)?.state).toBe('idle')

    rmSync(dir, { recursive: true, force: true })
  })

  it('stops at the first failed stage; earlier stages stay completed', async () => {
    const { project, thread } = makeContext()
    const calledStages: string[] = []
    setRunCliTurnForTesting(async (input) => {
      const stage = stageNameFromSystemPrompt(input.systemPrompt)
      calledStages.push(stage)
      if (stage === 'implementer') throw new Error('implementer explodiu')
      return { text: `saida-${stage}` }
    })

    await runPipelineCommand({
      project,
      thread,
      command: 'featdevelop',
      prompt: '/featdevelop Adicionar Z',
      argsText: 'Adicionar Z',
    })

    expect(calledStages).toEqual(['planner', 'implementer'])
    const pipeline = listPipelinesForThread(thread.id)[0]
    expect(pipeline.status).toBe('failed')
    expect(pipeline.errorCode).toBe('pipeline_stage_failed')
    const stages = listStagesForPipeline(pipeline.id)
    expect(stages.map((s) => [s.stageId, s.status])).toEqual([
      ['planner', 'completed'],
      ['implementer', 'failed'],
    ])
    expect(getThread(thread.id)?.state).toBe('idle')
  })

  it('fails with pipeline_subagent_missing when a stage subagent is not linked, before spawning it', async () => {
    const { project, thread } = makeContext(['planner']) // implementer/reviewer/tester ausentes
    const calledStages: string[] = []
    setRunCliTurnForTesting(async (input) => {
      calledStages.push(stageNameFromSystemPrompt(input.systemPrompt))
      return { text: 'ok' }
    })

    await runPipelineCommand({
      project,
      thread,
      command: 'featdevelop',
      prompt: '/featdevelop Adicionar W',
      argsText: 'Adicionar W',
    })

    expect(calledStages).toEqual(['planner'])
    const pipeline = listPipelinesForThread(thread.id)[0]
    expect(pipeline.status).toBe('failed')
    expect(pipeline.errorCode).toBe('pipeline_subagent_missing')
    const stages = listStagesForPipeline(pipeline.id)
    expect(stages.map((s) => s.stageId)).toEqual(['planner'])
  })

  it('marks the pipeline as timeout when the aggregate hard-cap is exceeded', async () => {
    const { project, thread } = makeContext()
    setPipelineHardCapMsForTesting(0)
    const calledStages: string[] = []
    setRunCliTurnForTesting(async (input) => {
      calledStages.push(stageNameFromSystemPrompt(input.systemPrompt))
      return { text: 'ok' }
    })

    await runPipelineCommand({
      project,
      thread,
      command: 'featdevelop',
      prompt: '/featdevelop Adicionar V',
      argsText: 'Adicionar V',
    })

    expect(calledStages).toEqual([])
    const pipeline = listPipelinesForThread(thread.id)[0]
    expect(pipeline.status).toBe('timeout')
    expect(listStagesForPipeline(pipeline.id)).toHaveLength(0)
  })

  it('cancels the pipeline while it is paused at the checkpoint', async () => {
    const { project, thread } = makeContext()
    setRunCliTurnForTesting(async (input) => {
      const stage = stageNameFromSystemPrompt(input.systemPrompt)
      if (stage === 'implementer') writeFileSync(join(input.cwd, 'x.txt'), 'x\n')
      return { text: `saida-${stage}` }
    })

    const runPromise = runPipelineCommand({
      project,
      thread,
      command: 'featdevelop',
      prompt: '/featdevelop cancelar',
      argsText: 'cancelar',
    })

    await waitUntil(() => getThread(thread.id)?.state === 'waiting_user')
    expect(getThread(thread.id)?.state).toBe('waiting_user')

    const cancelled = cancelThread(thread.id)
    expect(cancelled).toBe(true)
    await runPromise

    const pipeline = listPipelinesForThread(thread.id)[0]
    expect(pipeline.status).toBe('cancelled')
    expect(getThread(thread.id)?.state).toBe('cancelled')
  })
})

describe('runPipelineCommand — /featbuild', () => {
  it('delegates only to the implementer, never re-calls planner', async () => {
    const { dir, project, thread } = makeContext()
    const calledStages: string[] = []
    setRunCliTurnForTesting(async (input) => {
      const stage = stageNameFromSystemPrompt(input.systemPrompt)
      calledStages.push(stage)
      writeFileSync(join(input.cwd, 'build-output.txt'), 'ok\n')
      return { text: `saida-${stage}` }
    })

    await runPipelineCommand({
      project,
      thread,
      command: 'featbuild',
      prompt: '/featbuild ## Passo 1\nfaz isso',
      argsText: '## Passo 1\nfaz isso',
    })

    expect(calledStages).toEqual(['implementer'])
    const pipeline = listPipelinesForThread(thread.id)[0]
    expect(pipeline.status).toBe('completed')
    expect(listDiffsForThread(thread.id).map((d) => d.file)).toEqual(['build-output.txt'])
    // Checkpoint de featbuild é passivo (fluxo DiffViewer F03) — nunca vai pra waiting_user.
    expect(getThread(thread.id)?.state).toBe('idle')

    rmSync(dir, { recursive: true, force: true })
  })
})

import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f18_merge_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread } = await import('../db/repositories/threads.js')
const { createDiff, getDiff } = await import('../db/repositories/diffs.js')
const { mergeParallelChildDiffs, resolveParallelConflict, DiffConflictResolutionError } = await import(
  './parallel-merge.js'
)

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f18_merge_fixture_'))

function makeDir(name: string): string {
  const dir = join(fixtureRoot, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

beforeEach(() => {
  getDb().exec('DELETE FROM diffs')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

function makeParent() {
  const project = createProject({ path: makeDir(`project-${Math.random()}`) })
  const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
  const parentCwd = makeDir(`parent-cwd-${Math.random()}`)
  return { project, thread, parentCwd }
}

describe('mergeParallelChildDiffs', () => {
  it('test_merge_disjoint_paths_pending', () => {
    const { thread, parentCwd } = makeParent()
    const childA = makeDir(`child-a-${Math.random()}`)
    const childB = makeDir(`child-b-${Math.random()}`)
    writeFileSync(join(childA, 'a.ts'), 'conteudo a\n')
    writeFileSync(join(childB, 'b.ts'), 'conteudo b\n')

    const created = mergeParallelChildDiffs({
      parentThreadId: thread.id,
      parentCwd,
      provider: 'claude',
      children: [
        {
          childThreadId: 'child-a',
          subagentName: 'implementer-a',
          worktreePath: childA,
          files: [{ file: 'a.ts', additions: 1, deletions: 0, hunks: [] }],
        },
        {
          childThreadId: 'child-b',
          subagentName: 'implementer-b',
          worktreePath: childB,
          files: [{ file: 'b.ts', additions: 1, deletions: 0, hunks: [] }],
        },
      ],
    })

    // Sem diff criado aqui pro path exclusivo — só materializado; dispatch.ts é quem cria o diff
    // no fim do turno pai via diffWorkingTree(cwd), evitando duplicar a entrada.
    expect(created).toHaveLength(0)
    expect(readFileSync(join(parentCwd, 'a.ts'), 'utf-8')).toBe('conteudo a\n')
    expect(readFileSync(join(parentCwd, 'b.ts'), 'utf-8')).toBe('conteudo b\n')
  })

  it('test_merge_same_path_conflict', () => {
    const { thread, parentCwd } = makeParent()
    const childA = makeDir(`child-a-${Math.random()}`)
    const childB = makeDir(`child-b-${Math.random()}`)
    writeFileSync(join(childA, 'shared.ts'), 'versao a\n')
    writeFileSync(join(childB, 'shared.ts'), 'versao b\n')

    const created = mergeParallelChildDiffs({
      parentThreadId: thread.id,
      parentCwd,
      provider: 'claude',
      children: [
        {
          childThreadId: 'child-a',
          subagentName: 'implementer-a',
          worktreePath: childA,
          files: [{ file: 'shared.ts', additions: 1, deletions: 0, hunks: [] }],
        },
        {
          childThreadId: 'child-b',
          subagentName: 'implementer-b',
          worktreePath: childB,
          files: [{ file: 'shared.ts', additions: 2, deletions: 0, hunks: [] }],
        },
      ],
    })

    expect(created).toHaveLength(1)
    expect(created[0].status).toBe('conflict')
    expect(created[0].conflictCandidates).toHaveLength(2)
    // Não materializado no cwd do pai enquanto o conflito não é resolvido.
    expect(() => readFileSync(join(parentCwd, 'shared.ts'), 'utf-8')).toThrow()
  })

  it('replicates a deletion from the child into the parent cwd', () => {
    const { thread, parentCwd } = makeParent()
    writeFileSync(join(parentCwd, 'removido.ts'), 'ainda existe no pai\n')
    const childA = makeDir(`child-del-${Math.random()}`)
    // filho não tem o arquivo — representa remoção

    mergeParallelChildDiffs({
      parentThreadId: thread.id,
      parentCwd,
      provider: 'claude',
      children: [
        {
          childThreadId: 'child-a',
          subagentName: 'implementer-a',
          worktreePath: childA,
          files: [{ file: 'removido.ts', additions: 0, deletions: 3, hunks: [] }],
        },
      ],
    })

    expect(() => readFileSync(join(parentCwd, 'removido.ts'), 'utf-8')).toThrow()
  })
})

describe('resolveParallelConflict', () => {
  it('test_resolve_conflict_promotes_winner', () => {
    const { thread, parentCwd } = makeParent()
    const childA = makeDir(`child-a-${Math.random()}`)
    writeFileSync(join(childA, 'shared.ts'), 'vencedor\n')

    const diff = createDiff({
      threadId: thread.id,
      file: 'shared.ts',
      additions: 1,
      deletions: 0,
      hunks: [],
      provider: 'claude',
      status: 'conflict',
      conflictCandidates: [
        { childThreadId: 'child-a', subagentName: 'implementer-a', hunks: [], additions: 1, deletions: 0, worktreePath: childA },
        { childThreadId: 'child-b', subagentName: 'implementer-b', hunks: [], additions: 2, deletions: 1, worktreePath: makeDir('child-b-loser') },
      ],
    })

    const resolved = resolveParallelConflict(thread.id, diff.id, 'child-a', parentCwd)

    expect(resolved.status).toBe('pending')
    expect(resolved.conflictCandidates).toBeNull()
    expect(readFileSync(join(parentCwd, 'shared.ts'), 'utf-8')).toBe('vencedor\n')
    expect(getDiff(diff.id)?.status).toBe('pending')
  })

  it('test_accept_conflict_rejected — throws diff_not_conflict for a pending diff', () => {
    const { thread, parentCwd } = makeParent()
    const diff = createDiff({ threadId: thread.id, file: 'a.ts', additions: 1, deletions: 0, hunks: [], provider: 'claude' })

    expect(() => resolveParallelConflict(thread.id, diff.id, 'child-a', parentCwd)).toThrow(DiffConflictResolutionError)
  })

  it('rejects a winner that is not a candidate of this conflict', () => {
    const { thread, parentCwd } = makeParent()
    const childA = makeDir(`child-a-${Math.random()}`)
    const diff = createDiff({
      threadId: thread.id,
      file: 'shared.ts',
      additions: 1,
      deletions: 0,
      hunks: [],
      provider: 'claude',
      status: 'conflict',
      conflictCandidates: [
        { childThreadId: 'child-a', subagentName: 'implementer-a', hunks: [], additions: 1, deletions: 0, worktreePath: childA },
      ],
    })

    expect(() => resolveParallelConflict(thread.id, diff.id, 'child-nope', parentCwd)).toThrow(DiffConflictResolutionError)
  })

  it('rejects a diff that belongs to a different thread', () => {
    const { thread, parentCwd } = makeParent()
    const other = createThread({ projectId: thread.projectId, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
    const diff = createDiff({
      threadId: other.id,
      file: 'shared.ts',
      additions: 1,
      deletions: 0,
      hunks: [],
      provider: 'claude',
      status: 'conflict',
      conflictCandidates: [
        { childThreadId: 'child-a', subagentName: 'implementer-a', hunks: [], additions: 1, deletions: 0, worktreePath: makeDir('x') },
      ],
    })

    expect(() => resolveParallelConflict(thread.id, diff.id, 'child-a', parentCwd)).toThrow(DiffConflictResolutionError)
  })
})

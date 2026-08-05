import { getProject } from '../db/repositories/projects.js'
import { getThread, updateThread } from '../db/repositories/threads.js'
import {
  countPendingForThread,
  listDiffsByIds,
  listDiffsByPaths,
  listPendingForThread,
  setDiffStatus,
  type Diff,
} from '../db/repositories/diffs.js'
import { discardFile, GitError } from '../git/git-client.js'
import { acquireLease, releaseLease } from './project-execution.js'
import { emit } from './ws-hub.js'
import { createLogEntry } from '../db/repositories/log-entries.js'

export class ApplyDiffValidationError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export type DiffAction = 'accept' | 'reject'

export interface AcceptDiffInput {
  threadId: string
  action?: DiffAction
  ids?: string[]
  paths?: string[]
}

export interface AcceptDiffResult {
  applied: boolean
  acceptedIds?: string[]
  rejectedIds?: string[]
}

function resolveSubset(threadId: string, input: AcceptDiffInput): Diff[] {
  if (input.ids !== undefined && input.paths !== undefined) {
    throw new ApplyDiffValidationError('validation_error', 'Use ids OU paths, não os dois.')
  }
  if (input.ids !== undefined) {
    if (input.ids.length === 0) throw new ApplyDiffValidationError('validation_error', 'ids não pode ser uma lista vazia.')
    return listDiffsByIds(threadId, input.ids)
  }
  if (input.paths !== undefined) {
    if (input.paths.length === 0) throw new ApplyDiffValidationError('validation_error', 'paths não pode ser uma lista vazia.')
    return listDiffsByPaths(threadId, input.paths)
  }
  return listPendingForThread(threadId)
}

/** Accept/reject por subset de `ids`/`paths` (omitido = todos pending). Atômico sob o lease do projeto. */
export async function applyDiffAction(input: AcceptDiffInput): Promise<AcceptDiffResult> {
  const thread = getThread(input.threadId)
  if (thread === null) throw new ApplyDiffValidationError('thread_not_found', 'Thread não encontrada.')

  const project = getProject(thread.projectId)
  if (project === null) throw new ApplyDiffValidationError('project_not_found', 'Projeto não encontrado.')

  const action: DiffAction = input.action ?? 'accept'
  const requested = resolveSubset(thread.id, input)
  const subset = requested.filter((d) => d.status === 'pending')

  if (subset.length === 0) {
    throw new ApplyDiffValidationError('diff_not_found', 'Nenhum diff pending encontrado para o subset informado.')
  }

  acquireLease(project.id, 'agent', action === 'accept' ? 'accept-diff' : 'reject-diff', thread.id)

  try {
    const doneIds: string[] = []

    for (const diff of subset) {
      if (action === 'reject') {
        try {
          await discardFile(diff.worktreePath ?? project.path, diff.file)
        } catch (err) {
          if (err instanceof GitError) throw new ApplyDiffValidationError(err.code, err.message)
          throw err
        }
      }
      setDiffStatus(diff.id, action === 'accept' ? 'accepted' : 'rejected')
      doneIds.push(diff.id)
    }

    const remainingPending = countPendingForThread(thread.id)
    const nextState = action === 'accept' ? (remainingPending === 0 ? 'committed' : 'idle') : 'idle'
    updateThread(thread.id, { state: nextState })
    emit(thread.id, { type: 'state.change', threadId: thread.id, state: nextState })

    createLogEntry({
      threadId: thread.id,
      kind: 'git',
      event:
        action === 'accept'
          ? `diff aceito (${doneIds.length} arquivo(s))`
          : `diff rejeitado (${doneIds.length} arquivo(s))`,
    })

    return {
      applied: true,
      ...(action === 'accept' ? { acceptedIds: doneIds } : { rejectedIds: doneIds }),
    }
  } finally {
    releaseLease(project.id)
  }
}

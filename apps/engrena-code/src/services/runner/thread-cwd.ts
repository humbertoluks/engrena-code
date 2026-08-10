import type { Project } from '../db/repositories/projects.js'
import type { Thread } from '../db/repositories/threads.js'

/**
 * Cwd único de uma thread (spec F13 §5): `worktreePath` quando `executionMode=worktree` e já
 * criado; `project.path` em todo o resto. Usado por dispatch, delegate e git-handler para nunca
 * divergir sobre onde o turno/commit/push/PR da thread deve rodar.
 */
export function resolveThreadCwd(thread: Thread, project: Project): string {
  return thread.executionMode === 'worktree' && thread.worktreePath ? thread.worktreePath : project.path
}

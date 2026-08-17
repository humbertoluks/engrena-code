import { existsSync, mkdirSync, rmSync, copyFileSync } from 'fs'
import { dirname, join } from 'path'
import type { WorkingTreeDiffFile } from '../git/git-client.js'
import {
  createDiff,
  getDiff,
  promoteDiffFromConflict,
  type Diff,
  type DiffConflictCandidate,
} from '../db/repositories/diffs.js'

export class DiffConflictResolutionError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export interface ChildDiffSet {
  childThreadId: string
  subagentName: string
  worktreePath: string
  files: WorkingTreeDiffFile[]
}

export interface MergeParallelChildDiffsInput {
  parentThreadId: string
  parentCwd: string
  provider: string
  children: ChildDiffSet[]
}

/** Copia (ou remove, se o filho apagou) o arquivo do worktree do filho para o cwd real do pai. */
function materializeFileIntoParent(childWorktreePath: string, parentCwd: string, file: string): void {
  const src = join(childWorktreePath, file)
  const dest = join(parentCwd, file)
  if (existsSync(src)) {
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(src, dest)
  } else {
    rmSync(dest, { force: true })
  }
}

/**
 * Union por path (spec F18 §3.2/§6). Path exclusivo de 1 filho: só materializa o arquivo real no
 * cwd do pai (copy/remove) — não cria diff aqui, porque `dispatch.ts` roda `diffWorkingTree(cwd)`
 * no fim do turno pai (mesmo mecanismo do path serial F15) e já vai enxergar esse arquivo sozinho;
 * criar o diff aqui também duplicaria a entrada. Path tocado por ≥2 filhos: NÃO materializa
 * (ambíguo qual versão vence) — cria diff `conflict` com um candidato por filho, resolvido depois
 * via `resolveParallelConflict` (aí sim precisa criar aqui, já que o path nunca chega a ser escrito
 * no cwd do pai por `dispatch.ts` enxergar sozinho).
 */
export function mergeParallelChildDiffs(input: MergeParallelChildDiffsInput): Diff[] {
  const byPath = new Map<
    string,
    { childThreadId: string; subagentName: string; worktreePath: string; file: WorkingTreeDiffFile }[]
  >()
  for (const child of input.children) {
    for (const file of child.files) {
      const list = byPath.get(file.file) ?? []
      list.push({
        childThreadId: child.childThreadId,
        subagentName: child.subagentName,
        worktreePath: child.worktreePath,
        file,
      })
      byPath.set(file.file, list)
    }
  }

  const created: Diff[] = []
  for (const [path, entries] of byPath) {
    if (entries.length === 1) {
      // Só materializa — não cria diff aqui. O turno pai ainda vai rodar `diffWorkingTree(cwd)`
      // no fim (dispatch.ts, mesmo mecanismo do path serial F15) e vai enxergar este arquivo já
      // materializado sozinho; criar um diff aqui também duplicaria a entrada.
      materializeFileIntoParent(entries[0].worktreePath, input.parentCwd, path)
    } else {
      const candidates: DiffConflictCandidate[] = entries.map((e) => ({
        childThreadId: e.childThreadId,
        subagentName: e.subagentName,
        worktreePath: e.worktreePath,
        hunks: e.file.hunks,
        additions: e.file.additions,
        deletions: e.file.deletions,
      }))
      const first = entries[0].file
      created.push(
        createDiff({
          threadId: input.parentThreadId,
          file: path,
          additions: first.additions,
          deletions: first.deletions,
          hunks: first.hunks,
          provider: input.provider,
          status: 'conflict',
          conflictCandidates: candidates,
        })
      )
    }
  }
  return created
}

/**
 * Escolhe o vencedor de um diff `conflict` (spec F18 §5.2): materializa o arquivo do candidato
 * vencedor no cwd real do pai e promove o diff a `pending` — dali em diante accept/reject segue o
 * caminho F03 de sempre, como se o path nunca tivesse colidido.
 */
export function resolveParallelConflict(parentThreadId: string, diffId: string, winningChildThreadId: string, parentCwd: string): Diff {
  const diff = getDiff(diffId)
  if (!diff || diff.threadId !== parentThreadId) {
    throw new DiffConflictResolutionError('diff_not_found', `Diff ${diffId} não encontrado.`)
  }
  if (diff.status !== 'conflict') {
    throw new DiffConflictResolutionError('diff_not_conflict', 'Diff não está em conflito.')
  }
  const winner = (diff.conflictCandidates ?? []).find((c) => c.childThreadId === winningChildThreadId)
  if (!winner) {
    throw new DiffConflictResolutionError(
      'validation_error',
      `"${winningChildThreadId}" não é candidato deste conflito.`
    )
  }

  // O worktree do filho pode ter sumido entre o batch e a resolução (prune, restart do app, limpeza
  // de disco). Sem esta guarda o `existsSync` do arquivo dá falso e a materialização interpreta como
  // "o filho apagou este arquivo": o arquivo do pai seria removido e o diff promovido com hunks de
  // uma alteração que nunca aterrissou. Ausência do worktree não é ausência do arquivo.
  if (!existsSync(winner.worktreePath)) {
    throw new DiffConflictResolutionError(
      'worktree_missing',
      `O worktree de "${winner.subagentName}" não existe mais; não dá para materializar essa versão.`
    )
  }

  materializeFileIntoParent(winner.worktreePath, parentCwd, diff.file)

  const promoted = promoteDiffFromConflict(diffId, {
    hunks: winner.hunks,
    additions: winner.additions,
    deletions: winner.deletions,
    worktreePath: parentCwd,
  })
  return promoted as Diff
}

import { buildIndex } from './indexer.js'
import { getStatusPayload, indexPath, needsRebuild, type CodegraphStatusPayload } from './store.js'

export interface EnsureIndexResult {
  indexPath: string | null
  status: CodegraphStatusPayload
  rebuilt: boolean
}

/**
 * Ensure a fresh codegraph index before spawning the provider.
 * Failures degrade silently (no throw) — tools simply won't get an index path.
 */
export function ensureIndexForTurn(projectId: string, root: string): EnsureIndexResult {
  try {
    let rebuilt = false
    if (needsRebuild(projectId)) {
      buildIndex(projectId, root)
      rebuilt = true
    }
    const status = getStatusPayload(projectId, root)
    const path = indexPath(projectId)
    return {
      indexPath: status.status === 'missing' ? null : path,
      status,
      rebuilt,
    }
  } catch (err) {
    console.error('[codegraph] ensureIndexForTurn failed:', err)
    return {
      indexPath: null,
      status: getStatusPayload(projectId, root),
      rebuilt: false,
    }
  }
}

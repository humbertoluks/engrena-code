import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getDb } from '../db/client.js'
import { walkProjectFiles } from '../http/project-files-handler.js'
import { filterIgnoredPaths } from '../ignore/ignore-service.js'
import { chunkFile, looksBinary, toFtsQuery, type Chunk } from './chunker.js'

/**
 * Índice de trechos do projeto para o `#codebase`.
 *
 * Ranking léxico (BM25 do FTS5), não semântico: roda offline, sem modelo e sem custo — a decisão
 * tomada com o usuário. A estrutura (uma linha por chunk, reindexação por mtime) deixa a porta
 * aberta para um reranker por embeddings depois, sem mudar quem consome.
 */

export interface CodeSearchHit {
  path: string
  startLine: number
  endLine: number
  snippet: string
  score: number
}

interface FileRow {
  path: string
  mtime_ms: number
}

/** Extensões indexadas — código e texto de projeto, nada de binário ou lockfile gigante. */
const INDEXABLE = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|markdown|ya?ml|toml|css|scss|html?|sql|sh|ps1|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|swift|txt)$/i

const SKIP_FILES = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i

function indexedFiles(projectId: string): Map<string, number> {
  const rows = getDb()
    .prepare('SELECT path, mtime_ms FROM code_chunk_files WHERE project_id = ?')
    .all(projectId) as unknown as FileRow[]
  return new Map(rows.map((row) => [row.path, row.mtime_ms]))
}

function deleteFileFromIndex(projectId: string, path: string): void {
  getDb().prepare('DELETE FROM code_chunks WHERE project_id = ? AND path = ?').run(projectId, path)
  getDb().prepare('DELETE FROM code_chunk_files WHERE project_id = ? AND path = ?').run(projectId, path)
}

function insertChunks(projectId: string, path: string, chunks: Chunk[], mtimeMs: number): void {
  const insertChunk = getDb().prepare(
    'INSERT INTO code_chunks (project_id, path, start_line, end_line, body) VALUES (?, ?, ?, ?, ?)'
  )
  for (const chunk of chunks) {
    insertChunk.run(projectId, path, chunk.startLine, chunk.endLine, chunk.text)
  }
  getDb()
    .prepare(
      `INSERT INTO code_chunk_files (project_id, path, mtime_ms, indexed_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(project_id, path) DO UPDATE SET mtime_ms = excluded.mtime_ms, indexed_at = excluded.indexed_at`
    )
    .run(projectId, path, mtimeMs, Date.now())
}

export interface IndexResult {
  indexedFiles: number
  removedFiles: number
  chunks: number
}

/** Reindexação incremental: só arquivo novo ou com mtime diferente é refatiado. */
export function indexProject(projectId: string, projectRoot: string): IndexResult {
  const root = resolve(projectRoot)
  const present = filterIgnoredPaths(root, walkProjectFiles(root)).filter(
    (path) => INDEXABLE.test(path) && !SKIP_FILES.test(path)
  )
  const known = indexedFiles(projectId)
  const result: IndexResult = { indexedFiles: 0, removedFiles: 0, chunks: 0 }

  for (const path of present) {
    let mtimeMs: number
    try {
      mtimeMs = statSync(join(root, path)).mtimeMs
    } catch {
      continue
    }
    if (known.get(path) === mtimeMs) {
      known.delete(path)
      continue
    }

    let content: string
    try {
      content = readFileSync(join(root, path), 'utf8')
    } catch {
      known.delete(path)
      continue
    }
    if (looksBinary(content)) {
      known.delete(path)
      continue
    }

    const chunks = chunkFile(content)
    deleteFileFromIndex(projectId, path)
    insertChunks(projectId, path, chunks, mtimeMs)
    result.indexedFiles += 1
    result.chunks += chunks.length
    known.delete(path)
  }

  // O que sobrou em `known` não existe mais (ou passou a ser excluído) — sai do índice.
  for (const stale of known.keys()) {
    deleteFileFromIndex(projectId, stale)
    result.removedFiles += 1
  }

  return result
}

export function searchProject(projectId: string, query: string, limit = 5): CodeSearchHit[] {
  const fts = toFtsQuery(query)
  if (fts === '') return []

  let rows: Array<{ path: string; start_line: number; end_line: number; body: string; score: number }>
  try {
    rows = getDb()
      .prepare(
        `SELECT path, start_line, end_line, body, bm25(code_chunks) AS score
         FROM code_chunks
         WHERE project_id = ? AND code_chunks MATCH ?
         ORDER BY score
         LIMIT ?`
      )
      .all(projectId, fts, limit * 3) as never
  } catch {
    // Consulta malformada para o FTS5 não pode derrubar o turno nem a UI.
    return []
  }

  // Um trecho por arquivo: contexto amplo vale mais que três janelas do mesmo arquivo.
  const seen = new Set<string>()
  const hits: CodeSearchHit[] = []
  for (const row of rows) {
    if (seen.has(row.path)) continue
    seen.add(row.path)
    hits.push({
      path: row.path,
      startLine: row.start_line,
      endLine: row.end_line,
      snippet: row.body,
      score: row.score,
    })
    if (hits.length === limit) break
  }
  return hits
}

export function clearProjectIndex(projectId: string): void {
  getDb().prepare('DELETE FROM code_chunks WHERE project_id = ?').run(projectId)
  getDb().prepare('DELETE FROM code_chunk_files WHERE project_id = ?').run(projectId)
}

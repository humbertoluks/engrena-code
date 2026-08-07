import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { join } from 'path'
import { app } from 'electron'

export const CODEGRAPH_INDEX_VERSION = 1
export const CODEGRAPH_TTL_HOURS = 24

export type CodegraphStatus = 'indexed' | 'indexing' | 'unsupported' | 'missing'

export type CodegraphLanguage = 'ts' | 'js' | 'text'

export interface SymbolHit {
  file: string
  line: number
  kind: 'definition' | 'reference'
  symbolKind?: string
  snippet?: string
}

export interface FileEntry {
  language: CodegraphLanguage
  mtimeMs: number
  symbols: Array<{ name: string; line: number; kind: string; snippet?: string }>
  imports: string[]
}

export interface CodegraphIndex {
  version: number
  files: Record<string, FileEntry>
  symbols: Record<string, SymbolHit[]>
}

export interface CodegraphMeta {
  projectId: string
  root: string
  indexedAt: number
  status: 'indexed' | 'indexing' | 'unsupported'
  fileCount: number
  symbolCount: number
  ttlHours: number
}

export interface CodegraphStatusPayload {
  status: CodegraphStatus
  indexedAt: number | null
  ageHours: number | null
  fileCount: number
  symbolCount: number
  root: string | null
}

function resolveUserData(): string {
  const override = process.env.ENGRENACODE_USER_DATA
  if (override) {
    mkdirSync(override, { recursive: true })
    return override
  }
  return app.getPath('userData')
}

export function codegraphDir(projectId: string): string {
  return join(resolveUserData(), 'codegraph', projectId)
}

export function indexPath(projectId: string): string {
  return join(codegraphDir(projectId), 'index.json')
}

export function metaPath(projectId: string): string {
  return join(codegraphDir(projectId), 'meta.json')
}

function atomicWriteJson(path: string, data: unknown): void {
  const dir = join(path, '..')
  mkdirSync(dir, { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(data), { encoding: 'utf-8', mode: 0o600 })
  try {
    renameSync(tmp, path)
  } catch (err) {
    try {
      unlinkSync(tmp)
    } catch {
      /* ignore */
    }
    throw err
  }
}

export function loadMeta(projectId: string): CodegraphMeta | null {
  const path = metaPath(projectId)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as CodegraphMeta
  } catch {
    return null
  }
}

export function loadIndex(projectId: string): CodegraphIndex | null {
  const path = indexPath(projectId)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as CodegraphIndex
  } catch {
    return null
  }
}

export function saveIndexAndMeta(projectId: string, index: CodegraphIndex, meta: CodegraphMeta): void {
  mkdirSync(codegraphDir(projectId), { recursive: true })
  atomicWriteJson(indexPath(projectId), index)
  atomicWriteJson(metaPath(projectId), meta)
}

export function writeIndexingMeta(projectId: string, root: string): void {
  const prev = loadMeta(projectId)
  const meta: CodegraphMeta = {
    projectId,
    root,
    indexedAt: prev?.indexedAt ?? 0,
    status: 'indexing',
    fileCount: prev?.fileCount ?? 0,
    symbolCount: prev?.symbolCount ?? 0,
    ttlHours: CODEGRAPH_TTL_HOURS,
  }
  mkdirSync(codegraphDir(projectId), { recursive: true })
  atomicWriteJson(metaPath(projectId), meta)
}

export function isTtlExpired(meta: CodegraphMeta, now = Date.now()): boolean {
  const ttlMs = (meta.ttlHours || CODEGRAPH_TTL_HOURS) * 60 * 60 * 1000
  return now - meta.indexedAt > ttlMs
}

export function getStatusPayload(projectId: string, rootHint?: string): CodegraphStatusPayload {
  const meta = loadMeta(projectId)
  if (meta === null) {
    return {
      status: 'missing',
      indexedAt: null,
      ageHours: null,
      fileCount: 0,
      symbolCount: 0,
      root: rootHint ?? null,
    }
  }

  if (meta.status === 'indexing') {
    return {
      status: 'indexing',
      indexedAt: meta.indexedAt || null,
      ageHours: meta.indexedAt ? Math.floor((Date.now() - meta.indexedAt) / 3_600_000) : null,
      fileCount: meta.fileCount,
      symbolCount: meta.symbolCount,
      root: meta.root,
    }
  }

  if (meta.status === 'unsupported') {
    return {
      status: 'unsupported',
      indexedAt: meta.indexedAt,
      ageHours: Math.floor((Date.now() - meta.indexedAt) / 3_600_000),
      fileCount: meta.fileCount,
      symbolCount: meta.symbolCount,
      root: meta.root,
    }
  }

  return {
    status: 'indexed',
    indexedAt: meta.indexedAt,
    ageHours: Math.floor((Date.now() - meta.indexedAt) / 3_600_000),
    fileCount: meta.fileCount,
    symbolCount: meta.symbolCount,
    root: meta.root,
  }
}

/** True when ensureIndexForTurn should rebuild (missing, expired, or no index file). */
export function needsRebuild(projectId: string): boolean {
  const meta = loadMeta(projectId)
  if (meta === null) return true
  if (meta.status === 'indexing') return true
  if (!existsSync(indexPath(projectId))) return true
  if (meta.status === 'indexed' && isTtlExpired(meta)) return true
  return false
}

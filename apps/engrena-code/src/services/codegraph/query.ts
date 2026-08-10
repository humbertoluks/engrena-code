import type { CodegraphIndex, SymbolHit } from './store.js'
import { loadIndex } from './store.js'
import { existsSync, readFileSync } from 'fs'

export interface DefinitionHit {
  file: string
  line: number
  kind: string
  snippet?: string
}

export interface ReferenceHit {
  file: string
  line: number
  kind: string
}

export interface ModuleDeps {
  imports: string[]
  importedBy: string[]
}

function normalizeHint(hint?: string): string | undefined {
  if (typeof hint !== 'string' || hint.trim() === '') return undefined
  return hint.split('\\').join('/')
}

function formatDefinitionResult(symbol: string, hits: DefinitionHit[]): string {
  if (hits.length === 0) {
    return `Definition not found for symbol "${symbol}".`
  }
  const lines = [`Definition: ${symbol}`]
  for (const h of hits) {
    lines.push(`- ${h.file}:${h.line} (${h.kind})`)
    if (h.snippet) lines.push(`  ${h.snippet}`)
  }
  return lines.join('\n')
}

function formatReferencesResult(symbol: string, hits: ReferenceHit[]): string {
  if (hits.length === 0) {
    return `No references found for symbol "${symbol}".`
  }
  const lines = [`References: ${symbol} (${hits.length})`]
  for (const h of hits) {
    lines.push(`- ${h.file}:${h.line} (${h.kind})`)
  }
  return lines.join('\n')
}

function formatModuleDepsResult(file: string, deps: ModuleDeps): string {
  const lines = [`Module deps: ${file}`]
  lines.push(`imports (${deps.imports.length}):`)
  for (const i of deps.imports) lines.push(`- ${i}`)
  lines.push(`importedBy (${deps.importedBy.length}):`)
  for (const i of deps.importedBy) lines.push(`- ${i}`)
  return lines.join('\n')
}

export function findDefinition(
  index: CodegraphIndex,
  symbol: string,
  hintFile?: string,
): { hits: DefinitionHit[]; text: string } {
  const hint = normalizeHint(hintFile)
  const raw = index.symbols[symbol] ?? []
  let defs = raw.filter((h) => h.kind === 'definition')
  if (hint) {
    const scoped = defs.filter((h) => h.file === hint || h.file.endsWith(`/${hint}`))
    if (scoped.length > 0) defs = scoped
  }
  const hits: DefinitionHit[] = defs.map((h) => ({
    file: h.file,
    line: h.line,
    kind: h.symbolKind ?? 'definition',
    snippet: h.snippet,
  }))
  return { hits, text: formatDefinitionResult(symbol, hits) }
}

export function findReferences(
  index: CodegraphIndex,
  symbol: string,
  hintFile?: string,
): { hits: ReferenceHit[]; text: string } {
  const hint = normalizeHint(hintFile)
  let raw = index.symbols[symbol] ?? []
  if (hint) {
    const scoped = raw.filter((h) => h.file === hint || h.file.endsWith(`/${hint}`))
    if (scoped.length > 0) raw = scoped
  }
  let refs = raw.filter((h) => h.kind === 'reference')
  if (refs.length === 0) {
    refs = raw.filter((h) => h.kind === 'definition').slice(1)
  }
  const hits: ReferenceHit[] = refs.map((h) => ({
    file: h.file,
    line: h.line,
    kind: h.kind,
  }))
  return { hits, text: formatReferencesResult(symbol, hits) }
}

export function moduleDeps(index: CodegraphIndex, file: string): { deps: ModuleDeps; text: string } {
  const rel = normalizeHint(file) ?? file
  const entry =
    index.files[rel] ??
    Object.entries(index.files).find(([p]) => p === rel || p.endsWith(`/${rel}`))?.[1]

  const imports = entry?.imports ?? []
  const importedBy: string[] = []
  for (const [path, fe] of Object.entries(index.files)) {
    if (
      fe.imports.some(
        (imp) =>
          imp === rel ||
          imp.endsWith(`/${rel}`) ||
          imp === `./${rel}` ||
          resolveImport(imp, path) === rel ||
          (resolveImport(imp, path) !== null && rel.startsWith(resolveImport(imp, path) as string)),
      )
    ) {
      importedBy.push(path)
    }
  }

  const deps = { imports: [...imports], importedBy }
  return { deps, text: formatModuleDepsResult(rel, deps) }
}

function resolveImport(imp: string, fromFile: string): string | null {
  if (!imp.startsWith('.')) return null
  const parts = fromFile.split('/')
  parts.pop()
  for (const seg of imp.split('/')) {
    if (seg === '.' || seg === '') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}

export function findDefinitionForProject(
  projectId: string,
  symbol: string,
  hintFile?: string,
): { hits: DefinitionHit[]; text: string } {
  const index = loadIndex(projectId)
  if (index === null) {
    return { hits: [], text: `Definition not found for symbol "${symbol}" (index missing).` }
  }
  return findDefinition(index, symbol, hintFile)
}

export function findReferencesForProject(
  projectId: string,
  symbol: string,
  hintFile?: string,
): { hits: ReferenceHit[]; text: string } {
  const index = loadIndex(projectId)
  if (index === null) {
    return { hits: [], text: `No references found for symbol "${symbol}" (index missing).` }
  }
  return findReferences(index, symbol, hintFile)
}

export function moduleDepsForProject(projectId: string, file: string): { deps: ModuleDeps; text: string } {
  const index = loadIndex(projectId)
  if (index === null) {
    return {
      deps: { imports: [], importedBy: [] },
      text: `Module deps: ${file}\nimports (0):\nimportedBy (0):\n(index missing)`,
    }
  }
  return moduleDeps(index, file)
}

export function readIndexFile(path: string): CodegraphIndex | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as CodegraphIndex
  } catch {
    return null
  }
}

export type { SymbolHit }

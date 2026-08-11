import { readdirSync, readFileSync, statSync } from 'fs'
import { filterIgnoredPaths } from '../ignore/ignore-service.js'
import { join, relative, resolve } from 'path'
import ts from 'typescript'
import {
  CODEGRAPH_INDEX_VERSION,
  CODEGRAPH_TTL_HOURS,
  type CodegraphIndex,
  type CodegraphLanguage,
  type CodegraphMeta,
  type FileEntry,
  type SymbolHit,
  loadIndex,
  loadMeta,
  saveIndexAndMeta,
  writeIndexingMeta,
} from './store.js'

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.engrenacode', 'dist', 'dist-electron', 'coverage'])
const MAX_SCAN = 20000
const AST_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'])

export interface BuildIndexResult {
  index: CodegraphIndex
  meta: CodegraphMeta
}

type NamedHit = SymbolHit & { name: string }

function extOf(path: string): string {
  const i = path.lastIndexOf('.')
  return i === -1 ? '' : path.slice(i).toLowerCase()
}

function languageFor(path: string): CodegraphLanguage {
  const ext = extOf(path)
  if (ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts') return 'ts'
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') return 'js'
  return 'text'
}

function isAstFile(path: string): boolean {
  return AST_EXTS.has(extOf(path))
}

function walkProjectFiles(root: string): string[] {
  const results: string[] = []
  const stack: string[] = [root]
  let scanned = 0

  while (stack.length > 0 && scanned < MAX_SCAN) {
    const dir = stack.pop() as string
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (scanned >= MAX_SCAN) break
      scanned++
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        stack.push(join(dir, entry.name))
        continue
      }
      if (!entry.isFile()) continue
      results.push(relative(root, join(dir, entry.name)).split('\\').join('/'))
    }
  }

  return results
}

function lineOf(source: ts.SourceFile, pos: number): number {
  return source.getLineAndCharacterOfPosition(pos).line + 1
}

function snippetAt(sourceText: string, line: number): string {
  const lines = sourceText.split(/\r?\n/)
  return (lines[line - 1] ?? '').trim().slice(0, 120)
}

function indexAstFile(relPath: string, sourceText: string): { entry: Omit<FileEntry, 'mtimeMs'>; named: NamedHit[] } {
  const scriptKind =
    relPath.endsWith('.tsx') || relPath.endsWith('.jsx')
      ? ts.ScriptKind.TSX
      : relPath.endsWith('.js') || relPath.endsWith('.jsx') || relPath.endsWith('.mjs') || relPath.endsWith('.cjs')
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS

  const source = ts.createSourceFile(relPath, sourceText, ts.ScriptTarget.Latest, true, scriptKind)
  const defs: FileEntry['symbols'] = []
  const named: NamedHit[] = []
  const imports: string[] = []
  const definedNames = new Set<string>()

  const pushDef = (name: string, line: number, kind: string): void => {
    definedNames.add(name)
    const snippet = snippetAt(sourceText, line)
    defs.push({ name, line, kind, snippet })
    named.push({ name, file: relPath, line, kind: 'definition', symbolKind: kind, snippet })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      pushDef(node.name.text, lineOf(source, node.name.getStart(source)), 'function')
    } else if (ts.isClassDeclaration(node) && node.name) {
      pushDef(node.name.text, lineOf(source, node.name.getStart(source)), 'class')
    } else if (ts.isInterfaceDeclaration(node)) {
      pushDef(node.name.text, lineOf(source, node.name.getStart(source)), 'interface')
    } else if (ts.isTypeAliasDeclaration(node)) {
      pushDef(node.name.text, lineOf(source, node.name.getStart(source)), 'type')
    } else if (ts.isEnumDeclaration(node)) {
      pushDef(node.name.text, lineOf(source, node.name.getStart(source)), 'enum')
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          pushDef(decl.name.text, lineOf(source, decl.name.getStart(source)), 'variable')
        }
      }
    } else if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      pushDef(node.name.text, lineOf(source, node.name.getStart(source)), 'method')
    } else if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text)
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  const visitRefs = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const name = node.text
      if (definedNames.has(name)) {
        const parent = node.parent
        const isDeclName =
          (ts.isFunctionDeclaration(parent) && parent.name === node) ||
          (ts.isClassDeclaration(parent) && parent.name === node) ||
          (ts.isInterfaceDeclaration(parent) && parent.name === node) ||
          (ts.isTypeAliasDeclaration(parent) && parent.name === node) ||
          (ts.isEnumDeclaration(parent) && parent.name === node) ||
          (ts.isMethodDeclaration(parent) && parent.name === node) ||
          (ts.isVariableDeclaration(parent) && parent.name === node)
        if (!isDeclName) {
          const line = lineOf(source, node.getStart(source))
          named.push({ name, file: relPath, line, kind: 'reference', snippet: snippetAt(sourceText, line) })
        }
      }
    }
    ts.forEachChild(node, visitRefs)
  }
  visitRefs(source)

  return { entry: { language: languageFor(relPath), symbols: defs, imports }, named }
}

const TEXTUAL_DEF_RE =
  /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function|class|def|fn|func)\s+([A-Za-z_][\w]*)/g
const TEXTUAL_IMPORT_RE =
  /(?:from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\))/g

function indexTextFile(relPath: string, sourceText: string): { entry: Omit<FileEntry, 'mtimeMs'>; named: NamedHit[] } {
  const defs: FileEntry['symbols'] = []
  const named: NamedHit[] = []
  const imports: string[] = []

  for (const match of sourceText.matchAll(TEXTUAL_DEF_RE)) {
    const name = match[1]
    if (!name) continue
    const before = sourceText.slice(0, match.index ?? 0)
    const line = before.split(/\r?\n/).length
    const snippet = snippetAt(sourceText, line)
    defs.push({ name, line, kind: 'textual', snippet })
    named.push({ name, file: relPath, line, kind: 'definition', symbolKind: 'textual', snippet })
  }

  for (const match of sourceText.matchAll(TEXTUAL_IMPORT_RE)) {
    const spec = match[1] ?? match[2] ?? match[3]
    if (spec) imports.push(spec)
  }

  const lines = sourceText.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i] ?? ''
    for (const d of defs) {
      if (d.line === i + 1) continue
      if (new RegExp(`\\b${d.name}\\b`).test(lineText)) {
        named.push({
          name: d.name,
          file: relPath,
          line: i + 1,
          kind: 'reference',
          snippet: lineText.trim().slice(0, 120),
        })
      }
    }
  }

  return { entry: { language: 'text', symbols: defs, imports }, named }
}

function indexOneFile(relPath: string, absPath: string): { entry: FileEntry; named: NamedHit[] } {
  let sourceText: string
  let mtimeMs = 0
  try {
    mtimeMs = statSync(absPath).mtimeMs
    sourceText = readFileSync(absPath, 'utf-8')
  } catch {
    return {
      entry: { language: languageFor(relPath), mtimeMs: 0, symbols: [], imports: [] },
      named: [],
    }
  }
  if (sourceText.length > 1_500_000) sourceText = sourceText.slice(0, 1_500_000)

  const { entry, named } = isAstFile(relPath)
    ? indexAstFile(relPath, sourceText)
    : indexTextFile(relPath, sourceText)
  return { entry: { ...entry, mtimeMs }, named }
}

function invert(named: NamedHit[]): Record<string, SymbolHit[]> {
  const symbols: Record<string, SymbolHit[]> = {}
  for (const hit of named) {
    if (!symbols[hit.name]) symbols[hit.name] = []
    symbols[hit.name].push({
      file: hit.file,
      line: hit.line,
      kind: hit.kind,
      symbolKind: hit.symbolKind,
      snippet: hit.snippet,
    })
  }
  return symbols
}

/** Full rebuild of the project index under `root`. */
export function buildIndex(projectId: string, root: string): BuildIndexResult {
  const absRoot = resolve(root)
  writeIndexingMeta(projectId, absRoot)

  const relFiles = filterIgnoredPaths(absRoot, walkProjectFiles(absRoot))
  const files: Record<string, FileEntry> = {}
  const allNamed: NamedHit[] = []
  let hasTsJs = false

  for (const rel of relFiles) {
    if (isAstFile(rel)) hasTsJs = true
    const { entry, named } = indexOneFile(rel, join(absRoot, rel))
    files[rel] = entry
    allNamed.push(...named)
  }

  // Cross-file references: for each AST file, scan identifiers that match defs in other files
  const allDefNames = new Set(allNamed.filter((h) => h.kind === 'definition').map((h) => h.name))
  for (const rel of relFiles) {
    if (!isAstFile(rel)) continue
    let text: string
    try {
      text = readFileSync(join(absRoot, rel), 'utf-8')
    } catch {
      continue
    }
    const source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true)
    const localDefs = new Set((files[rel]?.symbols ?? []).map((s) => s.name))
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        const name = node.text
        if (allDefNames.has(name) && !localDefs.has(name)) {
          const line = lineOf(source, node.getStart(source))
          allNamed.push({ name, file: rel, line, kind: 'reference', snippet: snippetAt(text, line) })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  const symbols = invert(allNamed)
  const index: CodegraphIndex = { version: CODEGRAPH_INDEX_VERSION, files, symbols }
  const meta: CodegraphMeta = {
    projectId,
    root: absRoot,
    indexedAt: Date.now(),
    status: hasTsJs ? 'indexed' : 'unsupported',
    fileCount: relFiles.length,
    symbolCount: Object.keys(symbols).length,
    ttlHours: CODEGRAPH_TTL_HOURS,
  }

  saveIndexAndMeta(projectId, index, meta)
  return { index, meta }
}

/** Best-effort reindex of one relative path under project root. Returns false if skipped. */
export function reindexFile(projectId: string, root: string, relativePath: string): boolean {
  const absRoot = resolve(root)
  const rel = relativePath.split('\\').join('/')
  const abs = join(absRoot, rel)

  let index = loadIndex(projectId)
  let meta = loadMeta(projectId)
  if (index === null || meta === null) {
    buildIndex(projectId, absRoot)
    return true
  }

  let sourceExists = true
  try {
    statSync(abs)
  } catch {
    sourceExists = false
  }

  const nextSymbols: Record<string, SymbolHit[]> = {}
  for (const [name, hits] of Object.entries(index.symbols)) {
    const kept = hits.filter((h) => h.file !== rel)
    if (kept.length > 0) nextSymbols[name] = kept
  }

  if (!sourceExists) {
    const { [rel]: _removed, ...rest } = index.files
    index = { ...index, files: rest, symbols: nextSymbols }
  } else {
    const { entry, named } = indexOneFile(rel, abs)
    for (const hit of named) {
      if (!nextSymbols[hit.name]) nextSymbols[hit.name] = []
      nextSymbols[hit.name].push({
        file: hit.file,
        line: hit.line,
        kind: hit.kind,
        symbolKind: hit.symbolKind,
        snippet: hit.snippet,
      })
    }
    index = { ...index, files: { ...index.files, [rel]: entry }, symbols: nextSymbols }
  }

  meta = {
    ...meta,
    indexedAt: Date.now(),
    status: Object.keys(index.files).some((f) => isAstFile(f)) ? 'indexed' : 'unsupported',
    fileCount: Object.keys(index.files).length,
    symbolCount: Object.keys(index.symbols).length,
  }

  saveIndexAndMeta(projectId, index, meta)
  return true
}

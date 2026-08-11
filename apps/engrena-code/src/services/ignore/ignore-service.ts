import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { IGNORE_FILE_NAME, isIgnored, parseIgnoreFile, type IgnoreRule } from './ignore-matcher.js'

/**
 * Exclusões de conteúdo por projeto (`.engrenaignore` na raiz, versionável).
 *
 * Equivalente ao `ignoreService` do Copilot: nada que casa entra no contexto da IA — nem no
 * explorer, nem na menção `@`, nem como anexo, nem no índice. Cache invalidado por mtime, para o
 * usuário editar o arquivo e ver o efeito sem reiniciar o app.
 */

interface CacheEntry {
  mtimeMs: number
  rules: IgnoreRule[]
}

const cache = new Map<string, CacheEntry>()

export function loadIgnoreRules(projectRoot: string): IgnoreRule[] {
  const file = join(projectRoot, IGNORE_FILE_NAME)
  if (!existsSync(file)) {
    cache.delete(projectRoot)
    return []
  }

  try {
    const mtimeMs = statSync(file).mtimeMs
    const cached = cache.get(projectRoot)
    if (cached && cached.mtimeMs === mtimeMs) return cached.rules

    const rules = parseIgnoreFile(readFileSync(file, 'utf8'))
    cache.set(projectRoot, { mtimeMs, rules })
    return rules
  } catch {
    // arquivo ilegível não pode travar o projeto inteiro — segue sem exclusão
    return []
  }
}

export function isPathIgnored(projectRoot: string, relativePath: string, isDirectory = false): boolean {
  return isIgnored(loadIgnoreRules(projectRoot), relativePath, isDirectory)
}

export function filterIgnoredPaths(projectRoot: string, paths: readonly string[]): string[] {
  const rules = loadIgnoreRules(projectRoot)
  if (rules.length === 0) return [...paths]
  return paths.filter((path) => !isIgnored(rules, path))
}

/** Só para testes: força releitura do arquivo na próxima consulta. */
export function clearIgnoreCache(): void {
  cache.clear()
}

export { IGNORE_FILE_NAME, IGNORED_MESSAGE } from './ignore-matcher.js'

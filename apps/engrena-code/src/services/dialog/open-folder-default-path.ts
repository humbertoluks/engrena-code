import path from 'node:path'

const MAX_DEFAULT_PATH_CHARS = 4096

export interface OpenFolderDefaultPathDeps {
  homedir: string
  existsDir: (candidate: string) => boolean
  join?: (...parts: string[]) => string
  dirname?: (p: string) => string
}

/** Aceita `{ defaultPath }` do preload ou string crua; descarta o resto. */
export function parseOpenFolderDefaultPath(raw: unknown): string | undefined {
  if (typeof raw === 'string') return trimDefaultPath(raw)
  if (typeof raw !== 'object' || raw === null || !('defaultPath' in raw)) return undefined
  const value = raw.defaultPath
  return typeof value === 'string' ? trimDefaultPath(value) : undefined
}

function trimDefaultPath(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.length > MAX_DEFAULT_PATH_CHARS) return undefined
  return trimmed
}

/** Expande só `~` e `~/` / `~\` — `~user` permanece literal. */
export function expandHomePath(
  raw: string,
  homedir: string,
  join: (...parts: string[]) => string = path.join,
): string {
  if (raw === '~') return homedir
  if (raw.startsWith('~/') || raw.startsWith('~\\')) return join(homedir, raw.slice(2))
  return raw
}

/**
 * Caminho absoluto existente para `dialog.showOpenDialog({ defaultPath })`.
 * No Windows o diálogo falha ou cai em pasta genérica se o path não existir:
 * sobe até o ancestral que for diretório.
 */
export function resolveOpenFolderDefaultPath(
  raw: unknown,
  deps: OpenFolderDefaultPathDeps,
): string | undefined {
  const parsed = parseOpenFolderDefaultPath(raw)
  if (parsed === undefined) return undefined
  const join = deps.join ?? path.join
  const dirname = deps.dirname ?? path.dirname
  let current = expandHomePath(parsed, deps.homedir, join)
  for (;;) {
    if (deps.existsDir(current)) return current
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

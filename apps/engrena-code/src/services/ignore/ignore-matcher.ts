/**
 * Matcher de `.engrenaignore` — exclusão de conteúdo do contexto da IA.
 *
 * Equivalente ao content exclusion do Copilot (`platform/ignore/common/ignoreService.ts`), com a
 * sintaxe que o usuário já conhece do `.gitignore`: comentário com `#`, negação com `!`, `/` no
 * fim para diretório, `*` dentro do segmento e `**` atravessando segmentos.
 *
 * Regra de precedência igual à do git: vale o ÚLTIMO padrão que casa.
 * Módulo puro (sem fs) para ser testável e reusável pelo indexador e pelo chunker.
 */

export interface IgnoreRule {
  /** Regex já compilado contra o path relativo em POSIX. */
  matcher: RegExp
  negated: boolean
  directoryOnly: boolean
  source: string
}

const REGEX_SPECIALS = new Set(['.', '+', '^', '$', '{', '}', '(', ')', '|', '[', ']'])

function escapeRegexChar(char: string): string {
  return REGEX_SPECIALS.has(char) ? `\\${char}` : char
}

/** Traduz um glob estilo gitignore para regex ancorada no path relativo. */
function globToRegex(pattern: string): RegExp {
  const anchored = pattern.startsWith('/')
  const body = anchored ? pattern.slice(1) : pattern

  let out = ''
  let i = 0
  while (i < body.length) {
    const char = body[i]
    if (char === '*') {
      const isDouble = body[i + 1] === '*'
      if (isDouble) {
        const nextIsSlash = body[i + 2] === '/'
        out += nextIsSlash ? '(?:.*/)?' : '.*'
        i += nextIsSlash ? 3 : 2
        continue
      }
      out += '[^/]*'
      i += 1
      continue
    }
    if (char === '?') {
      out += '[^/]'
      i += 1
      continue
    }
    out += escapeRegexChar(char)
    i += 1
  }

  // Sem `/` no meio, o padrão casa em qualquer profundidade (igual ao git).
  const prefix = anchored || body.includes('/') ? '^' : '^(?:.*/)?'
  return new RegExp(`${prefix}${out}(?:/.*)?$`)
}

export function parseIgnoreFile(content: string): IgnoreRule[] {
  const rules: IgnoreRule[] = []
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue

    const negated = line.startsWith('!')
    const withoutBang = negated ? line.slice(1) : line
    const directoryOnly = withoutBang.endsWith('/')
    const pattern = directoryOnly ? withoutBang.slice(0, -1) : withoutBang
    if (pattern === '') continue

    rules.push({ matcher: globToRegex(pattern), negated, directoryOnly, source: line })
  }
  return rules
}

/** Path relativo sempre em POSIX, sem `./` na frente — o resto do módulo assume esse formato. */
function normalizePath(relativePath: string): string {
  const posix = relativePath.split('\\').join('/')
  return posix.startsWith('./') ? posix.slice(2) : posix
}

/** `true` = fora do contexto da IA. Último padrão que casa vence. */
export function isIgnored(rules: readonly IgnoreRule[], relativePath: string, isDirectory = false): boolean {
  const path = normalizePath(relativePath)
  let ignored = false
  for (const rule of rules) {
    if (rule.directoryOnly && !isDirectory && !rule.matcher.test(path)) continue
    if (!rule.matcher.test(path)) continue
    ignored = !rule.negated
  }
  return ignored
}

/** Nome do arquivo de exclusões na raiz do projeto. */
export const IGNORE_FILE_NAME = '.engrenaignore'

export const IGNORED_MESSAGE = 'Arquivo excluído do contexto por .engrenaignore.'

/**
 * O caminho que o comando toca cai dentro da raiz do projeto? (F31)
 *
 * Três respostas, e a terceira é a que importa: `undecidable`. Glob, variável, substituição e
 * caminho relativo a um cwd que não conhecemos só têm destino real depois que o shell expande, e
 * adivinhar aqui seria escrever no lugar errado com a nossa assinatura. Indecidível é `ask`.
 *
 * A comparação é feita **depois** de resolver, nunca em string crua: `proj/../../etc/passwd` passa
 * em qualquer comparação de prefixo textual. E é feita sobre `realpath` do que já existe, porque um
 * symlink dentro do projeto apontando para fora é exatamente a forma de sair sem escrever `..`.
 */
import { realpathSync } from 'node:fs'
import path from 'node:path'

export type PathScope = 'inside' | 'outside' | 'undecidable'

/**
 * Sobra do que o classificador já filtrou — defesa em profundidade. Se algum dia este módulo for
 * chamado por outro caminho, um `$HOME` não pode virar "dentro do projeto" por descuido.
 */
const UNRESOLVABLE = /[*?[\]{}$~%`]/

/**
 * Diretórios que a auto-aprovação nunca alcança, mesmo estando dentro da raiz.
 *
 * `.git` não é só dado: `.git/hooks/*` é código que o próprio git executa no próximo commit. Sem
 * esta linha, um nível que promete "editar arquivos sem interromper" viraria execução arbitrária
 * por um `cp` — e o usuário não veria card nenhum. O `acceptEdits` do Claude Code também exclui
 * caminhos protegidos.
 */
const PROTECTED_SEGMENTS = new Set(['.git'])

/** Sobe até achar um ancestral que existe, resolve o symlink dele e recola o resto. */
function realpathOfDeepestExisting(target: string): string {
  const pending: string[] = []
  let current = path.resolve(target)

  for (;;) {
    try {
      return path.resolve(realpathSync(current), ...pending.reverse())
    } catch {
      const parent = path.dirname(current)
      // Chegou na raiz do volume sem nada existir: não há symlink a desfazer, o caminho
      // normalizado é o melhor que temos.
      if (parent === current) return path.resolve(target)
      pending.push(path.basename(current))
      current = parent
    }
  }
}

function hasProtectedSegment(root: string, absolute: string): boolean {
  const rel = path.relative(root, absolute)
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return false
  return rel.split(/[\\/]/).some((segment) => PROTECTED_SEGMENTS.has(segment))
}

/**
 * Caminho absoluto que o comando realmente toca, ou `null` quando não dá para saber.
 *
 * Relativo é resolvido contra `root` porque é essa a raiz efetiva do segmento — ou o cwd do turno,
 * ou o destino do `cd` aceito no prefixo.
 */
export function resolveAgainstRoot(root: string, candidate: string): string | null {
  const cleanRoot = root.trim()
  const cleanCandidate = candidate.trim()
  if (cleanRoot === '' || !path.isAbsolute(cleanRoot)) return null
  if (cleanCandidate === '' || UNRESOLVABLE.test(cleanCandidate)) return null

  try {
    const absolute = path.isAbsolute(cleanCandidate)
      ? path.resolve(cleanCandidate)
      : path.resolve(cleanRoot, cleanCandidate)
    return realpathOfDeepestExisting(absolute)
  } catch {
    return null
  }
}

/**
 * `inside` só quando o caminho resolvido cai sob a raiz resolvida e não passa por diretório
 * protegido. Qualquer outra coisa — inclusive não saber — reprova a linha inteira.
 */
export function resolveWithinRoot(root: string, candidate: string): PathScope {
  const absolute = resolveAgainstRoot(root, candidate)
  if (absolute === null) return 'undecidable'

  let resolvedRoot: string
  try {
    resolvedRoot = realpathOfDeepestExisting(path.resolve(root.trim()))
  } catch {
    return 'undecidable'
  }

  // `path.relative` do win32 compara sem diferenciar caixa e devolve caminho absoluto quando os
  // volumes divergem — os dois casos que uma comparação de string ingênua erra no Windows.
  const rel = path.relative(resolvedRoot, absolute)
  if (rel !== '' && (rel.startsWith('..') || path.isAbsolute(rel))) return 'outside'
  return hasProtectedSegment(resolvedRoot, absolute) ? 'outside' : 'inside'
}

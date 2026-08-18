/**
 * Escopo de allowlist por **comando**, não por ferramenta.
 *
 * "Permitir todos" gravava a chave `Bash`, e isso é uma concessão muito maior do que o gesto
 * sugere: autorizar um `git status` autorizava `rm -rf` pelo resto da thread (e, com "Sempre neste
 * projeto", pelo resto da vida do projeto). Claude Code e Cursor resolvem o mesmo problema com
 * padrão de comando — `Bash(npm run *)` / `terminalAllowlist: ["git", "pnpm test"]` — e é isso que
 * este módulo produz: a chave passa a ser `Bash(git *)`.
 *
 * **Não é fronteira de segurança**, e a doc do Claude Code diz o mesmo do mecanismo dela: casamento
 * por prefixo é conveniência, contornável por composição (`git` liberado não deveria implicar
 * `git push`, e aqui implica). O que ele entrega é redução de alcance sobre o que existia antes,
 * mais um rótulo honesto no card: o usuário vê o verbo que está liberando.
 *
 * Módulo **puro** de propósito (sem `node:`, sem banco): o broker o usa no main e o
 * `PermissionPrompt` o usa no renderer para escrever o rótulo do chip. Duas cópias da regra
 * divergiriam, e a divergência apareceria como um card prometendo uma coisa e a allowlist gravando
 * outra.
 */

/** Tools cujo argumento é uma linha de shell — as únicas com escopo por comando. */
const SHELL_TOOLS = new Set(['Bash'])

/** Teto de tamanho do comando lido: acima disso não derivamos escopo (cai no nome da tool). */
const MAX_COMMAND_LENGTH = 4096

/** Quantos verbos distintos aceitamos numa concessão só. Acima disso o gesto deixa de ser legível. */
const MAX_SEGMENTS = 8

export function isShellTool(toolName: string): boolean {
  return SHELL_TOOLS.has(toolName)
}

/** `{ command }` do payload do PreToolUse; qualquer outra forma devolve `null`. */
export function commandFromParams(params: unknown): string | null {
  if (typeof params !== 'object' || params === null) return null
  const command = (params as { command?: unknown }).command
  if (typeof command !== 'string') return null
  const trimmed = command.trim()
  if (trimmed === '' || trimmed.length > MAX_COMMAND_LENGTH) return null
  return trimmed
}

/**
 * Quebra a linha em segmentos executáveis por `&&`, `||`, `;`, `|` e nova linha.
 *
 * É por isso que a derivação não pode olhar só o começo da linha: o caso real que motivou tudo é
 * `cd "C:/projeto" && printf 'x' > a.txt`, cujo primeiro verbo é `cd`. Liberar `Bash(cd *)` a
 * partir dele deixaria passar **qualquer** coisa encadeada depois de um `cd` — o oposto do que o
 * usuário achou que estava autorizando.
 *
 * Aspas são respeitadas para um `;` dentro de string não virar separador.
 */
export function splitCommandSegments(command: string): string[] {
  const segments: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i]
    const next = command[i + 1]

    if (quote !== null) {
      current += char
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    if ((char === '&' && next === '&') || (char === '|' && next === '|')) {
      segments.push(current)
      current = ''
      i += 1
      continue
    }
    if (char === ';' || char === '|' || char === '\n') {
      segments.push(current)
      current = ''
      continue
    }
    current += char
  }
  segments.push(current)

  return segments.map((s) => s.trim()).filter((s) => s !== '')
}

/**
 * Verbo de um segmento: o primeiro token, sem aspas e sem atribuição de env (`FOO=1 cmd`).
 *
 * Devolve `null` para o que não é um verbo simples — caminho com barra, substituição de comando,
 * subshell, redirecionamento solto. Nesses casos não há nome estável para mostrar ao usuário nem
 * para gravar, e a concessão cai no comportamento antigo (a tool inteira).
 */
export function commandVerb(segment: string): string | null {
  let rest = segment.trim()

  // `FOO=bar cmd args` — pula as atribuições até achar o verbo.
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(rest)) {
    const space = rest.indexOf(' ')
    if (space === -1) return null
    rest = rest.slice(space + 1).trim()
  }

  const token = rest.split(/\s/)[0] ?? ''
  const unquoted = token.replace(/^["']|["']$/g, '')
  if (unquoted === '') return null
  // Só verbo simples: nada de `./script.sh`, `$(cmd)`, `(sub)`, `>arquivo`.
  if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(unquoted)) return null
  return unquoted
}

/** Chave de allowlist para um verbo. Formato espelha o do Claude Code (`Bash(git *)`). */
export function allowlistKeyForVerb(toolName: string, verb: string): string {
  return `${toolName}(${verb} *)`
}

/**
 * As chaves que **cobrem** esta chamada. A ordem importa para quem lê:
 *
 * - `[toolName]` sempre entra, porque é a chave larga do modelo antigo — quem já concedeu `Bash`
 *   antes desta mudança (ou concedeu a partir de um comando que não dá para nomear) continua
 *   coberto, sem migração de dados.
 * - as chaves por verbo entram só quando **todos** os segmentos têm verbo simples.
 *
 * Uma chamada é auto-aprovada se a allowlist tem a chave larga **ou** todas as chaves por verbo.
 */
export interface CommandScope {
  /** Chave larga (`Bash`) — a concessão de tudo. */
  broadKey: string
  /** Uma chave por verbo distinto, na ordem em que aparecem. Vazio = sem escopo derivável. */
  verbKeys: string[]
  /** Os verbos, para a copy do card ("git, printf"). */
  verbs: string[]
}

export function commandScope(toolName: string, params: unknown): CommandScope {
  const broad: CommandScope = { broadKey: toolName, verbKeys: [], verbs: [] }
  if (!isShellTool(toolName)) return broad

  const command = commandFromParams(params)
  if (command === null) return broad

  const segments = splitCommandSegments(command)
  if (segments.length === 0 || segments.length > MAX_SEGMENTS) return broad

  const verbs: string[] = []
  for (const segment of segments) {
    const verb = commandVerb(segment)
    // Um segmento ilegível contamina a linha inteira: conceder os verbos que deu para ler
    // deixaria o resto passar de graça na próxima chamada.
    if (verb === null) return broad
    if (!verbs.includes(verb)) verbs.push(verb)
  }

  return {
    broadKey: toolName,
    verbKeys: verbs.map((verb) => allowlistKeyForVerb(toolName, verb)),
    verbs,
  }
}

/** O que "Permitir todos" grava: as chaves por verbo quando existem, senão a chave larga. */
export function keysToGrant(scope: CommandScope): string[] {
  return scope.verbKeys.length > 0 ? scope.verbKeys : [scope.broadKey]
}

/** Esta chamada está coberta por `allowed`? Chave larga cobre tudo; senão, todos os verbos. */
export function isCoveredByAllowlist(
  scope: CommandScope,
  allowed: (key: string) => boolean
): boolean {
  if (allowed(scope.broadKey)) return true
  if (scope.verbKeys.length === 0) return false
  return scope.verbKeys.every((key) => allowed(key))
}

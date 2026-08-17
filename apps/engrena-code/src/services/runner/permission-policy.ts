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

export type PermissionPolicyDecision = 'allow' | 'ask'

/** Decisão sem UI para (nível, tool); `ask` significa abrir o pedido no modal/composer. */
export function permissionPolicyDecision(
  accessLevel: ThreadAccessLevel,
  toolName: string
): PermissionPolicyDecision {
  if (accessLevel === 'full-access') return 'allow'
  if (accessLevel === 'auto-accept-edits') return AUTO_ACCEPTED.has(toolName) ? 'allow' : 'ask'
  return 'ask'
}

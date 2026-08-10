/**
 * Interpretação de texto do composer enquanto há PermissionPrompt pendente.
 * Chat não resolve o PreToolUse por si — só Allow / Deny / Allow-all (ou sinónimos curtos).
 */

export const PERMISSION_PENDING_HINT =
  'Há uma permissão pendente. Use Permitir, Permitir todos ou Negar no modal (ou responda sim/não/permitir todos).'

export type PermissionChatReply =
  | { kind: 'allow' }
  | { kind: 'allow_always' }
  | { kind: 'deny' }
  | { kind: 'blocked'; message: string }

/** Remove diacríticos para casar "não"/"nao", "sim", etc. */
function normalizeReply(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

const ALLOW = new Set(['sim', 's', 'yes', 'y', 'permitir', 'allow', 'ok', 'pode'])
const ALLOW_ALWAYS = new Set([
  'permitir todos',
  'permitir sempre',
  'sempre',
  'todas',
  'allow all',
  'always',
  'dont ask again',
  "don't ask again",
  'nao perguntar',
])
const DENY = new Set(['nao', 'n', 'no', 'negar', 'deny', 'cancelar'])

/**
 * Com modal de permissão aberto: "sim"/"não"/"permitir todos" (e sinónimos) viram decisões;
 * qualquer outro texto é bloqueado (não entra na fila de follow-up).
 */
export function interpretPermissionChatReply(text: string): PermissionChatReply {
  const normalized = normalizeReply(text)
  if (ALLOW_ALWAYS.has(normalized)) return { kind: 'allow_always' }
  if (ALLOW.has(normalized)) return { kind: 'allow' }
  if (DENY.has(normalized)) return { kind: 'deny' }
  return { kind: 'blocked', message: PERMISSION_PENDING_HINT }
}

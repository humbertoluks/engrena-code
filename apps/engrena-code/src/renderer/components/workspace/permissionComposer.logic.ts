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

/** Remove diacríticos e pontuação para casar "não,"/"nao", "Sim!", "ok." etc. */
function normalizeReply(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    // Apóstrofo some sem virar espaço para "don't ask again" continuar casando o set.
    .replace(/['’]/g, '')
    .replace(/[.,;:!?)("]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

  // Frase afirmativa comum ("Sim, pode prosseguir") também decide: exigir a palavra isolada
  // fazia a resposta natural do usuário cair no aviso de bloqueio, com o turno parado no mesmo
  // ponto. Decide pela primeira palavra, e só se nenhuma palavra do lado oposto vier depois.
  const words = normalized.split(' ').filter((w) => w !== '')
  const head = words[0]
  if (head === undefined) return { kind: 'blocked', message: PERMISSION_PENDING_HINT }
  const rest = words.slice(1)

  if (ALLOW_ALWAYS.has(`${head} ${rest[0] ?? ''}`)) return { kind: 'allow_always' }
  if (ALLOW.has(head) && !rest.some((w) => DENY.has(w))) return { kind: 'allow' }
  if (DENY.has(head) && !rest.some((w) => ALLOW.has(w))) return { kind: 'deny' }

  return { kind: 'blocked', message: PERMISSION_PENDING_HINT }
}

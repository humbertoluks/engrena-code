/**
 * Pasta inicial do diálogo nativo em Adicionar projeto: o path já digitado, senão
 * o workspace informado no desbloqueio (`engrenacode:workspace`).
 */
export function resolveBrowseStartPath(fieldPath: string, unlockedWorkspace: string): string | null {
  const fromField = fieldPath.trim()
  if (fromField !== '') return fromField
  const fromUnlock = unlockedWorkspace.trim()
  return fromUnlock === '' ? null : fromUnlock
}

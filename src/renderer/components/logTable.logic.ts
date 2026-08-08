/** Formata `createdAt` (epoch ms) na timezone/locale pt-BR usada pela grade de log entries. */
export function formatTimestamp(createdAt: number): string {
  return new Date(createdAt).toLocaleString('pt-BR')
}

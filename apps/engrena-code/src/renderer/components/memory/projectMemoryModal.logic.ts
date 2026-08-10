/** Tamanho do journal em KB com vírgula decimal pt-BR, usado no footer do modal de memória. */
export function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`
}

/** Data da última entrada do journal em locale pt-BR; devolve o ISO original se for inválido. */
export function formatEntryDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('pt-BR')
}

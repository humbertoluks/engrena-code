import { SLASH_COMMAND_NAMES, type SlashCommandName } from '../../../services/runner/slash-commands.js'

export interface SlashTrigger {
  query: string
}

/**
 * Gatilho `/` do composer (spec F22 ui.md §A) — âncora de **início** do texto (não em qualquer
 * posição, ao contrário do `@` de F16): só abre quando `/` é o primeiro caractere digitado e o
 * cursor ainda está dentro do token do nome do comando. Fecha assim que aparece o primeiro espaço
 * (fonte `commandTrigger`) — a partir daí o texto é args, e `@` pode disparar normalmente ali
 * (multiplex: comando vence enquanto o gatilho `/` está ativo).
 */
export function extractSlashTrigger(text: string, cursor: number): SlashTrigger | null {
  if (!text.startsWith('/')) return null
  const upto = text.slice(0, cursor)
  if (!upto.startsWith('/')) return null
  const afterSlash = upto.slice(1)
  if (/\s/.test(afterSlash)) return null
  return { query: afterSlash }
}

/** Filtra o catálogo estático pelo prefixo digitado (case-insensitive); ordem = catálogo (spec §5.1). */
export function matchSlashCommands(query: string): SlashCommandName[] {
  const q = query.toLowerCase()
  return SLASH_COMMAND_NAMES.filter((name) => name.toLowerCase().startsWith(q))
}

/** Substitui o token `/query` pelo `/{name} ` completo + espaço; devolve texto e cursor resultante. */
export function insertSlashCommand(text: string, name: SlashCommandName, cursor: number): { text: string; cursor: number } {
  const after = text.slice(cursor)
  const inserted = `/${name} `
  return { text: inserted + after, cursor: inserted.length }
}

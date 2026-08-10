// Módulo puro (sem Node) — importável direto pelo renderer (mesmo padrão de
// `providers/composer-images.ts`), evitando duplicar o catálogo/parse em dois lugares.

export type SlashCommandName = 'spec' | 'featdevelop' | 'featbuild'

export const SLASH_COMMAND_NAMES: readonly SlashCommandName[] = ['spec', 'featdevelop', 'featbuild']

export type SlashErrorCode = 'slash_invalid' | 'slash_unknown' | 'slash_missing_args'

export type SlashParseResult =
  | { kind: 'none' }
  | { kind: 'error'; code: SlashErrorCode; message: string }
  | { kind: 'command'; command: SlashCommandName; args: string }

/** Mensagens canônicas — copy.md `slash.error.*` (spec F22 §5.1/§6, destino sem literal na fonte). */
export const SLASH_ERROR_MESSAGE: Record<SlashErrorCode, string> = {
  slash_invalid: 'Comando slash inválido ou mal formado.',
  slash_unknown: 'Comando slash desconhecido.',
  slash_missing_args: 'Faltam argumentos após o comando.',
}

// `/` + nome (letra inicial, depois letras/dígitos/_/-) + opcionalmente espaço(s) + resto (args).
const SLASH_TOKEN_RE = /^\/([a-zA-Z][a-zA-Z0-9_-]*)(?:(\s+)([\s\S]*))?$/

function isKnownCommand(name: string): name is SlashCommandName {
  return (SLASH_COMMAND_NAMES as readonly string[]).includes(name)
}

/**
 * Parse do prompt do composer (spec F22 §5.1). `kind: 'none'` = não é slash (turno normal, prompt
 * não começa com `/`). `kind: 'error'` = começou com `/` mas é inválido/desconhecido/sem args —
 * quem chama nunca deve disparar nenhum estágio nesse caso. `kind: 'command'` = pronto para o
 * pipeline-runner.
 */
export function parseSlashCommand(prompt: string): SlashParseResult {
  if (!prompt.startsWith('/')) return { kind: 'none' }

  const match = SLASH_TOKEN_RE.exec(prompt)
  if (!match) {
    return { kind: 'error', code: 'slash_invalid', message: SLASH_ERROR_MESSAGE.slash_invalid }
  }

  const name = match[1]
  if (!isKnownCommand(name)) {
    return { kind: 'error', code: 'slash_unknown', message: SLASH_ERROR_MESSAGE.slash_unknown }
  }

  const args = (match[3] ?? '').trim()
  if (args === '') {
    return { kind: 'error', code: 'slash_missing_args', message: SLASH_ERROR_MESSAGE.slash_missing_args }
  }

  return { kind: 'command', command: name, args }
}

// Formata o bloco de memória injetado no system prompt (F20 spec §3.2) — mesmo padrão sanitizado
// de rules-block.ts. Sem dreaming implementado: a cauda do journal (entradas mais recentes) já
// funciona como "resumo consolidado" porque cada entrada individual já é um resumo curto.
const PREAMBLE = `## Memoria do projeto (EngrenaCode Memory)

O trecho abaixo e o journal de decisoes/contexto de turnos anteriores deste projeto.
Use como contexto adicional; nao e instrucao permanente (isso e papel das Rules).`

const FOOTER = '--- fim da memoria ---'

const TOKEN_BUDGET = 2000
const CHARS_PER_TOKEN = 4
const CHAR_BUDGET = TOKEN_BUDGET * CHARS_PER_TOKEN

const ENTRY_START_RE = /^### /gm

function entryStartIndices(content: string): number[] {
  const indices: number[] = []
  const re = new RegExp(ENTRY_START_RE)
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    indices.push(match.index)
  }
  return indices
}

/** Corta a cauda do journal ao teto de ~2000 tokens (heurística chars/4), removendo as entradas mais antigas primeiro. */
function truncateToTokenBudget(content: string): string {
  if (content.length <= CHAR_BUDGET) return content

  const starts = entryStartIndices(content)
  let next = content
  for (let keep = starts.length - 1; keep >= 1 && next.length > CHAR_BUDGET; keep--) {
    next = content.slice(0, starts[keep])
  }
  if (next.length > CHAR_BUDGET) {
    next = next.slice(0, CHAR_BUDGET)
  }
  return next
}

export function composeMemoryBlock(journalContent: string): string {
  if (journalContent.trim() === '') return ''

  const tail = truncateToTokenBudget(journalContent).trim()
  if (tail === '') return ''

  return [PREAMBLE, '', tail, '', FOOTER].join('\n')
}

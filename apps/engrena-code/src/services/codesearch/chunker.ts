/**
 * Fatiamento de arquivo em chunks para busca (`#codebase`).
 *
 * Espelha a ideia do `workspaceChunkSearch` do Copilot, mas com ranking léxico (FTS5/BM25) em vez
 * de embeddings: janelas de linhas com sobreposição, para um trecho relevante não ser cortado ao
 * meio pela fronteira da janela.
 *
 * Módulo puro (sem fs) — testável e reusável pelo indexador.
 */

export const CHUNK_LINES = 60
export const CHUNK_OVERLAP_LINES = 12
/** Arquivo maior que isto entra truncado: índice de contexto, não backup do repositório. */
export const MAX_INDEXED_CHARS = 400_000

export interface Chunk {
  startLine: number
  endLine: number
  text: string
}

/** Heurística de binário: byte nulo ou proporção alta de caractere de controle. */
export function looksBinary(content: string): boolean {
  if (content.includes(String.fromCharCode(0))) return true
  let control = 0
  const sample = content.slice(0, 4000)
  for (const char of sample) {
    const code = char.codePointAt(0) ?? 0
    if (code < 9 || (code > 13 && code < 32)) control += 1
  }
  return sample.length > 0 && control / sample.length > 0.02
}

export function chunkFile(
  content: string,
  options: { chunkLines?: number; overlapLines?: number } = {}
): Chunk[] {
  const chunkLines = options.chunkLines ?? CHUNK_LINES
  const overlap = Math.min(options.overlapLines ?? CHUNK_OVERLAP_LINES, chunkLines - 1)
  const trimmed = content.length > MAX_INDEXED_CHARS ? content.slice(0, MAX_INDEXED_CHARS) : content
  const lines = trimmed.split(/\r?\n/)
  if (lines.length === 0 || trimmed.trim() === '') return []

  const step = chunkLines - overlap
  const chunks: Chunk[] = []
  for (let start = 0; start < lines.length; start += step) {
    const slice = lines.slice(start, start + chunkLines)
    const text = slice.join('\n')
    if (text.trim() !== '') {
      chunks.push({ startLine: start + 1, endLine: start + slice.length, text })
    }
    if (start + chunkLines >= lines.length) break
  }
  return chunks
}

/**
 * Consulta do usuário → expressão FTS5. Cada palavra vira um termo com prefixo (`termo*`), unidos
 * por OR: pergunta em prosa não pode exigir que todas as palavras estejam no mesmo chunk.
 */
export function toFtsQuery(input: string): string {
  const terms = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter((term) => term.length >= 3)
    .slice(0, 12)
  if (terms.length === 0) return ''
  return terms.map((term) => `"${term}"*`).join(' OR ')
}

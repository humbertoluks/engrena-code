// Camada fina sobre o vault para o journal de memória por projeto (F20 spec §3.2/§4/§6).
// Um único secret por projeto (`memory:<projectId>`) guarda o journal.md inteiro como string —
// entradas concatenadas `### <ISO ts>\n<resumo>\n\n`, mais recentes no topo (prepend).
import { vaultService } from './vault-service.js'
import { createLogEntry } from '../db/repositories/log-entries.js'

const ENTRY_MARKER = '### '
const ENTRY_START_RE = /^### /gm
const MAX_BYTES = 256 * 1024

function vaultKey(projectId: string): string {
  return `memory:${projectId}`
}

export interface JournalReadResult {
  content: string
  corrupted: boolean
}

function isValidJournal(content: string): boolean {
  return content === '' || content.startsWith(ENTRY_MARKER)
}

/** Índices (na string) de cada início de entrada, na ordem em que aparecem (mais recente primeiro). */
function entryStartIndices(content: string): number[] {
  const indices: number[] = []
  const re = new RegExp(ENTRY_START_RE)
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    indices.push(match.index)
  }
  return indices
}

/**
 * Lê o journal.md do projeto. Conteúdo que não existe ainda vira journal vazio (não é corrupção);
 * conteúdo que existe mas não começa com um marcador de entrada válido é tratado como vazio com
 * `corrupted: true` (spec: "journal corrompido é tratado como vazio com aviso").
 */
export function readJournal(projectId: string): JournalReadResult {
  const raw = vaultService.getSecret(vaultKey(projectId))
  if (raw === undefined) return { content: '', corrupted: false }
  if (!isValidJournal(raw)) return { content: '', corrupted: true }
  return { content: raw, corrupted: false }
}

export function getJournalSizeBytes(projectId: string): number {
  const { content } = readJournal(projectId)
  return Buffer.byteLength(content, 'utf-8')
}

export function getEntryCount(projectId: string): number {
  const { content } = readJournal(projectId)
  if (content === '') return 0
  return entryStartIndices(content).length
}

export function getLastEntryAt(projectId: string): string | null {
  const { content } = readJournal(projectId)
  const match = /^### (.+)$/m.exec(content)
  return match ? (match[1] as string) : null
}

/** Remove entradas mais antigas (a partir do fim da string) até caber no cap de 256 KiB (FIFO). */
function truncateToFit(content: string): { content: string; truncated: boolean } {
  if (Buffer.byteLength(content, 'utf-8') <= MAX_BYTES) return { content, truncated: false }

  const starts = entryStartIndices(content)
  let next = content
  for (let keep = starts.length - 1; keep >= 1 && Buffer.byteLength(next, 'utf-8') > MAX_BYTES; keep--) {
    next = content.slice(0, starts[keep])
  }
  // Mesmo a entrada mais nova sozinha estoura o cap (resumo anormalmente grande) — corte bruto de
  // bytes como último recurso; a escrita nunca falha por causa do limite (spec 3.2).
  if (Buffer.byteLength(next, 'utf-8') > MAX_BYTES) {
    next = Buffer.from(next, 'utf-8').subarray(0, MAX_BYTES).toString('utf-8')
  }
  return { content: next, truncated: true }
}

export interface AppendEntryInput {
  projectId: string
  threadId: string
  summary: string
  now?: number
}

/**
 * Escreve nova entrada no topo do journal (prepend). Journal corrompido é descartado (tratado
 * como vazio) antes de gravar — a nova entrada nunca falha por causa de conteúdo ilegível anterior.
 */
export function appendEntry(input: AppendEntryInput): void {
  const summary = input.summary.trim()
  if (!summary) return

  const existing = readJournal(input.projectId)
  const base = existing.corrupted ? '' : existing.content
  const timestamp = new Date(input.now ?? Date.now()).toISOString()
  const combined = `${ENTRY_MARKER}${timestamp}\n${summary}\n\n${base}`

  const { content: final, truncated } = truncateToFit(combined)
  vaultService.setSecret(vaultKey(input.projectId), final)

  if (truncated) {
    createLogEntry({
      threadId: input.threadId,
      kind: 'task',
      event: 'memory: journal truncado (limite 256 KiB)',
    })
  }
}

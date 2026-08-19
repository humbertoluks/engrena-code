import { randomUUID } from 'crypto'
import { getDb } from '../client.js'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  threadId: string
  role: MessageRole
  content: string | null
  blocks: unknown[] | null
  /**
   * Id gerado pelo cliente no envio (bolha otimista do chat). `null` em tudo que nasce no
   * servidor (resposta do agente, mensagens anteriores à migração 019).
   */
  clientId: string | null
  seq: number
  createdAt: number
}

export type ToolCallStatus = 'running' | 'completed' | 'error' | 'cancelled' | 'interrupted'

export interface ToolCall {
  id: string
  threadId: string
  messageId: string | null
  name: string
  params: unknown
  status: ToolCallStatus
  result: unknown
  seq: number
  startedAt: number
  endedAt: number | null
}

interface MessageRow {
  id: string
  thread_id: string
  role: string
  content: string | null
  blocks_json: string | null
  client_id: string | null
  seq: number
  created_at: number
}

interface ToolCallRow {
  id: string
  thread_id: string
  message_id: string | null
  name: string
  params_json: string | null
  status: string
  result_json: string | null
  seq: number
  started_at: number
  ended_at: number | null
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role as MessageRole,
    content: row.content,
    blocks: row.blocks_json ? (JSON.parse(row.blocks_json) as unknown[]) : null,
    clientId: row.client_id,
    seq: row.seq,
    createdAt: row.created_at,
  }
}

function toToolCall(row: ToolCallRow): ToolCall {
  return {
    id: row.id,
    threadId: row.thread_id,
    messageId: row.message_id,
    name: row.name,
    params: row.params_json ? JSON.parse(row.params_json) : null,
    status: row.status as ToolCallStatus,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    seq: row.seq,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }
}

function nextSeq(threadId: string): number {
  const msgMax = getDb().prepare('SELECT MAX(seq) as m FROM messages WHERE thread_id = ?').get(threadId) as {
    m: number | null
  }
  const toolMax = getDb().prepare('SELECT MAX(seq) as m FROM tool_calls WHERE thread_id = ?').get(threadId) as {
    m: number | null
  }
  const max = Math.max(msgMax.m ?? -1, toolMax.m ?? -1)
  return max + 1
}

export interface AppendMessageInput {
  threadId: string
  role: MessageRole
  content?: string | null
  blocks?: unknown[] | null
  /** Id da bolha otimista do renderer; só o caminho de mensagem do usuário preenche. */
  clientId?: string | null
}

export function appendMessage(input: AppendMessageInput): Message {
  const id = randomUUID()
  const seq = nextSeq(input.threadId)
  const now = Date.now()

  getDb()
    .prepare(
      `INSERT INTO messages (id, thread_id, role, content, blocks_json, client_id, seq, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.threadId,
      input.role,
      input.content ?? null,
      input.blocks ? JSON.stringify(input.blocks) : null,
      input.clientId ?? null,
      seq,
      now
    )

  const row = getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id) as unknown as MessageRow
  return toMessage(row)
}

export function listMessagesForThread(threadId: string): Message[] {
  const rows = getDb()
    .prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY seq ASC')
    .all(threadId) as unknown as MessageRow[]
  return rows.map(toMessage)
}

export interface CreateToolCallInput {
  threadId: string
  messageId?: string | null
  name: string
  params?: unknown
  status?: ToolCallStatus
}

export function createToolCall(input: CreateToolCallInput): ToolCall {
  const id = randomUUID()
  const seq = nextSeq(input.threadId)
  const now = Date.now()

  getDb()
    .prepare(
      `INSERT INTO tool_calls (id, thread_id, message_id, name, params_json, status, result_json, seq, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`
    )
    .run(
      id,
      input.threadId,
      input.messageId ?? null,
      input.name,
      input.params !== undefined ? JSON.stringify(input.params) : null,
      input.status ?? 'running',
      seq,
      now
    )

  const row = getDb().prepare('SELECT * FROM tool_calls WHERE id = ?').get(id) as unknown as ToolCallRow
  return toToolCall(row)
}

export interface UpdateToolCallInput {
  status?: ToolCallStatus
  result?: unknown
  ended?: boolean
}

export function updateToolCall(id: string, patch: UpdateToolCallInput): ToolCall | null {
  const row = getDb().prepare('SELECT * FROM tool_calls WHERE id = ?').get(id) as ToolCallRow | undefined
  if (row === undefined) return null
  const existing = toToolCall(row)

  getDb()
    .prepare(
      `UPDATE tool_calls SET status = ?, result_json = ?, ended_at = ? WHERE id = ?`
    )
    .run(
      patch.status ?? existing.status,
      patch.result !== undefined ? JSON.stringify(patch.result) : row.result_json,
      patch.ended === true ? Date.now() : existing.endedAt,
      id
    )

  const updated = getDb().prepare('SELECT * FROM tool_calls WHERE id = ?').get(id) as unknown as ToolCallRow
  return toToolCall(updated)
}

export function listToolCallsForThread(threadId: string): ToolCall[] {
  const rows = getDb()
    .prepare('SELECT * FROM tool_calls WHERE thread_id = ? ORDER BY seq ASC')
    .all(threadId) as unknown as ToolCallRow[]
  return rows.map(toToolCall)
}

/**
 * Assenta tool calls ainda `running` (cancel/interrupt do turno).
 * Retorna as linhas atualizadas para o caller emitir WS/`tool_call.result`.
 */
export function cancelRunningToolCallsForThread(
  threadId: string,
  status: 'cancelled' | 'interrupted' = 'cancelled'
): ToolCall[] {
  const running = listToolCallsForThread(threadId).filter((tc) => tc.status === 'running')
  const updated: ToolCall[] = []
  for (const tc of running) {
    const row = updateToolCall(tc.id, { status, ended: true })
    if (row) updated.push(row)
  }
  return updated
}

// ── Janela paginada (F33) ────────────────────────────────────────────────────
//
// `listMessagesForThread` e `listToolCallsForThread` devolvem a thread inteira, sem `LIMIT`, e o
// chat rebusca o histórico a cada `tool_call.start` e `state.change`. Com resultado de tool indo até
// `TOOL_RESULT_MAX_CHARS`, uma thread madura serializa megabytes por busca. O `single-flight` do
// renderer limita a frequência, não o tamanho.
//
// A janela é keyset sobre `seq`, e isso funciona por uma propriedade que já existe: `nextSeq` tira
// `MAX(seq)` de **messages e tool_calls juntas**, então `seq` é um contador único por thread e
// ordena as duas tabelas no mesmo eixo. Os índices `ix_messages_thread_seq` e
// `ix_tool_calls_thread_seq` já cobrem exatamente essa leitura — nenhum índice novo.

/** Tamanho default da janela: cobre a conversa recente sem clique na maioria das threads. */
export const HISTORY_WINDOW_DEFAULT = 60

/** Teto duro de quem passa `limit` na query. */
export const HISTORY_WINDOW_MAX = 200

/**
 * Preview do resultado na listagem. O work log colapsado mostra bem menos que isso; buscar 64 KB
 * para exibir 2 KB é o desperdício que a rota sob demanda existe para cortar.
 */
export const TOOL_RESULT_PREVIEW_CHARS = 2 * 1024

export interface MessageWindow {
  messages: Message[]
  /** `seq` da mensagem mais antiga da janela; `null` quando a janela veio vazia. */
  cursor: number | null
  /** Existe página anterior a `cursor`. */
  hasMore: boolean
}

/**
 * Janela mais recente de mensagens, ou a página imediatamente anterior a `before`.
 *
 * `DESC` na consulta (para pegar as mais novas) e `reverse()` na saída: o chat lê em ordem
 * ascendente e inverter no SQL exigiria subquery sem ganho.
 */
export function listMessagesWindow(
  threadId: string,
  limit = HISTORY_WINDOW_DEFAULT,
  before?: number | null
): MessageWindow {
  const size = Math.min(Math.max(1, Math.trunc(limit)), HISTORY_WINDOW_MAX)
  const db = getDb()
  // Pede um a mais que a janela: a linha extra é como `hasMore` é respondido sem uma segunda
  // consulta de contagem, que numa thread grande custaria o que a paginação está economizando.
  const rows = (
    before === undefined || before === null
      ? db
          .prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY seq DESC LIMIT ?')
          .all(threadId, size + 1)
      : db
          .prepare('SELECT * FROM messages WHERE thread_id = ? AND seq < ? ORDER BY seq DESC LIMIT ?')
          .all(threadId, before, size + 1)
  ) as unknown as MessageRow[]

  const hasMore = rows.length > size
  const janela = (hasMore ? rows.slice(0, size) : rows).map(toMessage).reverse()
  return { messages: janela, cursor: janela.length === 0 ? null : janela[0].seq, hasMore }
}

/**
 * Tool calls da faixa de `seq` que a página cobre: `[fromSeq, beforeSeq)`.
 *
 * Pela faixa, e **não** por `message_id`: essa coluna é nullable em `tool_calls`, então chavear por
 * ela perderia em silêncio toda tool call sem mensagem associada.
 *
 * As páginas **azulejam** o eixo de `seq` — página k cobre de `cursor_k` (inclusive) até `cursor_{k-1}`
 * (exclusive) — e é isso que garante que nenhuma tool call fique órfã nem duplicada. O caso que
 * obriga a existir `toolCallWindowStart` é sutil: uma tool call com `seq` **anterior** à mensagem
 * mais antiga da thread (turno que chamou a tool antes de gravar qualquer mensagem) não é alcançável
 * por `seq >= cursor` de página nenhuma, e desaparecia do histórico inteiro. Na última página o piso
 * tem de ser 0, não o cursor.
 */
export function listToolCallsWindow(
  threadId: string,
  fromSeq: number | null,
  beforeSeq?: number | null
): ToolCall[] {
  if (fromSeq === null) return []
  const rows = (
    beforeSeq === undefined || beforeSeq === null
      ? getDb()
          .prepare('SELECT * FROM tool_calls WHERE thread_id = ? AND seq >= ? ORDER BY seq ASC')
          .all(threadId, fromSeq)
      : getDb()
          .prepare(
            'SELECT * FROM tool_calls WHERE thread_id = ? AND seq >= ? AND seq < ? ORDER BY seq ASC'
          )
          .all(threadId, fromSeq, beforeSeq)
  ) as unknown as ToolCallRow[]
  return rows.map(toToolCall)
}

/**
 * Piso da faixa de tool calls de uma janela.
 *
 * Sem página anterior, o piso é 0: a janela é o começo da thread, e o que vier antes da primeira
 * mensagem pertence a ela — não há página mais antiga para acolher. Com página anterior, o piso é o
 * cursor, e o resto fica para ela.
 */
export function toolCallWindowStart(window: MessageWindow): number | null {
  if (window.cursor === null) return window.hasMore ? null : 0
  return window.hasMore ? window.cursor : 0
}

/** Maior `seq` da thread, nas duas tabelas. Usado para recusar cursor fora de faixa. */
export function maxSeqForThread(threadId: string): number | null {
  const row = getDb()
    .prepare(
      `SELECT MAX(seq) AS m FROM (
         SELECT seq FROM messages WHERE thread_id = ?
         UNION ALL
         SELECT seq FROM tool_calls WHERE thread_id = ?
       )`
    )
    .get(threadId, threadId) as { m: number | null }
  return row.m
}

/** Recorte do resultado para a listagem: preview curto + o tamanho real, sem o corpo inteiro. */
export interface ToolCallResultPreview {
  resultPreview: string | null
  resultTruncated: boolean
  resultBytes: number
}

export function previewToolCallResult(result: unknown): ToolCallResultPreview {
  if (result === null || result === undefined) {
    return { resultPreview: null, resultTruncated: false, resultBytes: 0 }
  }
  const serialized = typeof result === 'string' ? result : JSON.stringify(result)
  const bytes = serialized.length
  if (bytes <= TOOL_RESULT_PREVIEW_CHARS) {
    return { resultPreview: serialized, resultTruncated: false, resultBytes: bytes }
  }
  return {
    resultPreview: serialized.slice(0, TOOL_RESULT_PREVIEW_CHARS),
    resultTruncated: true,
    resultBytes: bytes,
  }
}

/**
 * Projeção enxuta para o grafo de execução (F29): a thread **inteira**, sem nenhum corpo de
 * resultado. É o que impede a paginação do chat de amputar o grafo — deixar o grafo pedir uma
 * janela gigante seria o teto de volta, disfarçado.
 */
export interface ToolCallGraphNode {
  id: string
  name: string
  messageId: string | null
  status: ToolCallStatus
  seq: number
  startedAt: number
  endedAt: number | null
}

export function listToolCallGraphForThread(threadId: string): ToolCallGraphNode[] {
  const rows = getDb()
    .prepare(
      `SELECT id, message_id, name, status, seq, started_at, ended_at
       FROM tool_calls WHERE thread_id = ? ORDER BY seq ASC`
    )
    .all(threadId) as unknown as Array<{
    id: string
    message_id: string | null
    name: string
    status: string
    seq: number
    started_at: number
    ended_at: number | null
  }>
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    messageId: row.message_id,
    status: row.status as ToolCallStatus,
    seq: row.seq,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }))
}

/** Corpo integral do resultado de uma tool call. `null` quando a tool call não existe. */
export function getToolCallResult(id: string): { result: unknown; bytes: number } | null {
  const row = getDb().prepare('SELECT result_json FROM tool_calls WHERE id = ?').get(id) as
    | { result_json: string | null }
    | undefined
  if (row === undefined) return null
  const raw = row.result_json
  return { result: raw ? JSON.parse(raw) : null, bytes: raw === null ? 0 : raw.length }
}

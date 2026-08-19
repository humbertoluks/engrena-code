import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_audit_messages_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const { createThread } = await import('./threads.js')
const {
  appendMessage,
  cancelRunningToolCallsForThread,
  createToolCall,
  getToolCallResult,
  HISTORY_WINDOW_DEFAULT,
  listMessagesForThread,
  listMessagesWindow,
  listToolCallGraphForThread,
  listToolCallsForThread,
  listToolCallsWindow,
  maxSeqForThread,
  previewToolCallResult,
  TOOL_RESULT_PREVIEW_CHARS,
  updateToolCall,
} = await import('./messages.js')

let threadId: string

beforeEach(() => {
  getDb().exec('DELETE FROM tool_calls')
  getDb().exec('DELETE FROM messages')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')

  const project = createProject({ path: process.cwd() })
  const thread = createThread({
    projectId: project.id,
    provider: 'claude',
    accessLevel: 'supervised',
    executionMode: 'main',
  })
  threadId = thread.id
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('appendMessage', () => {
  it('persists content and round-trips blocks through JSON', () => {
    const msg = appendMessage({
      threadId,
      role: 'assistant',
      content: 'oi',
      blocks: [{ type: 'text', text: 'oi' }],
    })
    expect(msg.content).toBe('oi')
    expect(msg.blocks).toEqual([{ type: 'text', text: 'oi' }])
    expect(msg.seq).toBe(0)
  })

  it('defaults content, blocks and clientId to null when omitted', () => {
    const msg = appendMessage({ threadId, role: 'user' })
    expect(msg.content).toBeNull()
    expect(msg.blocks).toBeNull()
    expect(msg.clientId).toBeNull()
  })

  it('persists clientId and o devolve no histórico (chave da bolha otimista)', () => {
    appendMessage({ threadId, role: 'user', content: 'oi', clientId: 'bubble-1' })
    appendMessage({ threadId, role: 'assistant', content: 'resposta' })

    const messages = listMessagesForThread(threadId)
    expect(messages.map((m) => m.clientId)).toEqual(['bubble-1', null])
  })

  it('interleaves seq across messages and tool_calls for the same thread', () => {
    const m1 = appendMessage({ threadId, role: 'user', content: 'oi' })
    const tc1 = createToolCall({ threadId, name: 'load_skill' })
    const m2 = appendMessage({ threadId, role: 'assistant', content: 'pronto' })

    expect(m1.seq).toBe(0)
    expect(tc1.seq).toBe(1)
    expect(m2.seq).toBe(2)
  })
})

describe('listMessagesForThread', () => {
  it('returns messages ordered by seq ascending', () => {
    appendMessage({ threadId, role: 'user', content: 'primeiro' })
    appendMessage({ threadId, role: 'assistant', content: 'segundo' })

    const messages = listMessagesForThread(threadId)
    expect(messages.map((m) => m.content)).toEqual(['primeiro', 'segundo'])
  })

  it('returns an empty array for a thread with no messages', () => {
    expect(listMessagesForThread(threadId)).toEqual([])
  })
})

describe('createToolCall / updateToolCall', () => {
  it('creates a tool call with status=running and null result/endedAt by default', () => {
    const tc = createToolCall({ threadId, name: 'call_subagent', params: { name: 'reviewer' } })
    expect(tc.status).toBe('running')
    expect(tc.result).toBeNull()
    expect(tc.endedAt).toBeNull()
    expect(tc.params).toEqual({ name: 'reviewer' })
  })

  it('updates status/result and stamps endedAt when ended=true', () => {
    const tc = createToolCall({ threadId, name: 'load_skill' })
    const updated = updateToolCall(tc.id, { status: 'completed', result: { ok: true }, ended: true })

    expect(updated?.status).toBe('completed')
    expect(updated?.result).toEqual({ ok: true })
    expect(updated?.endedAt).not.toBeNull()
  })

  it('preserves the previous result when result is omitted from the patch', () => {
    const tc = createToolCall({ threadId, name: 'load_skill', params: null })
    updateToolCall(tc.id, { status: 'running', result: { partial: 1 } })
    const updated = updateToolCall(tc.id, { status: 'completed' })

    expect(updated?.result).toEqual({ partial: 1 })
  })

  it('returns null when updating a tool call id that does not exist', () => {
    expect(updateToolCall('does-not-exist', { status: 'error' })).toBeNull()
  })
})

describe('listToolCallsForThread', () => {
  it('returns tool calls ordered by seq ascending', () => {
    const a = createToolCall({ threadId, name: 'first' })
    const b = createToolCall({ threadId, name: 'second' })

    const calls = listToolCallsForThread(threadId)
    expect(calls.map((c) => c.id)).toEqual([a.id, b.id])
  })
})

describe('cancelRunningToolCallsForThread', () => {
  it('marks only running tool calls as cancelled and stamps endedAt', () => {
    const running = createToolCall({ threadId, name: 'Bash' })
    const done = createToolCall({ threadId, name: 'Read', status: 'completed' })
    updateToolCall(done.id, { status: 'completed', ended: true })

    const updated = cancelRunningToolCallsForThread(threadId, 'cancelled')
    expect(updated).toHaveLength(1)
    expect(updated[0]?.id).toBe(running.id)
    expect(updated[0]?.status).toBe('cancelled')
    expect(updated[0]?.endedAt).not.toBeNull()

    const all = listToolCallsForThread(threadId)
    expect(all.find((c) => c.id === done.id)?.status).toBe('completed')
  })

  it('can mark in-flight tools as interrupted (error path)', () => {
    createToolCall({ threadId, name: 'Write' })
    const updated = cancelRunningToolCallsForThread(threadId, 'interrupted')
    expect(updated[0]?.status).toBe('interrupted')
  })

  it('returns empty when nothing is running', () => {
    expect(cancelRunningToolCallsForThread(threadId)).toEqual([])
  })
})

// ── Janela paginada (F33) ────────────────────────────────────────────────────
//
// A janela é keyset sobre `seq`, e funciona porque `nextSeq` tira `MAX(seq)` de messages **e**
// tool_calls: `seq` é um contador único por thread e ordena as duas tabelas no mesmo eixo.

/** Thread nova num projeto novo, para não brigar com a thread do `beforeEach`. */
function freshThread(): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_f33_proj_'))
  const project = createProject({ path: dir })
  return createThread({
    projectId: project.id,
    provider: 'claude',
    accessLevel: 'supervised',
    executionMode: 'main',
    state: 'idle',
  }).id
}

function seedMensagens(id: string, quantas: number): void {
  for (let i = 0; i < quantas; i += 1) appendMessage({ threadId: id, role: 'user', content: `msg ${i}` })
}

describe('listMessagesWindow / listToolCallsWindow (F33)', () => {
  it('sem parâmetro devolve as mais recentes, em ordem ascendente', () => {
    const id = freshThread()
    seedMensagens(id, HISTORY_WINDOW_DEFAULT + 10)

    const janela = listMessagesWindow(id)

    expect(janela.messages).toHaveLength(HISTORY_WINDOW_DEFAULT)
    expect(janela.messages.at(-1)?.content).toBe(`msg ${HISTORY_WINDOW_DEFAULT + 9}`)
    expect(janela.messages[0].seq).toBeLessThan(janela.messages.at(-1)?.seq as number)
    expect(janela.hasMore).toBe(true)
    expect(janela.cursor).toBe(janela.messages[0].seq)
  })

  it('thread menor que a janela: sem página anterior', () => {
    const id = freshThread()
    seedMensagens(id, 3)
    const janela = listMessagesWindow(id)
    expect(janela.messages).toHaveLength(3)
    expect(janela.hasMore).toBe(false)
  })

  it('thread vazia devolve cursor nulo', () => {
    const janela = listMessagesWindow(freshThread())
    expect(janela.messages).toEqual([])
    expect(janela.cursor).toBeNull()
    expect(janela.hasMore).toBe(false)
  })

  it('before devolve a página anterior sem sobreposição nem buraco', () => {
    const id = freshThread()
    seedMensagens(id, 25)

    const primeira = listMessagesWindow(id, 10)
    const segunda = listMessagesWindow(id, 10, primeira.cursor)
    const terceira = listMessagesWindow(id, 10, segunda.cursor)

    const seqs = [...terceira.messages, ...segunda.messages, ...primeira.messages].map((m) => m.seq)
    expect(seqs).toHaveLength(25)
    expect(new Set(seqs).size).toBe(25)
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y))
    expect(terceira.hasMore).toBe(false)
  })

  it('escrita concorrente não desloca a página (keyset, não offset)', () => {
    const id = freshThread()
    seedMensagens(id, 20)

    const primeira = listMessagesWindow(id, 10)
    // Mensagem nova entre as duas leituras — o caso que mais acontece numa thread viva, e onde
    // `offset` duplicaria ou pularia uma linha.
    appendMessage({ threadId: id, role: 'assistant', content: 'nova' })
    const segunda = listMessagesWindow(id, 10, primeira.cursor)

    const ids = [...segunda.messages, ...primeira.messages].map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(segunda.messages.some((m) => m.content === 'nova')).toBe(false)
  })

  it('limit é capado no teto e nunca é zero', () => {
    const id = freshThread()
    seedMensagens(id, 5)
    expect(listMessagesWindow(id, 10_000).messages).toHaveLength(5)
    expect(listMessagesWindow(id, 0).messages).toHaveLength(1)
  })

  it('tool call sem message_id entra na faixa igual, e a de fora não entra', () => {
    const id = freshThread()
    seedMensagens(id, 5)
    // `message_id` é nullable: chavear a janela por ele perderia esta em silêncio.
    createToolCall({ threadId: id, name: 'Bash', params: {}, status: 'completed' })
    seedMensagens(id, 5)

    const recente = listMessagesWindow(id, 3)
    expect(listToolCallsWindow(id, recente.cursor)).toHaveLength(0)

    const inteira = listMessagesWindow(id, 200)
    expect(listToolCallsWindow(id, inteira.cursor).map((c) => c.name)).toEqual(['Bash'])
  })

  it('cursor nulo não busca tool call nenhuma', () => {
    expect(listToolCallsWindow(freshThread(), null)).toEqual([])
  })

  it('maxSeqForThread cobre as duas tabelas', () => {
    const id = freshThread()
    seedMensagens(id, 2)
    const call = createToolCall({ threadId: id, name: 'Read', params: {}, status: 'running' })
    expect(maxSeqForThread(id)).toBe(call.seq)
    expect(maxSeqForThread(freshThread())).toBeNull()
  })
})

describe('previewToolCallResult / getToolCallResult (F33)', () => {
  it('resultado curto vai inteiro, sem marca de truncado', () => {
    const preview = previewToolCallResult('ok')
    expect(preview.resultTruncated).toBe(false)
    // Resultado que já é string não é re-serializado: aspas extras vazariam para a tela.
    expect(preview.resultPreview).toBe('ok')
    expect(preview.resultBytes).toBe(2)
  })

  it('resultado nulo não inventa preview', () => {
    expect(previewToolCallResult(null)).toEqual({
      resultPreview: null,
      resultTruncated: false,
      resultBytes: 0,
    })
  })

  it('resultado grande vem cortado, com o tamanho real', () => {
    const grande = 'x'.repeat(TOOL_RESULT_PREVIEW_CHARS * 3)
    const preview = previewToolCallResult(grande)
    expect(preview.resultPreview).toHaveLength(TOOL_RESULT_PREVIEW_CHARS)
    expect(preview.resultTruncated).toBe(true)
    // O tamanho real é o que a UI usa para dizer que há mais.
    expect(preview.resultBytes).toBeGreaterThan(TOOL_RESULT_PREVIEW_CHARS)
  })

  it('o corpo integral sai pela consulta própria', () => {
    const id = freshThread()
    const grande = 'y'.repeat(TOOL_RESULT_PREVIEW_CHARS * 2)
    const call = createToolCall({ threadId: id, name: 'Bash', params: {}, status: 'running' })
    updateToolCall(call.id, { status: 'completed', result: grande })

    expect(getToolCallResult(call.id)?.result).toBe(grande)
    expect(getToolCallResult('tc_inexistente')).toBeNull()
  })
})

describe('listToolCallGraphForThread (F33)', () => {
  it('devolve a thread inteira e nenhum corpo de resultado', () => {
    const id = freshThread()
    for (let i = 0; i < 5; i += 1) {
      const call = createToolCall({ threadId: id, name: `T${i}`, params: {}, status: 'running' })
      updateToolCall(call.id, { status: 'completed', result: 'z'.repeat(5_000) })
      appendMessage({ threadId: id, role: 'assistant', content: `r ${i}` })
    }

    const nodes = listToolCallGraphForThread(id)

    // A paginação do chat não pode amputar o grafo.
    expect(nodes).toHaveLength(5)
    // Pequeno por construção: é isso que permite servir a thread inteira sem custo.
    expect(JSON.stringify(nodes)).not.toContain('zzzz')
    expect(nodes.map((n) => n.seq)).toEqual([...nodes.map((n) => n.seq)].sort((x, y) => x - y))
  })
})

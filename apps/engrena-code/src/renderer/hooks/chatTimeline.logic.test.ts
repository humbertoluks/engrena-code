import { describe, it, expect } from 'vitest'
import type { Message, PipelineHistory, ToolCall } from '../services/threads-service'
import type { SubagentRun } from '../services/subagents-service'
import type { StreamEvent } from '../services/ws-client'
import type { PendingMessage } from '../components/workspace/pendingMessages.logic'
import {
  chatTimelineReducer,
  emptyChatTimeline,
  makePendingMessage,
  type ChatHistorySnapshot,
  type ChatTimelineState,
} from './chatTimeline.logic'

// ── Fixtures ─────────────────────────────────────────────────────────────────

function message(patch: Partial<Message> & { id: string }): Message {
  return {
    threadId: 't1',
    role: 'assistant',
    content: 'texto',
    blocks: null,
    clientId: null,
    seq: 1,
    createdAt: 1000,
    ...patch,
  }
}

function toolCall(patch: Partial<ToolCall> & { id: string }): ToolCall {
  return {
    threadId: 't1',
    messageId: null,
    name: 'Read',
    params: {},
    status: 'completed',
    result: null,
    seq: 1,
    startedAt: 1000,
    endedAt: 2000,
    ...patch,
  }
}

function subagentRun(patch: Partial<SubagentRun> & { childThreadId: string }): SubagentRun {
  return {
    parentThreadId: 't1',
    parentToolCallId: null,
    subagentName: 'revisor',
    provider: 'claude',
    model: null,
    status: 'completed',
    text: null,
    durationMs: 10,
    reasoningLevel: null,
    actionCount: 1,
    parallelBatchId: null,
    createdAt: 1000,
    ...patch,
  }
}

function pipelineHistory(status = 'running'): PipelineHistory {
  return {
    pipeline: {
      id: 'p1',
      threadId: 't1',
      projectId: 'proj1',
      command: 'implement' as PipelineHistory['pipeline']['command'],
      status: status as PipelineHistory['pipeline']['status'],
      argsText: '',
      startedAt: 1000,
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
    },
    stages: [],
  }
}

function snapshot(patch: Partial<ChatHistorySnapshot> = {}): ChatHistorySnapshot {
  return {
    messages: [],
    feedback: [],
    toolCalls: [],
    subagentRuns: [],
    pipeline: null,
    ...patch,
  }
}

function pending(patch: Partial<PendingMessage> & { id: string }): PendingMessage {
  return { text: 'oi', images: [], status: 'sending', createdAt: 1, ...patch }
}

function stateWith(patch: Partial<ChatTimelineState>): ChatTimelineState {
  return { ...emptyChatTimeline(), ...patch }
}

// ── Invariante 1: histórico faz merge por id, nunca append ───────────────────

describe('history_loaded — merge por id', () => {
  it('não duplica linhas quando o mesmo histórico chega de novo', () => {
    const history = snapshot({
      messages: [message({ id: 'm1' }), message({ id: 'm2', seq: 2 })],
      toolCalls: [toolCall({ id: 'tc1' })],
      subagentRuns: [subagentRun({ childThreadId: 'c1' })],
    })

    const once = chatTimelineReducer(emptyChatTimeline(), { type: 'history_loaded', history })
    const twice = chatTimelineReducer(once, { type: 'history_loaded', history })

    expect(twice.messages.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(twice.toolCalls.map((t) => t.id)).toEqual(['tc1'])
    expect(twice.subagentRuns.map((r) => r.childThreadId)).toEqual(['c1'])
  })

  it('preserva a referência das linhas que não mudaram (Work log aberto não remonta)', () => {
    const first = chatTimelineReducer(emptyChatTimeline(), {
      type: 'history_loaded',
      history: snapshot({ messages: [message({ id: 'm1' })], toolCalls: [toolCall({ id: 'tc1' })] }),
    })

    const second = chatTimelineReducer(first, {
      type: 'history_loaded',
      history: snapshot({
        messages: [message({ id: 'm1' }), message({ id: 'm2', seq: 2 })],
        toolCalls: [toolCall({ id: 'tc1' })],
      }),
    })

    expect(second.messages[0]).toBe(first.messages[0])
    expect(second.toolCalls).toBe(first.toolCalls)
  })

  it('repõe pipeline e feedback de forma canónica (substituição, não merge)', () => {
    const before = stateWith({ pipeline: pipelineHistory(), feedback: { m9: 'up' } })
    const next = chatTimelineReducer(before, {
      type: 'history_loaded',
      history: snapshot({
        pipeline: null,
        feedback: [
          { messageId: 'm1', threadId: 't1', vote: 'down', note: null, createdAt: 1, updatedAt: 1 },
        ],
      }),
    })

    expect(next.pipeline).toBeNull()
    expect(next.feedback).toEqual({ m1: 'down' })
  })

  it('é uma transição única: listas, pipeline e overlay trocam juntos', () => {
    const before = stateWith({
      messages: [message({ id: 'velha' })],
      toolCalls: [toolCall({ id: 'velha' })],
      liveGraphOverlay: { rootState: 'running', rootToolDelta: 3, optimisticRuns: [], optimisticStages: [] },
      streamingText: 'parcial',
    })

    const next = chatTimelineReducer(before, {
      type: 'history_loaded',
      history: snapshot({ messages: [message({ id: 'nova' })], pipeline: pipelineHistory() }),
    })

    expect(next.messages.map((m) => m.id)).toEqual(['nova'])
    expect(next.toolCalls).toEqual([])
    expect(next.pipeline).not.toBeNull()
    expect(next.liveGraphOverlay.rootToolDelta).toBe(0)
    // O texto em streaming não é do histórico — quem o zera é `turn_settled`.
    expect(next.streamingText).toBe('parcial')
  })
})

// ── Invariante 2: refetch de fundo não mexe em historyLoading/historyError ───

describe('historyLoading / historyError são só do primeiro plano', () => {
  it('history_load_started liga o carregando e limpa o erro anterior', () => {
    const next = chatTimelineReducer(stateWith({ historyError: 'erro velho' }), {
      type: 'history_load_started',
    })
    expect(next.historyLoading).toBe(true)
    expect(next.historyError).toBeNull()
  })

  it('history_loaded (o caminho de todo refetch de fundo) não liga carregando nem grava erro', () => {
    const next = chatTimelineReducer(emptyChatTimeline(), {
      type: 'history_loaded',
      history: snapshot({ messages: [message({ id: 'm1' })] }),
    })
    expect(next.historyLoading).toBe(false)
    expect(next.historyError).toBeNull()
  })

  it('há uma action separada para a falha — refetch de fundo simplesmente não a despacha', () => {
    const failed = chatTimelineReducer(stateWith({ historyLoading: true }), {
      type: 'history_load_failed',
      message: 'boom',
    })
    expect(failed.historyError).toBe('boom')
    // O carregando só cai no settled (o `finally` do fetch em primeiro plano).
    expect(failed.historyLoading).toBe(true)
    expect(chatTimelineReducer(failed, { type: 'history_load_settled' }).historyLoading).toBe(false)
  })
})

// ── Invariante 3: bolha otimista reconcilia por id ───────────────────────────

describe('bolhas otimistas reconciliam por clientMessageId', () => {
  it('some quando o histórico traz a mensagem com o mesmo clientId', () => {
    const before = stateWith({ pendingMessages: [pending({ id: 'cid-1', status: 'sent' })] })
    const next = chatTimelineReducer(before, {
      type: 'history_loaded',
      history: snapshot({
        messages: [message({ id: 'm1', role: 'user', content: 'texto reescrito', clientId: 'cid-1' })],
      }),
    })
    expect(next.pendingMessages).toEqual([])
  })

  it('não casa por conteúdo: mesmo texto sem clientId mantém a bolha', () => {
    const before = stateWith({ pendingMessages: [pending({ id: 'cid-1', text: 'oi', status: 'sent' })] })
    const next = chatTimelineReducer(before, {
      type: 'history_loaded',
      history: snapshot({ messages: [message({ id: 'm1', role: 'user', content: 'oi', clientId: null })] }),
    })
    expect(next.pendingMessages.map((p) => p.id)).toEqual(['cid-1'])
  })
})

// ── Invariante 4: decisão de permissão nunca vira `sent`, e o resíduo é limpo ─

describe('permission_gate_opened', () => {
  it('descarta a bolha de decisão e o resíduo já promovido a sent', () => {
    const before = stateWith({
      pendingMessages: [
        pending({ id: 'p1', text: 'Permitir', status: 'permission' }),
        pending({ id: 'p2', text: 'Permitir todos', status: 'sent' }),
        pending({ id: 'p3', text: 'roda os testes', status: 'sent' }),
      ],
    })
    const next = chatTimelineReducer(before, { type: 'permission_gate_opened' })
    expect(next.pendingMessages.map((p) => p.id)).toEqual(['p3'])
  })

  it('nenhuma action promove uma bolha `permission` para `sent`', () => {
    const before = stateWith({ pendingMessages: [pending({ id: 'p1', status: 'permission' })] })
    // O único caminho de promoção é explícito e por id — o envio de turno, nunca a decisão.
    const next = chatTimelineReducer(before, {
      type: 'pending_status_changed',
      id: 'outro',
      status: 'sent',
    })
    expect(next.pendingMessages[0].status).toBe('permission')
  })
})

// ── Invariante 5: overlay otimista zera no histórico, enche no subagent.start ─

describe('liveGraphOverlay', () => {
  const subagentStart: StreamEvent = {
    type: 'subagent.start',
    threadId: 't1',
    childThreadId: 'c1',
    name: 'revisor',
  }

  it('enche de forma otimista em subagent.start', () => {
    const next = chatTimelineReducer(emptyChatTimeline(), {
      type: 'live_event_applied',
      event: subagentStart,
    })
    expect(next.liveGraphOverlay.optimisticRuns.map((r) => r.childThreadId)).toEqual(['c1'])
  })

  it('zera quando chega histórico canónico (os nós já estão nos arrays persistidos)', () => {
    const withOverlay = chatTimelineReducer(emptyChatTimeline(), {
      type: 'live_event_applied',
      event: subagentStart,
    })
    const next = chatTimelineReducer(withOverlay, { type: 'history_loaded', history: snapshot() })
    expect(next.liveGraphOverlay).toEqual(emptyChatTimeline().liveGraphOverlay)
  })

  it('zera ao selecionar outra thread', () => {
    const withOverlay = chatTimelineReducer(emptyChatTimeline(), {
      type: 'live_event_applied',
      event: subagentStart,
    })
    expect(
      chatTimelineReducer(withOverlay, { type: 'thread_selected' }).liveGraphOverlay.optimisticRuns
    ).toEqual([])
  })
})

// ── Invariante 6: streamingText acumula no delta e zera quando o turno assenta ─

describe('streamingText', () => {
  it('acumula em message.delta', () => {
    const a = chatTimelineReducer(emptyChatTimeline(), { type: 'delta_appended', text: 'oi ' })
    const b = chatTimelineReducer(a, { type: 'delta_appended', text: 'mundo' })
    expect(b.streamingText).toBe('oi mundo')
  })

  it('zera em turn_settled, turn_cancelled, thread_opened e thread_cleared', () => {
    const streaming = stateWith({ streamingText: 'parcial' })
    expect(chatTimelineReducer(streaming, { type: 'turn_settled' }).streamingText).toBe('')
    expect(chatTimelineReducer(streaming, { type: 'turn_cancelled' }).streamingText).toBe('')
    expect(chatTimelineReducer(streaming, { type: 'thread_opened' }).streamingText).toBe('')
    expect(chatTimelineReducer(streaming, { type: 'thread_cleared' }).streamingText).toBe('')
  })

  it('turn_settled não mexe na timeline — quem repõe é o refetch que vem junto', () => {
    const before = stateWith({
      streamingText: 'parcial',
      messages: [message({ id: 'm1' })],
      pendingMessages: [pending({ id: 'p1', status: 'sent' })],
    })
    const next = chatTimelineReducer(before, { type: 'turn_settled' })
    expect(next.messages).toBe(before.messages)
    expect(next.pendingMessages).toBe(before.pendingMessages)
  })
})

// ── Invariante 8: cada saída de thread zera o seu conjunto exato de campos ────

describe('troca de thread/projeto', () => {
  const busy = () =>
    stateWith({
      streamingText: 'parcial',
      messages: [message({ id: 'm1' })],
      toolCalls: [toolCall({ id: 'tc1' })],
      subagentRuns: [subagentRun({ childThreadId: 'c1' })],
      pipeline: pipelineHistory(),
      pendingMessages: [pending({ id: 'p1' })],
      liveGraphOverlay: { rootState: 'running', rootToolDelta: 2, optimisticRuns: [], optimisticStages: [] },
      historyError: 'erro',
    })

  it('thread_opened só tira o streaming de cena (as listas ficam até o histórico chegar)', () => {
    const next = chatTimelineReducer(busy(), { type: 'thread_opened' })
    expect(next.streamingText).toBe('')
    expect(next.messages).toHaveLength(1)
    expect(next.toolCalls).toHaveLength(1)
    expect(next.pendingMessages).toHaveLength(1)
  })

  it('thread_cleared (sem thread) esvazia a timeline persistida', () => {
    const next = chatTimelineReducer(busy(), { type: 'thread_cleared' })
    expect(next.streamingText).toBe('')
    expect(next.messages).toEqual([])
    expect(next.toolCalls).toEqual([])
    expect(next.subagentRuns).toEqual([])
    expect(next.pipeline).toBeNull()
    // Não uniformizar: as bolhas saem por `thread_selected`/`project_switched`, não por aqui.
    expect(next.pendingMessages).toHaveLength(1)
  })

  it('thread_selected descarta as bolhas e o overlay, e não toca no resto', () => {
    const next = chatTimelineReducer(busy(), { type: 'thread_selected' })
    expect(next.pendingMessages).toEqual([])
    expect(next.liveGraphOverlay.rootState).toBeNull()
    expect(next.messages).toHaveLength(1)
    expect(next.streamingText).toBe('parcial')
  })

  it('project_switched e new_thread_started descartam só as bolhas', () => {
    for (const type of ['project_switched', 'new_thread_started'] as const) {
      const next = chatTimelineReducer(busy(), { type })
      expect(next.pendingMessages).toEqual([])
      expect(next.liveGraphOverlay.rootState).toBe('running')
      expect(next.messages).toHaveLength(1)
    }
  })

  it('turn_cancelled zera streaming e bolhas, e mantém o histórico em tela', () => {
    const next = chatTimelineReducer(busy(), { type: 'turn_cancelled' })
    expect(next.streamingText).toBe('')
    expect(next.pendingMessages).toEqual([])
    expect(next.messages).toHaveLength(1)
  })
})

// ── Bolhas, feedback e o painel de subagente ─────────────────────────────────

describe('bolhas otimistas', () => {
  it('pending_added anexa no fim, preservando a ordem de envio', () => {
    const a = chatTimelineReducer(emptyChatTimeline(), {
      type: 'pending_added',
      pending: makePendingMessage('p1', 'primeiro', [], 'sending', 1),
    })
    const b = chatTimelineReducer(a, {
      type: 'pending_added',
      pending: makePendingMessage('p2', 'segundo', [], 'permission', 2),
    })
    expect(b.pendingMessages.map((p) => [p.id, p.status])).toEqual([
      ['p1', 'sending'],
      ['p2', 'permission'],
    ])
  })

  it('makePendingMessage copia só os campos que a bolha mostra da imagem', () => {
    const built = makePendingMessage(
      'p1',
      'com imagem',
      [{ id: 'i1', mimeType: 'image/png', name: 'a.png', dataBase64: 'AAAA', byteLength: 3 }],
      'sending',
      7
    )
    expect(built).toEqual({
      id: 'p1',
      text: 'com imagem',
      images: [{ id: 'i1', mimeType: 'image/png', name: 'a.png', dataBase64: 'AAAA' }],
      status: 'sending',
      createdAt: 7,
    })
  })

  it('pending_status_changed e pending_removed agem por id', () => {
    const before = stateWith({
      pendingMessages: [pending({ id: 'p1' }), pending({ id: 'p2' })],
    })
    const promoted = chatTimelineReducer(before, {
      type: 'pending_status_changed',
      id: 'p2',
      status: 'sent',
    })
    expect(promoted.pendingMessages.map((p) => p.status)).toEqual(['sending', 'sent'])
    const removed = chatTimelineReducer(promoted, { type: 'pending_removed', id: 'p1' })
    expect(removed.pendingMessages.map((p) => p.id)).toEqual(['p2'])
  })
})

describe('feedback e painel de subagente', () => {
  it('feedback_vote_set grava, alterna e faz rollback com o valor anterior', () => {
    const voted = chatTimelineReducer(emptyChatTimeline(), {
      type: 'feedback_vote_set',
      messageId: 'm1',
      vote: 'up',
    })
    expect(voted.feedback).toEqual({ m1: 'up' })

    const cleared = chatTimelineReducer(voted, {
      type: 'feedback_vote_set',
      messageId: 'm1',
      vote: null,
    })
    expect(cleared.feedback).toEqual({})
    expect(cleared.feedback).not.toBe(voted.feedback)

    const rolledBack = chatTimelineReducer(cleared, {
      type: 'feedback_vote_set',
      messageId: 'm1',
      vote: 'up',
    })
    expect(rolledBack.feedback).toEqual({ m1: 'up' })
  })

  it('abre e fecha o painel do subagente', () => {
    const run = subagentRun({ childThreadId: 'c1' })
    const opened = chatTimelineReducer(emptyChatTimeline(), { type: 'subagent_run_opened', run })
    expect(opened.activeSubagentRun).toBe(run)
    expect(chatTimelineReducer(opened, { type: 'subagent_run_closed' }).activeSubagentRun).toBeNull()
  })
})

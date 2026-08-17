import { describe, expect, it } from 'vitest'
import {
  buildExportSnapshot,
  exportFileName,
  exportThreadAsJson,
  exportThreadAsMarkdown,
} from './thread-export.js'
import type { Thread } from '../db/repositories/threads.js'
import type { Message, ToolCall } from '../db/repositories/messages.js'

const thread: Thread = {
  id: 'thr_abcdef12-3456',
  projectId: 'prj_1',
  provider: 'claude',
  model: 'claude-haiku-4-5',
  reasoningLevel: null,
  accessLevel: 'supervised',
  executionMode: 'main',
  worktreePath: null,
  state: 'idle',
  title: 'Ajustar o Composer',
  systemPrompt: null,
  cliSessionId: null,
  chatMode: null,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_100_000,
}

const messages: Message[] = [
  {
    id: 'msg_1',
    threadId: thread.id,
    role: 'user',
    content: 'explique este arquivo',
    blocks: [{ type: 'context', kind: 'file', path: 'src/a.ts', label: 'src/a.ts' }],
    seq: 1,
    createdAt: 1_700_000_000_000,
  },
  {
    id: 'msg_2',
    threadId: thread.id,
    role: 'assistant',
    content: 'É o composer.',
    blocks: null,
    seq: 2,
    createdAt: 1_700_000_050_000,
  },
]

const toolCalls: ToolCall[] = [
  {
    id: 'tc_1',
    threadId: thread.id,
    messageId: null,
    name: 'Read',
    params: { path: 'src/a.ts' },
    status: 'completed',
    result: null,
    seq: 1,
    startedAt: 1_700_000_010_000,
    endedAt: 1_700_000_020_000,
  },
]

function runningTool(name = 'Write'): ToolCall {
  return {
    id: 'tc_running',
    threadId: thread.id,
    messageId: null,
    name,
    params: { path: 'out.ts' },
    status: 'running',
    result: null,
    seq: 2,
    startedAt: 1_700_000_030_000,
    endedAt: null,
  }
}

describe('exportThreadAsMarkdown', () => {
  it('traz título, metadados e cada mensagem na ordem', () => {
    const md = exportThreadAsMarkdown({ thread, messages, toolCalls })
    expect(md.startsWith('# Ajustar o Composer')).toBe(true)
    expect(md).toContain('Estado: idle')
    expect(md).toContain('claude (claude-haiku-4-5)')
    expect(md).toContain('## Você')
    expect(md).toContain('explique este arquivo')
    expect(md.indexOf('explique este arquivo')).toBeLessThan(md.indexOf('É o composer.'))
  })

  it('lista o contexto anexado e o work log', () => {
    const md = exportThreadAsMarkdown({ thread, messages, toolCalls })
    expect(md).toContain('Contexto anexado: src/a.ts')
    expect(md).toContain('## Work log')
    expect(md).toContain('`Read` — completed')
  })

  it('não quebra com thread sem título nem mensagem sem texto (conversa vazia de conteúdo)', () => {
    const md = exportThreadAsMarkdown({
      thread: { ...thread, title: null },
      messages: [],
      toolCalls: [],
    })
    expect(md).toContain('Conversa sem título')
    expect(md).toContain('Mensagens: 0 · Tool calls: 0')
    expect(md).not.toContain('## Work log')
  })

  it('em running mantém tool calls running no snapshot vivo', () => {
    const md = exportThreadAsMarkdown({
      thread: { ...thread, state: 'running' },
      messages,
      toolCalls: [...toolCalls, runningTool()],
    })
    expect(md).toContain('Estado: running')
    expect(md).toContain('`Write` — running')
  })

  it('em cancelled assenta tool running como cancelled (não omite settlement)', () => {
    const md = exportThreadAsMarkdown({
      thread: { ...thread, state: 'cancelled' },
      messages,
      toolCalls: [...toolCalls, runningTool('Bash')],
    })
    expect(md).toContain('Estado: cancelled')
    expect(md).toContain('`Bash` — cancelled')
    expect(md).not.toContain('`Bash` — running')
  })
})

describe('exportThreadAsJson', () => {
  it('serializa thread, mensagens e tools', () => {
    const parsed = JSON.parse(exportThreadAsJson({ thread, messages, toolCalls })) as Record<string, unknown>
    expect((parsed.thread as Thread).id).toBe(thread.id)
    expect(parsed.messages).toHaveLength(2)
    expect(parsed.toolCalls).toHaveLength(1)
    expect(typeof parsed.exportedAt).toBe('string')
  })

  it('em cancelled serializa tool settlement no JSON', () => {
    const parsed = JSON.parse(
      exportThreadAsJson({
        thread: { ...thread, state: 'cancelled' },
        messages,
        toolCalls: [runningTool()],
      })
    ) as { toolCalls: ToolCall[] }
    expect(parsed.toolCalls[0]?.status).toBe('cancelled')
    expect(parsed.toolCalls[0]?.endedAt).not.toBeNull()
  })

  it('suporta payload grande sem truncar o conteúdo', () => {
    const big = 'x'.repeat(250_000)
    const json = exportThreadAsJson({
      thread,
      messages: [{ ...messages[0], content: big }],
      toolCalls,
    })
    expect(json.length).toBeGreaterThan(250_000)
    expect(json).toContain(big.slice(0, 64))
    expect(json).toContain(big.slice(-64))
  })
})

describe('buildExportSnapshot', () => {
  it('não altera tools running enquanto waiting_permission', () => {
    const snap = buildExportSnapshot({
      thread: { ...thread, state: 'waiting_permission' },
      messages,
      toolCalls: [runningTool()],
    })
    expect(snap.toolCalls[0]?.status).toBe('running')
  })

  it('mapeia running → interrupted quando a thread está em error', () => {
    const snap = buildExportSnapshot({
      thread: { ...thread, state: 'error' },
      messages,
      toolCalls: [runningTool()],
    })
    expect(snap.toolCalls[0]?.status).toBe('interrupted')
  })
})

describe('exportFileName', () => {
  it('higieniza o título e acrescenta o id curto', () => {
    expect(exportFileName(thread, 'md')).toBe('ajustar-o-composer-abcdef12.md')
  })

  it('cai para um nome padrão quando não há título utilizável', () => {
    expect(exportFileName({ ...thread, title: '???' }, 'json')).toBe('conversa-abcdef12.json')
  })
})

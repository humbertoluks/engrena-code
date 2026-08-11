import { describe, expect, it } from 'vitest'
import { exportFileName, exportThreadAsJson, exportThreadAsMarkdown } from './thread-export.js'
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

describe('exportThreadAsMarkdown', () => {
  it('traz título, metadados e cada mensagem na ordem', () => {
    const md = exportThreadAsMarkdown({ thread, messages, toolCalls })
    expect(md.startsWith('# Ajustar o Composer')).toBe(true)
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

  it('não quebra com thread sem título nem mensagem sem texto', () => {
    const md = exportThreadAsMarkdown({
      thread: { ...thread, title: null },
      messages: [{ ...messages[0], content: null, blocks: null }],
      toolCalls: [],
    })
    expect(md).toContain('Conversa sem título')
    expect(md).toContain('_(sem texto)_')
    expect(md).not.toContain('## Work log')
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
})

describe('exportFileName', () => {
  it('higieniza o título e acrescenta o id curto', () => {
    expect(exportFileName(thread, 'md')).toBe('ajustar-o-composer-abcdef12.md')
  })

  it('cai para um nome padrão quando não há título utilizável', () => {
    expect(exportFileName({ ...thread, title: '???' }, 'json')).toBe('conversa-abcdef12.json')
  })
})

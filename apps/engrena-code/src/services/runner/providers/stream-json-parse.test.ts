import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { parseStreamJsonLine } from './stream-json-parse.js'
import type { ProviderStreamEvent } from './provider-types.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'permission-stream')

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8')
}

function parseNdjson(name: string): ProviderStreamEvent[] {
  return readFixture(name)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => parseStreamJsonLine(line))
}

describe('parseStreamJsonLine — permission stream fixtures', () => {
  it('emits hook-started from system/hook_started (CLI 2.1.228 shape)', () => {
    const events = parseStreamJsonLine(readFixture('hook-started-pretooluse.json'))
    expect(events).toEqual([
      {
        type: 'hook-started',
        hookId: 'hook_pre_bash_simple_001',
        hookEvent: 'PreToolUse',
        hookName: 'PreToolUse:Bash',
      },
    ])
  })

  it('emits hook-response metadata without forwarding hook stdout', () => {
    const events = parseStreamJsonLine(readFixture('hook-response-allow.json'))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'hook-response',
      hookId: 'hook_pre_bash_simple_001',
      hookEvent: 'PreToolUse',
      outcome: 'success',
      exitCode: 0,
    })
    expect(JSON.stringify(events[0])).not.toContain('permissionDecision')
  })

  it('emits hook-response for deny path (exit 0 + decision in stdout, ignored here)', () => {
    const events = parseStreamJsonLine(readFixture('hook-response-deny.json'))
    expect(events[0]).toMatchObject({ type: 'hook-response', outcome: 'success', exitCode: 0 })
  })

  it('emits permission-native-denial from system/permission_denied without command body', () => {
    const events = parseStreamJsonLine(readFixture('system-permission-denied.json'))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'permission-native-denial',
      toolName: 'Bash',
      toolUseId: 'toolu_bg_bash_001',
      decisionReasonType: 'mode',
    })
    if (events[0]?.type === 'permission-native-denial') {
      expect(events[0].message).toContain('Bash')
      expect(events[0].message).toContain('EngrenaCode')
    }
    expect(JSON.stringify(events)).not.toContain('sleep')
  })

  it('strips tool_input from result.permission_denials (no secret/command leak)', () => {
    const events = parseStreamJsonLine(readFixture('result-with-permission-denials.json'))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'permission-native-denial',
      toolName: 'Bash',
      toolUseId: 'toolu_bg_bash_001',
    })
    const raw = JSON.stringify(events)
    expect(raw).not.toContain('sleep 30')
    expect(raw).not.toContain('tool_input')
    expect(raw).not.toContain('run_in_background')
  })

  it('parses Bash run_in_background tool-start params (command may appear in tool-start only)', () => {
    const events = parseStreamJsonLine(readFixture('assistant-bash-background.json'))
    expect(events).toEqual([
      {
        type: 'tool-start',
        id: 'toolu_bg_bash_001',
        name: 'Bash',
        params: {
          command: 'sleep 30',
          description: 'idle sleep fixture',
          run_in_background: true,
        },
      },
    ])
  })

  it('parses simple and compound Bash tool-start fixtures', () => {
    const simple = parseStreamJsonLine(readFixture('assistant-bash-simple.json'))
    const compound = parseStreamJsonLine(readFixture('assistant-bash-compound.json'))
    expect(simple[0]).toMatchObject({ type: 'tool-start', name: 'Bash' })
    expect((simple[0] as { params: { command: string } }).params.command).toBe('ls')
    expect((compound[0] as { params: { command: string } }).params.command).toBe('pwd && ls')
  })

  it('stream-background-native-denial.ndjson yields tool-start + native denials (Sprint 1 gate)', () => {
    const events = parseNdjson('stream-background-native-denial.ndjson')
    expect(events.some((e) => e.type === 'tool-start' && e.name === 'Bash')).toBe(true)
    const denials = events.filter((e) => e.type === 'permission-native-denial')
    expect(denials.length).toBeGreaterThanOrEqual(1)
    expect(denials.every((e) => e.type === 'permission-native-denial' && e.toolName === 'Bash')).toBe(true)
    expect(JSON.stringify(denials)).not.toContain('sleep 30')
  })

  it('stream-allow-via-hook.ndjson yields hook lifecycle + tool-result without native denial', () => {
    const events = parseNdjson('stream-allow-via-hook.ndjson')
    expect(events.map((e) => e.type)).toEqual([
      'tool-start',
      'hook-started',
      'hook-response',
      'tool-result',
    ])
    expect(events.some((e) => e.type === 'permission-native-denial')).toBe(false)
  })
})

describe('parseStreamJsonLine — content blocks malformados (R01)', () => {
  it('não joga em assistant com content: [null, 1, "x"]', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [null, 1, 'x'] },
    })
    expect(() => parseStreamJsonLine(line)).not.toThrow()
    expect(parseStreamJsonLine(line)).toEqual([])
  })

  it('não joga em user com content: [null, 1, "x"]', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { content: [null, 1, 'x'] },
    })
    expect(() => parseStreamJsonLine(line)).not.toThrow()
    expect(parseStreamJsonLine(line)).toEqual([])
  })

  it('item inválido não aborta o loop: tool_use válido ainda é emitido', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          null,
          { type: 'text', text: 'oi' },
          { type: 'tool_use', id: 'toolu_ok_001', name: 'Read', input: { file_path: '/tmp/a.txt' } },
        ],
      },
    })
    expect(parseStreamJsonLine(line)).toEqual([
      {
        type: 'tool-start',
        id: 'toolu_ok_001',
        name: 'Read',
        params: { file_path: '/tmp/a.txt' },
      },
    ])
  })

  it('item inválido não aborta o loop: tool_result válido ainda é emitido', () => {
    const line = JSON.stringify({
      type: 'user',
      message: {
        content: [
          null,
          42,
          { type: 'tool_result', tool_use_id: 'toolu_ok_001', content: 'ok', is_error: false },
        ],
      },
    })
    expect(parseStreamJsonLine(line)).toEqual([
      { type: 'tool-result', id: 'toolu_ok_001', status: 'completed', result: 'ok' },
    ])
  })
})

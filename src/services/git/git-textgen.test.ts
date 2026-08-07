import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { generateGitText, TextgenError, resetRunCliTurnForTesting, setRunCliTurnForTesting } from './git-textgen.js'
import type { ProviderTurnResult } from '../runner/providers/provider-types.js'

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd }).toString()
}

function makeDirtyRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f14_textgen_'))
  writeFileSync(join(dir, 'README.md'), '# fixture\n')
  git(dir, ['init'])
  git(dir, ['add', '-A'])
  git(dir, ['-c', 'user.name=Test', '-c', 'user.email=test@local', 'commit', '-m', 'init'])
  writeFileSync(join(dir, 'novo.txt'), 'conteudo novo\n')
  return dir
}

afterEach(() => {
  resetRunCliTurnForTesting()
})

describe('generateGitText', () => {
  it('mode=commit parses subject/body from a JSON reply', async () => {
    const dir = makeDirtyRepo()
    setRunCliTurnForTesting(async () => ({ text: '{"subject": "feat: adiciona novo.txt", "body": "detalhe"}' }) as ProviderTurnResult)

    const result = await generateGitText({ mode: 'commit', provider: 'claude', cwd: dir })
    expect(result.subject).toBe('feat: adiciona novo.txt')
    expect(result.body).toBe('detalhe')
    expect(result.title).toBeUndefined()

    rmSync(dir, { recursive: true, force: true })
  })

  it('mode=pr parses title/body/subject and strips markdown code fences', async () => {
    const dir = makeDirtyRepo()
    setRunCliTurnForTesting(
      async () =>
        ({
          text: '```json\n{"title": "feat: filtro de logs", "body": "## Summary\\n- x", "subject": "feat: filtro de logs"}\n```',
        }) as ProviderTurnResult
    )

    const result = await generateGitText({ mode: 'pr', provider: 'claude', cwd: dir })
    expect(result.title).toBe('feat: filtro de logs')
    expect(result.subject).toBe('feat: filtro de logs')
    expect(result.body).toContain('Summary')

    rmSync(dir, { recursive: true, force: true })
  })

  it('mode=pr falls back subject to title when the model omits subject', async () => {
    const dir = makeDirtyRepo()
    setRunCliTurnForTesting(async () => ({ text: '{"title": "feat: x", "body": ""}' }) as ProviderTurnResult)

    const result = await generateGitText({ mode: 'pr', provider: 'claude', cwd: dir })
    expect(result.subject).toBe('feat: x')

    rmSync(dir, { recursive: true, force: true })
  })

  it('throws textgen_failed when the provider call rejects', async () => {
    const dir = makeDirtyRepo()
    setRunCliTurnForTesting(async () => {
      throw new Error('provider spawn failed')
    })

    await expect(generateGitText({ mode: 'commit', provider: 'claude', cwd: dir })).rejects.toThrow(TextgenError)

    rmSync(dir, { recursive: true, force: true })
  })

  it('throws textgen_failed when the reply is not valid JSON', async () => {
    const dir = makeDirtyRepo()
    setRunCliTurnForTesting(async () => ({ text: 'não sei gerar isso' }) as ProviderTurnResult)

    await expect(generateGitText({ mode: 'commit', provider: 'claude', cwd: dir })).rejects.toThrow(TextgenError)

    rmSync(dir, { recursive: true, force: true })
  })

  it('throws textgen_failed when subject is missing for mode=commit', async () => {
    const dir = makeDirtyRepo()
    setRunCliTurnForTesting(async () => ({ text: '{"body": "sem subject"}' }) as ProviderTurnResult)

    await expect(generateGitText({ mode: 'commit', provider: 'claude', cwd: dir })).rejects.toThrow(TextgenError)

    rmSync(dir, { recursive: true, force: true })
  })

  it('propagates usage/costUsd from the provider result for billing (F11 reuse)', async () => {
    const dir = makeDirtyRepo()
    setRunCliTurnForTesting(
      async () =>
        ({
          text: '{"subject": "feat: x", "body": ""}',
          usage: { inputTokens: 120, outputTokens: 30, cacheReadTokens: null, cacheCreationTokens: null },
          costUsd: 0.003,
        }) as ProviderTurnResult
    )

    const result = await generateGitText({ mode: 'commit', provider: 'claude', cwd: dir })
    expect(result.usage?.inputTokens).toBe(120)
    expect(result.costUsd).toBe(0.003)

    rmSync(dir, { recursive: true, force: true })
  })
})

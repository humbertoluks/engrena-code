import { describe, expect, it } from 'vitest'
import {
  attachmentLabel,
  composePromptWithContext,
  formatContextBlock,
  MAX_ATTACHMENT_CHARS,
  MAX_CONTEXT_ATTACHMENTS,
  truncateAttachmentContent,
  validateContextAttachments,
} from './context-attachments.js'

describe('validateContextAttachments', () => {
  it('aceita lista vazia e anexos bem formados', () => {
    expect(validateContextAttachments([])).toBeNull()
    expect(
      validateContextAttachments([
        { kind: 'file', path: 'src/index.ts' },
        { kind: 'selection', path: 'src/index.ts', text: 'const a = 1', startLine: 3, endLine: 3 },
      ])
    ).toBeNull()
  })

  it('rejeita payload que não é lista', () => {
    expect(validateContextAttachments({})?.code).toBe('validation_error')
    expect(validateContextAttachments(null)?.code).toBe('validation_error')
  })

  it('rejeita acima do teto de anexos', () => {
    const many = Array.from({ length: MAX_CONTEXT_ATTACHMENTS + 1 }, (_, i) => ({ kind: 'file', path: `f${i}.ts` }))
    expect(validateContextAttachments(many)?.code).toBe('attachment_limit_exceeded')
  })

  it('rejeita anexo sem path, com kind desconhecido ou seleção vazia', () => {
    expect(validateContextAttachments([{ kind: 'file' }])?.code).toBe('attachment_invalid')
    expect(validateContextAttachments([{ kind: 'folder', path: 'src' }])?.code).toBe('attachment_invalid')
    expect(validateContextAttachments([{ kind: 'selection', path: 'a.ts', text: '  ' }])?.code).toBe('attachment_invalid')
  })

  it('rejeita seleção acima do teto de caracteres', () => {
    const text = 'x'.repeat(MAX_ATTACHMENT_CHARS + 1)
    expect(validateContextAttachments([{ kind: 'selection', path: 'a.ts', text }])?.code).toBe('attachment_too_large')
  })
})

describe('attachmentLabel', () => {
  it('usa o path do arquivo e o intervalo da seleção', () => {
    expect(attachmentLabel({ kind: 'file', path: 'src/a.ts' })).toBe('src/a.ts')
    expect(attachmentLabel({ kind: 'selection', path: 'src/a.ts', text: 'x', startLine: 10, endLine: 40 })).toBe(
      'src/a.ts:10-40'
    )
    expect(attachmentLabel({ kind: 'selection', path: 'src/a.ts', text: 'x' })).toBe('src/a.ts (seleção)')
  })
})

describe('truncateAttachmentContent', () => {
  it('mantém conteúdo curto e marca o truncado', () => {
    expect(truncateAttachmentContent('abc', 10)).toBe('abc')
    const long = truncateAttachmentContent('abcdefghijk', 5)
    expect(long.startsWith('abcde')).toBe(true)
    expect(long).toContain('truncado')
  })
})

describe('formatContextBlock / composePromptWithContext', () => {
  it('sem anexos não muda o prompt', () => {
    expect(formatContextBlock([])).toBe('')
    expect(composePromptWithContext('faça X', [])).toBe('faça X')
  })

  it('põe o contexto antes do pedido, com rótulo e cerca de código', () => {
    const out = composePromptWithContext('faça X', [{ label: 'src/a.ts', content: 'const a = 1' }])
    expect(out.indexOf('src/a.ts')).toBeLessThan(out.indexOf('faça X'))
    expect(out).toContain('## Contexto anexado pelo usuário')
    expect(out).toContain('```\nconst a = 1\n```')
  })
})

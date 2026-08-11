import { describe, expect, it } from 'vitest'
import {
  addAttachment,
  attachmentChipLabel,
  attachmentKey,
  droppedTextAsAttachment,
  makeFileAttachment,
  makeSelectionAttachment,
  MAX_ATTACHMENT_CHARS,
  MAX_CONTEXT_ATTACHMENTS,
  removeAttachment,
  toWirePayload,
  withImplicitContext,
  type ComposerAttachment,
} from './composerAttachments.logic'

describe('addAttachment', () => {
  it('adiciona e mantém ordem de chegada', () => {
    const one = addAttachment([], makeFileAttachment('a.ts'))
    expect(one.ok).toBe(true)
    if (!one.ok) return
    const two = addAttachment(one.attachments, makeFileAttachment('b.ts'))
    expect(two.ok).toBe(true)
    if (!two.ok) return
    expect(two.attachments.map((a) => attachmentChipLabel(a))).toEqual(['a.ts', 'b.ts'])
  })

  it('não duplica o mesmo arquivo', () => {
    const first = addAttachment([], makeFileAttachment('a.ts'))
    if (!first.ok) throw new Error('setup')
    const again = addAttachment(first.attachments, makeFileAttachment('a.ts'))
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.attachments).toHaveLength(1)
  })

  it('recusa acima do teto', () => {
    let list: ComposerAttachment[] = []
    for (let i = 0; i < MAX_CONTEXT_ATTACHMENTS; i++) {
      const res = addAttachment(list, makeFileAttachment(`f${i}.ts`))
      if (!res.ok) throw new Error('setup')
      list = res.attachments
    }
    const overflow = addAttachment(list, makeFileAttachment('extra.ts'))
    expect(overflow.ok).toBe(false)
    if (overflow.ok) return
    expect(overflow.message).toContain(String(MAX_CONTEXT_ATTACHMENTS))
  })

  it('recusa seleção acima do limite de caracteres', () => {
    const huge = makeSelectionAttachment('a.ts', 'x'.repeat(MAX_ATTACHMENT_CHARS + 1))
    expect(addAttachment([], huge).ok).toBe(false)
  })
})

describe('removeAttachment', () => {
  it('remove por id', () => {
    const a = makeFileAttachment('a.ts')
    const b = makeFileAttachment('b.ts')
    expect(removeAttachment([a, b], a.id)).toEqual([b])
  })
})

describe('attachmentChipLabel / toWirePayload', () => {
  it('rotula arquivo e seleção com intervalo', () => {
    expect(attachmentChipLabel(makeFileAttachment('src/a.ts'))).toBe('src/a.ts')
    expect(attachmentChipLabel(makeSelectionAttachment('src/a.ts', 'x', { startLine: 2, endLine: 9 }))).toBe(
      'src/a.ts:2-9'
    )
  })

  it('converte para o payload do servidor sem id nem flag implícita', () => {
    const wire = toWirePayload([makeFileAttachment('a.ts', true), makeSelectionAttachment('b.ts', 'texto')])
    expect(wire).toEqual([
      { kind: 'file', path: 'a.ts' },
      { kind: 'selection', path: 'b.ts', text: 'texto' },
    ])
  })
})

describe('withImplicitContext', () => {
  it('acrescenta o arquivo aberto quando ligado', () => {
    const out = withImplicitContext([], { path: 'src/a.ts' }, true)
    expect(out).toHaveLength(1)
    expect(out[0].implicit).toBe(true)
    expect(attachmentChipLabel(out[0])).toBe('src/a.ts')
  })

  it('usa a seleção quando existe', () => {
    const out = withImplicitContext([], { path: 'a.ts', selection: { text: 'const x', startLine: 4, endLine: 4 } }, true)
    expect(attachmentChipLabel(out[0])).toBe('a.ts:4-4')
  })

  it('não entra quando desligado ou sem arquivo aberto', () => {
    expect(withImplicitContext([], { path: 'a.ts' }, false)).toEqual([])
    expect(withImplicitContext([], null, true)).toEqual([])
  })

  it('não duplica arquivo que já foi anexado à mão', () => {
    const explicit = makeFileAttachment('a.ts')
    const out = withImplicitContext([explicit], { path: 'a.ts' }, true)
    expect(out).toEqual([explicit])
  })

  it('troca o implícito anterior em vez de empilhar', () => {
    const first = withImplicitContext([], { path: 'a.ts' }, true)
    const second = withImplicitContext(first, { path: 'b.ts' }, true)
    expect(second).toHaveLength(1)
    expect(attachmentChipLabel(second[0])).toBe('b.ts')
  })
})

describe('droppedTextAsAttachment', () => {
  it('vira seleção com o nome do arquivo e conteúdo truncado', () => {
    const att = droppedTextAsAttachment('notas.md', 'y'.repeat(MAX_ATTACHMENT_CHARS + 50))
    expect(att.kind).toBe('selection')
    expect(attachmentKey(att)).toContain('notas.md')
    if (att.kind !== 'selection') return
    expect(att.text.length).toBe(MAX_ATTACHMENT_CHARS)
  })
})

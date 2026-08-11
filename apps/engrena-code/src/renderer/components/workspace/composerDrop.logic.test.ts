import { describe, expect, it } from 'vitest'
import { classifyDroppedFile, classifyDroppedFiles, DROP_PATH_MIME } from './composerDrop.logic'

describe('classifyDroppedFile', () => {
  it('reconhece imagem pelo mime', () => {
    expect(classifyDroppedFile({ name: 'print.png', type: 'image/png' })).toBe('image')
  })

  it('reconhece texto pelo mime ou pela extensão', () => {
    expect(classifyDroppedFile({ name: 'notas', type: 'text/plain' })).toBe('text')
    expect(classifyDroppedFile({ name: 'server.ts', type: '' })).toBe('text')
    expect(classifyDroppedFile({ name: 'config.yaml', type: '' })).toBe('text')
  })

  it('marca binário desconhecido como não suportado', () => {
    expect(classifyDroppedFile({ name: 'app.zip', type: 'application/zip' })).toBe('unsupported')
    expect(classifyDroppedFile({ name: 'video.mp4', type: 'video/mp4' })).toBe('unsupported')
  })
})

describe('classifyDroppedFiles', () => {
  it('mantém o nome do item não suportado para a mensagem de erro', () => {
    const out = classifyDroppedFiles([{ name: 'app.zip', type: 'application/zip' } as File])
    expect(out[0]).toEqual({ kind: 'unsupported', name: 'app.zip' })
  })
})

describe('DROP_PATH_MIME', () => {
  it('é um mime próprio, para não colidir com text/plain do SO', () => {
    expect(DROP_PATH_MIME.startsWith('application/x-')).toBe(true)
  })
})

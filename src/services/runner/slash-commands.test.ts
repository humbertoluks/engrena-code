import { describe, expect, it } from 'vitest'
import { parseSlashCommand } from './slash-commands.js'

describe('parseSlashCommand', () => {
  it('returns kind=none for a prompt without a leading slash', () => {
    expect(parseSlashCommand('faz um refactor em src/a.ts')).toEqual({ kind: 'none' })
  })

  it('parses the 3 native commands with args', () => {
    expect(parseSlashCommand('/spec Adicionar X')).toEqual({ kind: 'command', command: 'spec', args: 'Adicionar X' })
    expect(parseSlashCommand('/featdevelop Adicionar Y')).toEqual({
      kind: 'command',
      command: 'featdevelop',
      args: 'Adicionar Y',
    })
    expect(parseSlashCommand('/featbuild ## Passo 1\nfaz isso')).toEqual({
      kind: 'command',
      command: 'featbuild',
      args: '## Passo 1\nfaz isso',
    })
  })

  it('trims surrounding whitespace from args', () => {
    expect(parseSlashCommand('/spec   Adicionar X   ')).toEqual({
      kind: 'command',
      command: 'spec',
      args: 'Adicionar X',
    })
  })

  it('rejects an unknown command', () => {
    expect(parseSlashCommand('/foo bar')).toEqual({
      kind: 'error',
      code: 'slash_unknown',
      message: 'Comando slash desconhecido.',
    })
  })

  it('does not confuse /specx with /spec (word boundary)', () => {
    expect(parseSlashCommand('/specx Adicionar X')).toEqual({
      kind: 'error',
      code: 'slash_unknown',
      message: 'Comando slash desconhecido.',
    })
  })

  it('rejects a known command with no args', () => {
    expect(parseSlashCommand('/spec')).toEqual({
      kind: 'error',
      code: 'slash_missing_args',
      message: 'Faltam argumentos após o comando.',
    })
  })

  it('rejects a known command with only whitespace args', () => {
    expect(parseSlashCommand('/spec    ')).toEqual({
      kind: 'error',
      code: 'slash_missing_args',
      message: 'Faltam argumentos após o comando.',
    })
  })

  it('rejects malformed slash tokens', () => {
    expect(parseSlashCommand('/')).toEqual({
      kind: 'error',
      code: 'slash_invalid',
      message: 'Comando slash inválido ou mal formado.',
    })
    expect(parseSlashCommand('/ spec algo')).toEqual({
      kind: 'error',
      code: 'slash_invalid',
      message: 'Comando slash inválido ou mal formado.',
    })
    expect(parseSlashCommand('/2fast algo')).toEqual({
      kind: 'error',
      code: 'slash_invalid',
      message: 'Comando slash inválido ou mal formado.',
    })
  })
})

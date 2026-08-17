import { describe, expect, it } from 'vitest'
import {
  extractSlashTrigger,
  insertSavedPrompt,
  insertSlashCommand,
  matchSavedPromptNames,
  matchSlashCommands,
  slashMenuJustOpened,
} from './commandTrigger.js'

describe('extractSlashTrigger', () => {
  it('opens only when / anchors the very start of the text', () => {
    expect(extractSlashTrigger('/spec', 5)).toEqual({ query: 'spec' })
    expect(extractSlashTrigger('faz algo /spec', 14)).toBeNull()
  })

  it('tracks the query as the user types after the slash', () => {
    expect(extractSlashTrigger('/', 1)).toEqual({ query: '' })
    expect(extractSlashTrigger('/fe', 3)).toEqual({ query: 'fe' })
  })

  it('closes after the first whitespace (fonte commandTrigger)', () => {
    expect(extractSlashTrigger('/spec algo', 6)).toBeNull()
    expect(extractSlashTrigger('/spec algo', 10)).toBeNull()
  })

  it('cursor before the trigger start returns null', () => {
    expect(extractSlashTrigger('/spec', 0)).toBeNull()
  })
})

describe('matchSlashCommands', () => {
  it('returns all 3 native commands for an empty query, in catalog order', () => {
    expect(matchSlashCommands('')).toEqual(['spec', 'featdevelop', 'featbuild'])
  })

  it('filters by case-insensitive prefix', () => {
    expect(matchSlashCommands('fe')).toEqual(['featdevelop', 'featbuild'])
    expect(matchSlashCommands('SPE')).toEqual(['spec'])
  })

  it('returns empty for a query matching nothing (menu.empty state)', () => {
    expect(matchSlashCommands('zzz')).toEqual([])
  })
})

describe('insertSlashCommand', () => {
  it('replaces the token from the start with /{name} plus a trailing space', () => {
    const result = insertSlashCommand('/sp', 'spec', 3)
    expect(result).toEqual({ text: '/spec ', cursor: 6 })
  })
})

describe('matchSavedPromptNames', () => {
  const names = ['revisao-pr', 'refatora', 'commit']

  it('filtra por prefixo, sem diferenciar maiúscula', () => {
    expect(matchSavedPromptNames('re', names)).toEqual(['revisao-pr', 'refatora'])
    expect(matchSavedPromptNames('COM', names)).toEqual(['commit'])
  })

  it('query vazia devolve todos e query sem casamento devolve nada', () => {
    expect(matchSavedPromptNames('', names)).toEqual(names)
    expect(matchSavedPromptNames('zzz', names)).toEqual([])
  })
})

describe('insertSavedPrompt', () => {
  it('troca o token /nome pelo corpo do prompt', () => {
    const result = insertSavedPrompt('/rev', 'Revise o diff', 4)
    expect(result.text).toBe('Revise o diff')
    expect(result.cursor).toBe(13)
    expect(result.selection).toBeNull()
  })

  it('preserva o texto depois do cursor', () => {
    const result = insertSavedPrompt('/rev agora', 'Revise', 4)
    expect(result.text).toBe('Revise agora')
  })

  it('devolve a faixa da primeira variável para o composer selecionar', () => {
    const result = insertSavedPrompt('/rev', 'Revise ${input:arquivo:src/app.ts}', 4)
    expect(result.text).toBe('Revise src/app.ts')
    expect(result.selection).toEqual({ start: 7, end: 17 })
  })
})

describe('slashMenuJustOpened', () => {
  it('só a borda null → aberto conta', () => {
    expect(slashMenuJustOpened(null, { query: '' })).toBe(true)
  })

  it('digitar com o menu já aberto não conta — senão cada tecla viraria um refetch', () => {
    expect(slashMenuJustOpened({ query: 'ch' }, { query: 'che' })).toBe(false)
  })

  it('fechar não conta', () => {
    expect(slashMenuJustOpened({ query: 'che' }, null)).toBe(false)
    expect(slashMenuJustOpened(null, null)).toBe(false)
  })
})

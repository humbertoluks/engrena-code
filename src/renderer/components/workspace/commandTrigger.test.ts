import { describe, expect, it } from 'vitest'
import { extractSlashTrigger, insertSlashCommand, matchSlashCommands } from './commandTrigger.js'

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

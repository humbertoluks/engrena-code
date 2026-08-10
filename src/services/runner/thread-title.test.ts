import { describe, expect, it } from 'vitest'
import {
  THREAD_TITLE_FALLBACK,
  THREAD_TITLE_MAX_LENGTH,
  deriveThreadTitle,
} from './thread-title.js'

describe('deriveThreadTitle', () => {
  it('uses the first non-empty line of the prompt', () => {
    expect(deriveThreadTitle('Crie um todo list\ncom Express')).toBe('Crie um todo list')
  })

  it('skips blank leading lines', () => {
    expect(deriveThreadTitle('\n\n  Lista de tarefas  \nresto')).toBe('Lista de tarefas')
  })

  it('falls back when prompt is empty or whitespace', () => {
    expect(deriveThreadTitle('')).toBe(THREAD_TITLE_FALLBACK)
    expect(deriveThreadTitle('   \n  ')).toBe(THREAD_TITLE_FALLBACK)
  })

  it('truncates long first lines with ellipsis at max length', () => {
    const long = 'A'.repeat(THREAD_TITLE_MAX_LENGTH + 20)
    const title = deriveThreadTitle(long)
    expect(title.length).toBe(THREAD_TITLE_MAX_LENGTH)
    expect(title.endsWith('...')).toBe(true)
    expect(title.startsWith('A'.repeat(THREAD_TITLE_MAX_LENGTH - 3))).toBe(true)
  })

  it('keeps slash-command prompts as the visible solicitation', () => {
    expect(deriveThreadTitle('/spec desenhar a API')).toBe('/spec desenhar a API')
  })
})

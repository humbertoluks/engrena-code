import { describe, expect, it } from 'vitest'
import { buildFollowupPrompt, MAX_FOLLOWUP_CHARS, MAX_FOLLOWUPS, parseFollowups } from './followups.js'

describe('parseFollowups', () => {
  it('lê um array JSON cru', () => {
    expect(parseFollowups('["Rode os testes", "Abra o PR"]')).toEqual(['Rode os testes', 'Abra o PR'])
  })

  it('lê array cercado em bloco de código', () => {
    expect(parseFollowups('```json\n["Rode os testes"]\n```')).toEqual(['Rode os testes'])
  })

  it('corta no teto de sugestões e de caracteres', () => {
    const many = JSON.stringify(['a', 'b', 'c', 'd', 'e'])
    expect(parseFollowups(many)).toHaveLength(MAX_FOLLOWUPS)
    const long = JSON.stringify(['x'.repeat(MAX_FOLLOWUP_CHARS + 20)])
    expect(parseFollowups(long)[0]).toHaveLength(MAX_FOLLOWUP_CHARS)
  })

  it('descarta duplicata, vazio e item que não é string', () => {
    expect(parseFollowups('["Rode os testes", "rode os testes", "", 42, "  "]')).toEqual(['Rode os testes'])
  })

  it('devolve lista vazia para resposta sem array ou JSON quebrado', () => {
    expect(parseFollowups('desculpe, não sei')).toEqual([])
    expect(parseFollowups('[não é json]')).toEqual([])
    expect(parseFollowups('{"a": 1}')).toEqual([])
  })
})

describe('buildFollowupPrompt', () => {
  it('inclui os dois lados do último turno e pede array JSON', () => {
    const prompt = buildFollowupPrompt('crie o servidor', 'servidor criado em index.js')
    expect(prompt).toContain('crie o servidor')
    expect(prompt).toContain('servidor criado em index.js')
    expect(prompt).toContain('array JSON')
  })

  it('trunca entradas gigantes', () => {
    const prompt = buildFollowupPrompt('u'.repeat(5000), 'a'.repeat(9000))
    expect(prompt.length).toBeLessThan(7000)
  })
})

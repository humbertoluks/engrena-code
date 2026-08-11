import { describe, expect, it } from 'vitest'
import {
  applyPromptVariables,
  composeModeBlock,
  extractPromptVariables,
  isValidPromptName,
  renderPromptForComposer,
  slugifyPromptName,
  validateModeInstructions,
  validatePromptFields,
} from './prompt-spec.js'

describe('slugifyPromptName', () => {
  it('normaliza acento, espaço e maiúscula', () => {
    expect(slugifyPromptName('Revisão de PR')).toBe('revisao-de-pr')
  })

  it('descarta pontuação nas bordas', () => {
    expect(slugifyPromptName('  --tudo!!  ')).toBe('tudo')
  })

  it('corta em 40 caracteres', () => {
    expect(slugifyPromptName('a'.repeat(60))).toHaveLength(40)
  })
})

describe('isValidPromptName', () => {
  it.each(['revisao', 'fix-bug-2', 'a'])('aceita %s', (name) => {
    expect(isValidPromptName(name)).toBe(true)
  })

  it.each(['', '-comeca-com-hifen', 'Maiuscula', 'com espaco', 'a'.repeat(41)])('rejeita %s', (name) => {
    expect(isValidPromptName(name)).toBe(false)
  })
})

describe('extractPromptVariables', () => {
  it('lê nome e placeholder na ordem de aparição, sem repetir', () => {
    const vars = extractPromptVariables('Corrija ${input:arquivo:src/app.ts} e depois ${input:teste} em ${input:arquivo}')
    expect(vars).toEqual([
      { name: 'arquivo', placeholder: 'src/app.ts' },
      { name: 'teste', placeholder: 'teste' },
    ])
  })

  it('corpo sem variável devolve lista vazia', () => {
    expect(extractPromptVariables('só texto')).toEqual([])
  })
})

describe('applyPromptVariables', () => {
  it('substitui pelo valor informado e cai no placeholder quando falta', () => {
    const body = 'Rode ${input:cmd:npm test} no ${input:dir}'
    expect(applyPromptVariables(body, { cmd: 'pnpm test' })).toBe('Rode pnpm test no dir')
  })

  it('valor vazio não vence o placeholder', () => {
    expect(applyPromptVariables('${input:x:padrao}', { x: '' })).toBe('padrao')
  })
})

describe('renderPromptForComposer', () => {
  it('devolve o texto com placeholders e a faixa da primeira variável', () => {
    const result = renderPromptForComposer('Revise ${input:arquivo:src/app.ts} agora')
    expect(result.text).toBe('Revise src/app.ts agora')
    expect(result.selection).toEqual({ start: 7, end: 17 })
  })

  it('sem variável não devolve seleção', () => {
    expect(renderPromptForComposer('texto puro').selection).toBeNull()
  })
})

describe('validatePromptFields', () => {
  it('aponta o campo do primeiro erro', () => {
    expect(validatePromptFields({ name: 'Nome Inválido' })?.field).toBe('name')
    expect(validatePromptFields({ name: 'ok', body: '   ' })?.field).toBe('body')
    expect(validatePromptFields({ description: 'x'.repeat(201) })?.field).toBe('description')
  })

  it('entrada válida passa', () => {
    expect(validatePromptFields({ name: 'revisao', description: 'curta', body: 'faça algo' })).toBeNull()
  })
})

describe('validateModeInstructions', () => {
  it('aceita ausente e rejeita instrução gigante', () => {
    expect(validateModeInstructions(undefined)).toBeNull()
    expect(validateModeInstructions('x'.repeat(8_001))?.field).toBe('instructions')
  })
})

describe('composeModeBlock', () => {
  it('monta bloco com nome do modo', () => {
    expect(composeModeBlock({ name: 'arquiteto', instructions: 'Explique antes de codar.' })).toBe(
      '## Modo de chat: arquiteto\nExplique antes de codar.'
    )
  })

  it('modo ausente ou sem instrução não vira bloco', () => {
    expect(composeModeBlock(null)).toBe('')
    expect(composeModeBlock({ name: 'preset', instructions: '   ' })).toBe('')
  })
})

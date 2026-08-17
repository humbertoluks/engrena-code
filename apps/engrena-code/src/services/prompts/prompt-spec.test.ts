import { describe, expect, it } from 'vitest'
import {
  applyPromptVariables,
  composeModeBlock,
  extractPromptVariables,
  filterByModeCatalog,
  MODE_CATALOG_MAX,
  parseNameList,
  isValidPromptName,
  renderPromptForComposer,
  slugifyPromptName,
  validateModeCatalog,
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

describe('parseNameList', () => {
  it('lê lista separada por vírgula e lista entre colchetes', () => {
    expect(parseNameList('a, b')).toEqual(['a', 'b'])
    expect(parseNameList("['a', 'b']")).toEqual(['a', 'b'])
  })

  it('dedupe é case-insensitive e preserva a primeira grafia', () => {
    expect(parseNameList('Skill, skill, outra')).toEqual(['Skill', 'outra'])
  })

  it('chave ausente ou em branco vira null; lista vazia explícita vira []', () => {
    expect(parseNameList(undefined)).toBeNull()
    expect(parseNameList('   ')).toBeNull()
    expect(parseNameList('[]')).toEqual([])
  })

  it('corta no teto do catálogo', () => {
    const many = Array.from({ length: MODE_CATALOG_MAX + 10 }, (_, i) => `s${i}`).join(', ')
    expect(parseNameList(many)).toHaveLength(MODE_CATALOG_MAX)
  })
})

describe('filterByModeCatalog', () => {
  const items = [{ name: 'alfa' }, { name: 'Beta' }, { name: 'gama' }]

  it('null devolve a lista intacta', () => {
    expect(filterByModeCatalog(items, null)).toEqual(items)
  })

  it('filtra por nome, ignorando caixa, e descarta nome que não está no catálogo', () => {
    expect(filterByModeCatalog(items, ['beta', 'fora-do-catalogo'])).toEqual([{ name: 'Beta' }])
  })

  it('lista vazia filtra tudo', () => {
    expect(filterByModeCatalog(items, [])).toEqual([])
  })
})

describe('validateModeCatalog', () => {
  it('aceita ausente e lista de strings', () => {
    expect(validateModeCatalog(undefined, 'skills')).toBeNull()
    expect(validateModeCatalog(['a'], 'rules')).toBeNull()
  })

  it('rejeita shape errado e lista acima do teto', () => {
    expect(validateModeCatalog('a,b', 'skills')?.field).toBe('skills')
    expect(validateModeCatalog([1, 2], 'rules')?.field).toBe('rules')
    expect(validateModeCatalog(Array.from({ length: MODE_CATALOG_MAX + 1 }, () => 'x'), 'skills')).not.toBeNull()
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MODE_DIR, PROMPT_DIR, parseFrontmatter, readModeFiles, readPromptFiles } from './prompt-files.js'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'engrenacode_claude_promptfiles_'))
})

function writePrompt(name: string, content: string): void {
  mkdirSync(join(root, PROMPT_DIR), { recursive: true })
  writeFileSync(join(root, PROMPT_DIR, name), content)
}

function writeMode(name: string, content: string): void {
  mkdirSync(join(root, MODE_DIR), { recursive: true })
  writeFileSync(join(root, MODE_DIR, name), content)
}

describe('parseFrontmatter', () => {
  it('separa chaves do corpo', () => {
    const result = parseFrontmatter('---\ndescription: Revisa PR\nprovider: claude\n---\nFaça a revisão.')
    expect(result.data).toEqual({ description: 'Revisa PR', provider: 'claude' })
    expect(result.body).toBe('Faça a revisão.')
  })

  it('arquivo sem frontmatter é todo corpo', () => {
    expect(parseFrontmatter('só o corpo')).toEqual({ data: {}, body: 'só o corpo' })
  })

  it('tira aspas do valor e ignora linha sem dois-pontos', () => {
    const result = parseFrontmatter('---\ndescription: "com aspas"\nlixo\n---\ncorpo')
    expect(result.data).toEqual({ description: 'com aspas' })
  })
})

describe('readPromptFiles', () => {
  it('lê nome do arquivo, descrição do frontmatter e corpo', () => {
    writePrompt('revisao-pr.prompt.md', '---\ndescription: Revisa o PR\n---\nRevise ${input:arquivo}')
    const prompts = readPromptFiles(root)
    expect(prompts).toHaveLength(1)
    expect(prompts[0].name).toBe('revisao-pr')
    expect(prompts[0].description).toBe('Revisa o PR')
    expect(prompts[0].body).toBe('Revise ${input:arquivo}')
    expect(prompts[0].file).toBe('.engrena/prompts/revisao-pr.prompt.md')
  })

  it('frontmatter pode renomear e nome vira slug', () => {
    writePrompt('qualquer.prompt.md', '---\nname: Revisão Rápida\n---\ncorpo')
    expect(readPromptFiles(root)[0].name).toBe('revisao-rapida')
  })

  it('ignora arquivo com outra extensão e corpo vazio', () => {
    writePrompt('nota.md', 'não é prompt')
    writePrompt('vazio.prompt.md', '---\ndescription: nada\n---\n')
    expect(readPromptFiles(root)).toEqual([])
  })

  it('projeto sem a pasta devolve lista vazia', () => {
    expect(readPromptFiles(root)).toEqual([])
  })
})

describe('readModeFiles', () => {
  it('lê preset e instruções', () => {
    writeMode(
      'arquiteto.chatmode.md',
      '---\ndescription: Discute antes de codar\nprovider: claude\nmodel: haiku\nreasoning: high\naccess: supervised\nexecution: worktree\n---\nExplique o plano antes de editar.'
    )
    const [mode] = readModeFiles(root)
    expect(mode.name).toBe('arquiteto')
    expect(mode.provider).toBe('claude')
    expect(mode.model).toBe('haiku')
    expect(mode.reasoningLevel).toBe('high')
    expect(mode.accessLevel).toBe('supervised')
    expect(mode.executionMode).toBe('worktree')
    expect(mode.instructions).toBe('Explique o plano antes de editar.')
    expect(mode.file).toBe('.engrena/modes/arquiteto.chatmode.md')
  })

  it('campo ausente vira null e modo só com preset é válido', () => {
    writeMode('rapido.chatmode.md', '---\nmodel: haiku\n---\n')
    const [mode] = readModeFiles(root)
    expect(mode.provider).toBeNull()
    expect(mode.instructions).toBe('')
  })

  it('lê skills/rules do frontmatter nas duas formas', () => {
    writeMode('focado.chatmode.md', "---\nskills: ['a', 'b']\nrules: uma, outra\n---\nSó o essencial.")
    const [mode] = readModeFiles(root)
    expect(mode.skills).toEqual(['a', 'b'])
    expect(mode.rules).toEqual(['uma', 'outra'])
  })

  it('modo sem as chaves não filtra nada (null, não lista vazia)', () => {
    writeMode('solto.chatmode.md', '---\nmodel: haiku\n---\nSem filtro.')
    const [mode] = readModeFiles(root)
    expect(mode.skills).toBeNull()
    expect(mode.rules).toBeNull()
  })
})

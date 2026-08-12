import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_prompt_library_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const {
  createChatMode,
  createSavedPrompt,
  deleteChatMode,
  deleteSavedPrompt,
  getChatModeByName,
  listChatModes,
  listSavedPrompts,
  updateChatMode,
  updateSavedPrompt,
  PromptNameConflictError,
  PromptNotFoundError,
  PromptValidationError,
} = await import('./prompt-library.js')

let projectId: string

beforeEach(() => {
  getDb().exec('DELETE FROM saved_prompts')
  getDb().exec('DELETE FROM chat_modes')
  getDb().exec('DELETE FROM projects')
  projectId = createProject({ path: mkdtempSync(join(tmpdir(), 'engrenacode_claude_prompt_proj_')) }).id
})

afterAll(() => closeDb())

describe('prompts salvos', () => {
  it('cria, lista em ordem alfabética e apaga', () => {
    createSavedPrompt({ projectId, name: 'revisao', body: 'Revise o diff' })
    createSavedPrompt({ projectId, name: 'commit', description: 'Mensagem', body: 'Escreva o commit' })

    const prompts = listSavedPrompts(projectId)
    expect(prompts.map((p) => p.name)).toEqual(['commit', 'revisao'])
    expect(prompts[0].description).toBe('Mensagem')

    deleteSavedPrompt(prompts[0].id)
    expect(listSavedPrompts(projectId).map((p) => p.name)).toEqual(['revisao'])
  })

  it('nome duplicado no mesmo projeto conflita, em outro projeto não', () => {
    createSavedPrompt({ projectId, name: 'revisao', body: 'a' })
    expect(() => createSavedPrompt({ projectId, name: 'revisao', body: 'b' })).toThrow(PromptNameConflictError)

    const other = createProject({ path: mkdtempSync(join(tmpdir(), 'engrenacode_claude_prompt_proj2_')) }).id
    expect(() => createSavedPrompt({ projectId: other, name: 'revisao', body: 'b' })).not.toThrow()
  })

  it('valida nome e corpo', () => {
    expect(() => createSavedPrompt({ projectId, name: 'Nome Ruim', body: 'x' })).toThrow(PromptValidationError)
    expect(() => createSavedPrompt({ projectId, name: 'ok', body: '  ' })).toThrow(PromptValidationError)
  })

  it('atualiza campo isolado e mantém o resto', () => {
    const created = createSavedPrompt({ projectId, name: 'revisao', description: 'antiga', body: 'corpo' })
    const updated = updateSavedPrompt(created.id, { description: 'nova' })
    expect(updated.description).toBe('nova')
    expect(updated.body).toBe('corpo')
    expect(updated.name).toBe('revisao')
  })

  it('id inexistente falha em update e delete', () => {
    expect(() => updateSavedPrompt('nao-existe', { body: 'x' })).toThrow(PromptNotFoundError)
    expect(() => deleteSavedPrompt('nao-existe')).toThrow(PromptNotFoundError)
  })
})

describe('modos de chat', () => {
  it('guarda preset completo e acha por nome', () => {
    createChatMode({
      projectId,
      name: 'arquiteto',
      description: 'Planeja antes',
      provider: 'claude',
      model: 'haiku',
      reasoningLevel: 'high',
      accessLevel: 'supervised',
      executionMode: 'worktree',
      instructions: 'Explique o plano.',
    })

    const mode = getChatModeByName(projectId, 'arquiteto')
    expect(mode?.provider).toBe('claude')
    expect(mode?.executionMode).toBe('worktree')
    expect(mode?.instructions).toBe('Explique o plano.')
    expect(getChatModeByName(projectId, 'inexistente')).toBeNull()
  })

  it('modo só com preset nasce com instrução vazia', () => {
    const mode = createChatMode({ projectId, name: 'rapido', model: 'haiku' })
    expect(mode.instructions).toBe('')
    expect(mode.provider).toBeNull()
  })

  it('atualiza preset e apaga', () => {
    const mode = createChatMode({ projectId, name: 'rapido', model: 'haiku' })
    expect(updateChatMode(mode.id, { model: 'opus', instructions: 'Seja breve.' }).model).toBe('opus')
    deleteChatMode(mode.id)
    expect(listChatModes(projectId)).toEqual([])
  })

  it('instrução acima do teto é rejeitada', () => {
    expect(() => createChatMode({ projectId, name: 'grande', instructions: 'x'.repeat(8_001) })).toThrow(
      PromptValidationError
    )
  })
})

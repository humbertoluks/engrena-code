import { getChatModeByName } from '../db/repositories/prompt-library.js'
import { readModeFiles } from './prompt-files.js'

/**
 * Resolve um modo de chat pelo NOME, olhando primeiro o banco (criado na UI) e depois os arquivos
 * do repositório (`.engrena/modes/*.chatmode.md`). A thread guarda o nome, não o id, justamente
 * porque um modo pode existir só como arquivo versionado.
 */
export interface ResolvedChatMode {
  name: string
  description: string
  provider: string | null
  model: string | null
  reasoningLevel: string | null
  accessLevel: string | null
  executionMode: string | null
  instructions: string
  /**
   * Skills/rules do projeto que este modo deixa ativas no turno. `null` = o modo não fala do
   * assunto e o turno usa tudo que o projeto vincula. É **filtro**, nunca ativação: nome que o
   * projeto não vinculou é ignorado (`filterByModeCatalog`).
   */
  skills: string[] | null
  rules: string[] | null
}

export function resolveChatMode(
  project: { id: string; path: string },
  name: string | null | undefined
): ResolvedChatMode | null {
  if (name === null || name === undefined || name === '') return null

  const stored = getChatModeByName(project.id, name)
  if (stored !== null) {
    return {
      name: stored.name,
      description: stored.description,
      provider: stored.provider,
      model: stored.model,
      reasoningLevel: stored.reasoningLevel,
      accessLevel: stored.accessLevel,
      executionMode: stored.executionMode,
      instructions: stored.instructions,
      skills: stored.skills,
      rules: stored.rules,
    }
  }

  const fromFile = readModeFiles(project.path).find((mode) => mode.name === name)
  if (fromFile === undefined) return null
  return {
    name: fromFile.name,
    description: fromFile.description,
    provider: fromFile.provider,
    model: fromFile.model,
    reasoningLevel: fromFile.reasoningLevel,
    accessLevel: fromFile.accessLevel,
    executionMode: fromFile.executionMode,
    instructions: fromFile.instructions,
    skills: fromFile.skills,
    rules: fromFile.rules,
  }
}

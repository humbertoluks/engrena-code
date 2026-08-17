import { useCallback, useEffect, useState } from 'react'
import {
  promptLibraryService,
  type ChatModeItem,
  type SavedPromptItem,
} from '../services/prompt-library-service'
import { skillsService } from '../services/skills-service'
import { rulesService } from '../services/rules-service'
import {
  applyChatModeByName,
  clearChatModeIfSelected,
  renameChatModeIfSelected,
  selectableRuleNames,
  selectableSkillNames,
  validateChatModeName,
  validateSavedPrompt,
  EMPTY_MODE_CATALOG,
  type ChatModeFormDraft,
  type ModeCatalogOptions,
  type PromptLibraryDraft,
} from './promptLibrary.logic'

export interface PromptLibraryApi {
  savedPrompts: SavedPromptItem[]
  chatModes: ChatModeItem[]
  /** Skills/rules que o projeto resolve hoje — é o que o seletor do modo pode oferecer. */
  modeCatalog: ModeCatalogOptions
  libraryError: string | null
  applyChatMode: (name: string | null) => void
  savePromptFromComposer: (rawName: string) => Promise<boolean>
  saveChatModeFromComposer: (form: ChatModeFormDraft) => Promise<boolean>
  updateSavedPromptFromComposer: (id: string, rawName: string, rawText: string) => Promise<boolean>
  updateChatModeFromComposer: (
    id: string,
    previousName: string,
    form: ChatModeFormDraft,
    options?: { capturePreset?: boolean }
  ) => Promise<boolean>
  deleteSavedPrompt: (id: string) => Promise<void>
  deleteChatMode: (id: string, name: string) => Promise<void>
}

/**
 * Biblioteca de prompts salvos e modos de chat do projeto (F28 §3.4): lista, aplica preset no
 * rascunho, cria a partir do composer e apaga.
 *
 * O rascunho não é estado deste hook — ele chega por `draft` (leitura) e `updateDraft` (patch),
 * porque quem é dono do composer é `usePrincipalWorkspace`. As regras puras (merge do preset,
 * validação) moram em `promptLibrary.logic.ts`.
 */
export function usePromptLibrary<TDraft extends PromptLibraryDraft>(input: {
  projectId: string | null
  /** `selectedThreadId === null`: provider e execution do preset só valem em thread nova. */
  isNewThread: boolean
  draft: TDraft
  updateDraft: (updater: (prev: TDraft) => TDraft) => void
  /** Vive enquanto o workspace está montado — barra `setState` depois do unmount. */
  mountedRef: { readonly current: boolean }
}): PromptLibraryApi {
  const { projectId, isNewThread, draft, updateDraft, mountedRef } = input
  // Deps primitivas: com o objeto `draft` inteiro, salvar modo mudaria de identidade a cada
  // tecla digitada no composer.
  const {
    text: draftText,
    provider: draftProvider,
    model: draftModel,
    reasoningLevel: draftReasoningLevel,
    accessLevel: draftAccessLevel,
    executionMode: draftExecutionMode,
  } = draft

  const [savedPrompts, setSavedPrompts] = useState<SavedPromptItem[]>([])
  const [chatModes, setChatModes] = useState<ChatModeItem[]>([])
  const [modeCatalog, setModeCatalog] = useState<ModeCatalogOptions>(EMPTY_MODE_CATALOG)
  const [libraryError, setLibraryError] = useState<string | null>(null)

  // As quatro chamadas saem juntas: o seletor de skills/rules do formulário de modo precisa do
  // catálogo no mesmo instante em que a lista de modos aparece, e encadear viraria waterfall.
  const loadPromptLibrary = useCallback(
    async (loadProjectId: string) => {
      const [prompts, modes, skills, rules] = await Promise.all([
        promptLibraryService.listPrompts(loadProjectId),
        promptLibraryService.listModes(loadProjectId),
        skillsService.listForProject(loadProjectId),
        rulesService.listForProject(loadProjectId),
      ])
      if (!mountedRef.current) return
      if (!prompts.error) setSavedPrompts(prompts.prompts)
      if (!modes.error) setChatModes(modes.modes)
      setModeCatalog({
        skills: Array.isArray(skills) ? selectableSkillNames(skills) : [],
        rules: rules.error ? [] : selectableRuleNames(rules.rules),
      })
    },
    [mountedRef]
  )

  useEffect(() => {
    if (!projectId) {
      setSavedPrompts([])
      setChatModes([])
      setModeCatalog(EMPTY_MODE_CATALOG)
      return
    }
    void loadPromptLibrary(projectId)
  }, [projectId, loadPromptLibrary])

  /**
   * Aplica o preset do modo no rascunho. Provider e execution só mudam em thread nova: na thread
   * existente os dois são imutáveis (mesma regra das pills do composer).
   */
  const applyChatMode = useCallback(
    (name: string | null) => {
      setLibraryError(null)
      updateDraft((prev) => applyChatModeByName(prev, chatModes, name, { isNewThread }))
    },
    [chatModes, isNewThread, updateDraft]
  )

  const savePromptFromComposer = useCallback(
    async (rawName: string): Promise<boolean> => {
      if (!projectId) return false
      const valid = validateSavedPrompt(rawName, draftText)
      if (!valid.ok) {
        setLibraryError(valid.error)
        return false
      }
      const res = await promptLibraryService.createPrompt(projectId, valid.value)
      if (res.error) {
        setLibraryError(res.error.message)
        return false
      }
      setLibraryError(null)
      await loadPromptLibrary(projectId)
      return true
    },
    [projectId, draftText, loadPromptLibrary]
  )

  /** O modo nasce do que já está no composer — é o preset que o usuário acabou de montar na mão. */
  const saveChatModeFromComposer = useCallback(
    async (form: ChatModeFormDraft): Promise<boolean> => {
      if (!projectId) return false
      const valid = validateChatModeName(form.name)
      if (!valid.ok) {
        setLibraryError(valid.error)
        return false
      }
      const name = valid.value
      const res = await promptLibraryService.createMode(projectId, {
        name,
        provider: draftProvider,
        model: draftModel,
        reasoningLevel: draftReasoningLevel,
        accessLevel: draftAccessLevel,
        executionMode: draftExecutionMode,
        instructions: form.instructions,
        skills: form.skills,
        rules: form.rules,
      })
      if (res.error) {
        setLibraryError(res.error.message)
        return false
      }
      setLibraryError(null)
      // Marca o modo direto: `applyChatMode` leria a lista do render anterior, ainda sem o modo
      // recém-criado, e a pill ficaria no modo antigo. O preset já é o estado atual do composer.
      updateDraft((prev) => ({ ...prev, chatMode: name }))
      await loadPromptLibrary(projectId)
      return true
    },
    [
      projectId,
      draftProvider,
      draftModel,
      draftReasoningLevel,
      draftAccessLevel,
      draftExecutionMode,
      updateDraft,
      loadPromptLibrary,
    ]
  )

  /**
   * Edição do prompt salvo: o corpo é o texto que está no composer agora — mesmo caminho da
   * criação, só que com PUT. `id` vem do menu `/`, então só prompt do banco chega aqui (os do
   * repositório são somente leitura e não expõem o lápis).
   */
  const updateSavedPromptFromComposer = useCallback(
    async (id: string, rawName: string, rawText: string): Promise<boolean> => {
      const valid = validateSavedPrompt(rawName, rawText)
      if (!valid.ok) {
        setLibraryError(valid.error)
        return false
      }
      const res = await promptLibraryService.updatePrompt(id, valid.value)
      if (res.error) {
        setLibraryError(res.error.message)
        return false
      }
      setLibraryError(null)
      if (projectId) await loadPromptLibrary(projectId)
      return true
    },
    [projectId, loadPromptLibrary]
  )

  /**
   * Edição do modo salvo. Por padrão mexe só em nome/instruções/skills/rules e **preserva** o
   * preset gravado: quem abre o lápis para corrigir uma instrução não espera levar junto o
   * provider/modelo que estiver no composer naquele instante. `capturePreset` é o opt-in explícito
   * do formulário para regravar o preset com o estado atual do composer.
   */
  const updateChatModeFromComposer = useCallback(
    async (
      id: string,
      previousName: string,
      form: ChatModeFormDraft,
      options: { capturePreset?: boolean } = {}
    ): Promise<boolean> => {
      const valid = validateChatModeName(form.name)
      if (!valid.ok) {
        setLibraryError(valid.error)
        return false
      }
      const name = valid.value
      const res = await promptLibraryService.updateMode(id, {
        name,
        instructions: form.instructions,
        skills: form.skills,
        rules: form.rules,
        ...(options.capturePreset === true
          ? {
              provider: draftProvider,
              model: draftModel,
              reasoningLevel: draftReasoningLevel,
              accessLevel: draftAccessLevel,
              executionMode: draftExecutionMode,
            }
          : {}),
      })
      if (res.error) {
        setLibraryError(res.error.message)
        return false
      }
      setLibraryError(null)
      // Renomear não pode deixar a pill apontando para um modo que não existe mais.
      updateDraft((prev) => renameChatModeIfSelected(prev, previousName, name))
      if (projectId) await loadPromptLibrary(projectId)
      return true
    },
    [
      projectId,
      draftProvider,
      draftModel,
      draftReasoningLevel,
      draftAccessLevel,
      draftExecutionMode,
      updateDraft,
      loadPromptLibrary,
    ]
  )

  const deleteSavedPrompt = useCallback(
    async (id: string) => {
      const res = await promptLibraryService.deletePrompt(id)
      if (res.error) {
        setLibraryError(res.error.message)
        return
      }
      if (projectId) await loadPromptLibrary(projectId)
    },
    [projectId, loadPromptLibrary]
  )

  const deleteChatMode = useCallback(
    async (id: string, name: string) => {
      const res = await promptLibraryService.deleteMode(id)
      if (res.error) {
        setLibraryError(res.error.message)
        return
      }
      updateDraft((prev) => clearChatModeIfSelected(prev, name))
      if (projectId) await loadPromptLibrary(projectId)
    },
    [projectId, updateDraft, loadPromptLibrary]
  )

  return {
    savedPrompts,
    chatModes,
    modeCatalog,
    libraryError,
    applyChatMode,
    savePromptFromComposer,
    saveChatModeFromComposer,
    updateSavedPromptFromComposer,
    updateChatModeFromComposer,
    deleteSavedPrompt,
    deleteChatMode,
  }
}

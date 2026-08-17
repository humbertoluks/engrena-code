import { useCallback, useEffect, useState } from 'react'
import {
  promptLibraryService,
  type ChatModeItem,
  type SavedPromptItem,
} from '../services/prompt-library-service'
import {
  applyChatModeByName,
  clearChatModeIfSelected,
  validateChatModeName,
  validateSavedPrompt,
  type PromptLibraryDraft,
} from './promptLibrary.logic'

export interface PromptLibraryApi {
  savedPrompts: SavedPromptItem[]
  chatModes: ChatModeItem[]
  libraryError: string | null
  applyChatMode: (name: string | null) => void
  savePromptFromComposer: (rawName: string) => Promise<boolean>
  saveChatModeFromComposer: (rawName: string, instructions?: string) => Promise<boolean>
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
  const [libraryError, setLibraryError] = useState<string | null>(null)

  const loadPromptLibrary = useCallback(
    async (loadProjectId: string) => {
      const [prompts, modes] = await Promise.all([
        promptLibraryService.listPrompts(loadProjectId),
        promptLibraryService.listModes(loadProjectId),
      ])
      if (!mountedRef.current) return
      if (!prompts.error) setSavedPrompts(prompts.prompts)
      if (!modes.error) setChatModes(modes.modes)
    },
    [mountedRef]
  )

  useEffect(() => {
    if (!projectId) {
      setSavedPrompts([])
      setChatModes([])
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
    async (rawName: string, instructions = ''): Promise<boolean> => {
      if (!projectId) return false
      const valid = validateChatModeName(rawName)
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
        instructions,
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
    libraryError,
    applyChatMode,
    savePromptFromComposer,
    saveChatModeFromComposer,
    deleteSavedPrompt,
    deleteChatMode,
  }
}

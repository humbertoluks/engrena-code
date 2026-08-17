import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { projectsService } from '../services/projects-service'
import { threadsService, type ComposerCatalog } from '../services/threads-service'
import {
  addAttachment,
  makeSelectionAttachment,
  removeAttachment as removeAttachmentFromList,
  withImplicitContext,
  type ComposerAttachment,
} from '../components/workspace/composerAttachments.logic'
import {
  clearDraftAfterSend as clearDraftAfterSendPatch,
  clearTextAndImages as clearTextAndImagesPatch,
  COMPOSER_DRAFT_COPY,
  emptyDraft,
  rehydrateFromThread,
  type ComposerDraft,
  type DraftThreadSnapshot,
} from './composerDraft.logic'

/** Arquivo aberto no viewer (+ seleção), fonte do contexto implícito. */
export interface ActiveFile {
  path: string
  selection?: { text: string; startLine?: number; endLine?: number }
}

export interface ComposerDraftApi {
  /** Providers/modelos/reasoning do backend; carregado uma vez no boot. */
  composerCatalog: ComposerCatalog | null
  composer: ComposerDraft
  /** Patch parcial do rascunho (pills, texto, imagens). */
  updateComposer: (patch: Partial<ComposerDraft>) => void
  /** Forma funcional do patch — é o que `usePromptLibrary` recebe como `updateDraft`. */
  updateDraft: (updater: (prev: ComposerDraft) => ComposerDraft) => void
  /** Limpa texto e imagens, **mantém** os anexos (thread nova, decisão de permissão). */
  clearTextAndImages: () => void
  /** Limpa texto, imagens **e** anexos (tudo que despacha o rascunho). */
  clearDraftAfterSend: () => void
  /** Explícitos + o implícito do arquivo aberto — é esta lista que vai no turno. */
  composerAttachments: ComposerAttachment[]
  attach: (attachment: ComposerAttachment) => void
  detach: (id: string) => void
  attachCodebase: () => Promise<void>
  codebaseBusy: boolean
  attachError: string | null
  clearAttachError: () => void
  activeFile: ActiveFile | null
  setActiveFile: Dispatch<SetStateAction<ActiveFile | null>>
  implicitContextEnabled: boolean
  setImplicitContextEnabled: Dispatch<SetStateAction<boolean>>
}

/**
 * Rascunho do composer e seus anexos de contexto: o que o usuário está montando antes de enviar.
 *
 * Estado próprio (draft, catálogo, contexto implícito, erro de anexo) + as ações que o mexem;
 * as regras puras moram em `composerDraft.logic.ts` e as transformações da lista de anexos em
 * `components/workspace/composerAttachments.logic.ts`. Quem envia o rascunho continua sendo
 * `usePrincipalWorkspace` — este hook só sabe montar e limpar.
 */
export function useComposerDraft(input: {
  projectId: string | null
  /** Thread aberta: rehidrata as pills (F16 + Access mid-thread). */
  selectedThread: DraftThreadSnapshot | null
  /** Vive enquanto o workspace está montado — barra `setState` depois do unmount. */
  mountedRef: { readonly current: boolean }
}): ComposerDraftApi {
  const { projectId, selectedThread, mountedRef } = input

  const [composerCatalog, setComposerCatalog] = useState<ComposerCatalog | null>(null)
  const [composer, setComposer] = useState<ComposerDraft>(emptyDraft)

  // Contexto implícito: arquivo aberto no viewer (+ seleção), espelhando `chatImplicitContext.ts`
  // do VS Code. Vira chip removível e pode ser desligado — nunca entra escondido no turno.
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null)
  const [implicitContextEnabled, setImplicitContextEnabled] = useState(true)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [codebaseBusy, setCodebaseBusy] = useState(false)

  // Catálogo do composer: uma carga no boot. Erro só vai para o console — a UI degrada para os
  // defaults das pills, sem faixa de erro.
  useEffect(() => {
    threadsService
      .composerCatalog()
      .then((res) => {
        if (!mountedRef.current) return
        if (res.error) {
          console.error('[workspace] composer catalog:', res.error.message)
          return
        }
        setComposerCatalog(res)
      })
      .catch((err: unknown) => {
        console.error('[workspace] composer catalog:', err)
      })
  }, [mountedRef])

  // Rehidrata model/reasoning/access da thread selecionada nos controles do composer (spec F16 +
  // Access mid-thread). Deps granulares, nunca o objeto `selectedThread`: cada refetch de thread
  // devolve identidade nova e rehidrataria por cima da pill que o usuário acabou de mudar.
  // biome-ignore lint/correctness/useExhaustiveDependencies: as deps são os 6 campos da thread, um a um; o objeto inteiro muda de identidade a cada refetch.
  useEffect(() => {
    if (!selectedThread) return
    setComposer((prev) => rehydrateFromThread(prev, selectedThread))
  }, [
    selectedThread?.id,
    selectedThread?.model,
    selectedThread?.reasoningLevel,
    selectedThread?.provider,
    selectedThread?.accessLevel,
    selectedThread?.executionMode,
    selectedThread?.chatMode,
  ])

  const composerAttachments = useMemo(
    () => withImplicitContext(composer.attachments, activeFile, implicitContextEnabled),
    [composer.attachments, activeFile, implicitContextEnabled]
  )

  const updateComposer = useCallback((patch: Partial<ComposerDraft>) => {
    setComposer((prev) => ({ ...prev, ...patch }))
  }, [])

  const clearTextAndImages = useCallback(() => {
    setComposer(clearTextAndImagesPatch)
  }, [])

  const clearDraftAfterSend = useCallback(() => {
    setComposer(clearDraftAfterSendPatch)
  }, [])

  const clearAttachError = useCallback(() => setAttachError(null), [])

  const attach = useCallback((attachment: ComposerAttachment) => {
    setComposer((prev) => {
      const result = addAttachment(prev.attachments, attachment)
      if (!result.ok) {
        setAttachError(result.message)
        return prev
      }
      setAttachError(null)
      return { ...prev, attachments: result.attachments }
    })
  }, [])

  /** Chip implícito não sai da lista explícita — remover significa desligar o implícito. */
  const detach = useCallback((id: string) => {
    setAttachError(null)
    setComposer((prev) => {
      const next = removeAttachmentFromList(prev.attachments, id)
      if (next.length !== prev.attachments.length) return { ...prev, attachments: next }
      setImplicitContextEnabled(false)
      return prev
    })
  }, [])

  /**
   * `#codebase`: busca trechos pelo texto que já está no composer e anexa os melhores como chips
   * de seleção — o usuário vê exatamente o que vai junto e pode remover.
   */
  const attachCodebase = useCallback(async () => {
    if (!projectId || codebaseBusy) return
    const query = composer.text.trim()
    if (query === '') {
      setAttachError(COMPOSER_DRAFT_COPY.codebaseEmptyQuery)
      return
    }
    setCodebaseBusy(true)
    setAttachError(null)
    try {
      const res = await projectsService.codesearch(projectId, query, 3)
      if (res.error) {
        setAttachError(res.error.message)
        return
      }
      if (res.hits.length === 0) {
        setAttachError(COMPOSER_DRAFT_COPY.codebaseNoHits)
        return
      }
      for (const hit of res.hits) {
        attach(
          makeSelectionAttachment(hit.path, hit.snippet, { startLine: hit.startLine, endLine: hit.endLine })
        )
      }
    } catch {
      setAttachError(COMPOSER_DRAFT_COPY.codebaseFailed)
    } finally {
      if (mountedRef.current) setCodebaseBusy(false)
    }
  }, [projectId, composer.text, codebaseBusy, attach, mountedRef])

  return {
    composerCatalog,
    composer,
    updateComposer,
    updateDraft: setComposer,
    clearTextAndImages,
    clearDraftAfterSend,
    composerAttachments,
    attach,
    detach,
    attachCodebase,
    codebaseBusy,
    attachError,
    clearAttachError,
    activeFile,
    setActiveFile,
    implicitContextEnabled,
    setImplicitContextEnabled,
  }
}

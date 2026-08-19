import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
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
  DRAFT_WRITE_DEBOUNCE_MS,
  emptyDraft,
  evictOldDrafts,
  readDraft,
  rehydrateFromThread,
  removeDraft,
  restoreIntoDraft,
  saveDraft,
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
  /**
   * Quantas imagens coladas o rascunho restaurado perdeu (F34), ou 0. Imagem não é persistida — só
   * contada —, e dizer isso é o que evita o usuário descobrir a perda na hora de enviar.
   */
  restoredDroppedImages: number
  /** Some com o aviso de imagens perdidas ao primeiro toque no campo. */
  dismissDroppedImages: () => void
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
  /**
   * Espelho síncrono do rascunho. Existe para `attach`/`detach` decidirem sem ler estado dentro de
   * um updater; é escrito em `applyComposer`, antes do `setComposer`, e não num efeito — efeito só
   * roda depois do render, e duas chamadas no mesmo tick veriam o valor velho.
   */
  const composerRef = useRef<ComposerDraft>(emptyDraft())

  // Contexto implícito: arquivo aberto no viewer (+ seleção), espelhando `chatImplicitContext.ts`
  // do VS Code. Vira chip removível e pode ser desligado — nunca entra escondido no turno.
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null)
  const [implicitContextEnabled, setImplicitContextEnabled] = useState(true)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [codebaseBusy, setCodebaseBusy] = useState(false)
  const [restoredDroppedImages, setRestoredDroppedImages] = useState(0)
  /**
   * Thread cujo rascunho já foi hidratado. Existe para a hidratação rodar **uma vez** por thread:
   * o efeito de rehidratação das pills roda a cada mudança de pill, e reler o storage ali
   * sobrescreveria o que o usuário acabou de digitar.
   */
  const hydratedThreadRef = useRef<string | null>(null)

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
    applyComposer((prev) => rehydrateFromThread(prev, selectedThread))
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

  /**
   * Único ponto de escrita do rascunho: aplica o updater sobre o valor corrente, atualiza o espelho
   * e entrega o resultado pronto ao React. Todo caminho que muda o composer passa por aqui — se um
   * deles chamasse `setComposer` direto, o espelho divergiria e `attach` decidiria por um estado
   * que não existe mais.
   */
  const applyComposer = useCallback((updater: (prev: ComposerDraft) => ComposerDraft) => {
    const next = updater(composerRef.current)
    composerRef.current = next
    setComposer(next)
  }, [])

  /**
   * Hidrata o rascunho persistido ao abrir uma thread (F34), uma vez por thread.
   *
   * Roda **depois** do efeito de rehidratação das pills e não compete com ele: aquele mexe em
   * provider/model/access, este em texto e anexos. A guarda por `hydratedThreadRef` é o que impede
   * o storage de sobrescrever a digitação em curso quando uma pill muda.
   */
  useEffect(() => {
    const threadId = selectedThread?.id ?? null
    if (threadId === null || hydratedThreadRef.current === threadId) return
    hydratedThreadRef.current = threadId
    const restored = readDraft(threadId)
    if (restored === null) {
      setRestoredDroppedImages(0)
      return
    }
    applyComposer((prev) => restoreIntoDraft(prev, restored))
    setRestoredDroppedImages(restored.droppedImages)
  }, [selectedThread?.id, applyComposer])

  /**
   * Grava o rascunho com atraso curto. Sem o debounce, cada tecla vira uma escrita síncrona no
   * `localStorage` — em rascunho grande isso bloqueia a thread principal a cada caractere.
   *
   * Falha de cota é silenciosa por decisão: o rascunho segue em memória naquela sessão. Travar o
   * composer por causa da persistência inverteria a prioridade.
   */
  useEffect(() => {
    const threadId = selectedThread?.id ?? null
    if (threadId === null) return
    const timer = setTimeout(() => {
      saveDraft(threadId, composer)
      evictOldDrafts()
    }, DRAFT_WRITE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [selectedThread?.id, composer])

  const updateComposer = useCallback(
    (patch: Partial<ComposerDraft>) => {
      applyComposer((prev) => ({ ...prev, ...patch }))
    },
    [applyComposer]
  )

  const clearTextAndImages = useCallback(() => {
    applyComposer(clearTextAndImagesPatch)
  }, [applyComposer])

  const clearDraftAfterSend = useCallback(() => {
    applyComposer(clearDraftAfterSendPatch)
    // Envio bem-sucedido apaga a chave na hora, sem esperar o debounce: reabrir a thread não pode
    // ressuscitar o que já foi enviado.
    const threadId = selectedThread?.id ?? null
    if (threadId !== null) removeDraft(threadId)
    setRestoredDroppedImages(0)
  }, [applyComposer, selectedThread?.id])

  const dismissDroppedImages = useCallback(() => setRestoredDroppedImages(0), [])

  const clearAttachError = useCallback(() => setAttachError(null), [])

  /**
   * `attach`/`detach` decidem **fora** do updater, lendo o rascunho por `composerRef`.
   *
   * Antes eles chamavam `setAttachError`/`setImplicitContextEnabled` de dentro do updater de
   * `setComposer`. Updater tem de ser puro: o React o executa durante o render seguinte e, em
   * StrictMode, duas vezes — o efeito colateral ia junto nas duas. O `composerRef` é atualizado
   * na hora, em `applyComposer`, e não no efeito de render, para que duas chamadas no mesmo tick
   * (anexar dois arquivos seguidos) leiam a lista já com o primeiro anexo dentro.
   */
  const attach = useCallback(
    (attachment: ComposerAttachment) => {
      const result = addAttachment(composerRef.current.attachments, attachment)
      if (!result.ok) {
        setAttachError(result.message)
        return
      }
      setAttachError(null)
      applyComposer((prev) => ({ ...prev, attachments: result.attachments }))
    },
    [applyComposer]
  )

  /** Chip implícito não sai da lista explícita — remover significa desligar o implícito. */
  const detach = useCallback(
    (id: string) => {
      setAttachError(null)
      const current = composerRef.current.attachments
      const next = removeAttachmentFromList(current, id)
      if (next.length !== current.length) {
        applyComposer((prev) => ({ ...prev, attachments: next }))
        return
      }
      setImplicitContextEnabled(false)
    },
    [applyComposer]
  )

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
    updateDraft: applyComposer,
    clearTextAndImages,
    clearDraftAfterSend,
    restoredDroppedImages,
    dismissDroppedImages,
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

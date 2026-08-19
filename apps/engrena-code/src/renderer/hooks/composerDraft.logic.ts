import type { ComposerAttachment } from '../components/workspace/composerAttachments.logic'
import type {
  ThreadAccessLevel,
  ThreadExecutionMode,
  ThreadProvider,
} from '../services/threads-service'
import type { ComposerImage } from './messageQueue.logic'

/**
 * Regras puras do rascunho do composer: estado inicial, os patches de limpeza e o merge de
 * rehidratação a partir da thread selecionada. Sem React e sem service — quem guarda estado e
 * chama `threadsService`/`projectsService` é `useComposerDraft`.
 *
 * As transformações da **lista de anexos** (`addAttachment`, `removeAttachment`,
 * `withImplicitContext`) já moram em `components/workspace/composerAttachments.logic.ts` e não
 * são reimplementadas aqui.
 */

export interface ComposerDraft {
  provider: ThreadProvider
  model: string | null
  reasoningLevel: string | null
  accessLevel: ThreadAccessLevel
  executionMode: ThreadExecutionMode
  text: string
  images: ComposerImage[]
  attachments: ComposerAttachment[]
  /** Nome do modo de chat aplicado (F28 §3.4); null = sem modo. */
  chatMode: string | null
}

/** Copy PT-BR do `#codebase` (faixa `attachError` no TaskComposer). */
export const COMPOSER_DRAFT_COPY = {
  codebaseEmptyQuery: 'Escreva o pedido antes de buscar no codebase.',
  codebaseNoHits: 'Nenhum trecho do projeto casou com esse pedido.',
  codebaseFailed: 'Não foi possível buscar no codebase.',
} as const

/**
 * Rascunho zerado. `accessLevel` nasce em `auto-accept-edits`: edição de arquivo passa direto e
 * Bash/MCP abrem o PermissionPrompt (permission-policy.ts). `supervised` pede aprovação até para
 * leitura.
 */
export function emptyDraft(): ComposerDraft {
  return {
    provider: 'claude',
    model: null,
    reasoningLevel: null,
    accessLevel: 'auto-accept-edits',
    executionMode: 'main',
    text: '',
    images: [],
    attachments: [],
    chatMode: null,
  }
}

// ── Os dois patches de limpeza (não são intercambiáveis) ─────────────────────

/**
 * Limpa **só texto e imagens** e **mantém os anexos**. É o caso de thread nova e o da decisão de
 * permissão: nenhum turno saiu levando o contexto, então os chips continuam de pé para o pedido
 * que vem a seguir. Usar `clearDraftAfterSend` aqui faria o usuário perder os chips sem ter
 * mandado nada.
 */
export function clearTextAndImages(draft: ComposerDraft): ComposerDraft {
  return { ...draft, text: '', images: [] }
}

/**
 * Limpa texto, imagens **e anexos**. É o caso de tudo que despacha o rascunho — resposta a
 * `ask_user_question`, enfileiramento, thread nova enviada e follow-up: o contexto já viajou com
 * a mensagem e ficaria repetido no próximo turno. Usar `clearTextAndImages` aqui carregaria os
 * chips para um turno que não os pediu.
 */
export function clearDraftAfterSend(draft: ComposerDraft): ComposerDraft {
  return { ...draft, text: '', images: [], attachments: [] }
}

// ── Rehidratação a partir da thread selecionada ──────────────────────────────

/**
 * Campos da thread que alimentam as pills do composer (spec F16 + Access mid-thread). `Thread`
 * satisfaz esta forma; o subconjunto existe para deixar explícito o que é lido — e porque as deps
 * do efeito são estes campos, um a um, nunca o objeto inteiro.
 */
export interface DraftThreadSnapshot {
  id: string
  provider: ThreadProvider
  model: string | null
  reasoningLevel: string | null
  accessLevel: ThreadAccessLevel
  executionMode: ThreadExecutionMode
  chatMode?: string | null
}

/**
 * Traz provider/model/reasoning/access/execution/chatMode da thread para o rascunho e **preserva
 * o resto** (texto digitado, imagens e anexos): a rehidratação acontece ao abrir a thread e a
 * cada mudança de uma dessas pills, não pode limpar o que o usuário está escrevendo.
 */
export function rehydrateFromThread(
  draft: ComposerDraft,
  thread: DraftThreadSnapshot
): ComposerDraft {
  return {
    ...draft,
    provider: thread.provider,
    model: thread.model,
    reasoningLevel: thread.reasoningLevel,
    accessLevel: thread.accessLevel,
    executionMode: thread.executionMode,
    chatMode: thread.chatMode ?? null,
  }
}

// ── Persistência do rascunho (F34) ───────────────────────────────────────────
//
// A fila de mensagens sobrevive a um F5 desde sempre (`messageQueue.logic.ts`); o rascunho não, e
// um prompt longo digitado e perdido é dano de dados do ponto de vista de quem escreveu. Esta
// seção é a única parte deste módulo que fala com `localStorage`, exatamente como a seção de
// serialização da fila — o resto continua puro.

/** Mesma convenção da fila (`engrenacode.<domínio>.v<n>.`), uma chave por thread. */
export const DRAFT_STORAGE_PREFIX = 'engrenacode.composer-draft.v1.'

/**
 * Teto por rascunho. Acima dele nada é persistido, e **não** truncamos: meio prompt restaurado
 * parece íntegro e é pior que rascunho nenhum. O caso raro volta ao comportamento de antes de F34.
 */
export const DRAFT_MAX_BYTES = 32 * 1024

/** Quantas threads guardam rascunho. Sem teto, o storage cresce até estourar a cota — da fila. */
export const DRAFT_MAX_THREADS = 20

/** Escrita com atraso: gravar a cada tecla bloqueia a thread principal em rascunho grande. */
export const DRAFT_WRITE_DEBOUNCE_MS = 500

interface PersistedDraft {
  v: 1
  text: string
  attachments: ComposerAttachment[]
  /**
   * Quantas imagens coladas **não** foram guardadas. Imagem vira base64 e estouraria a cota do
   * `localStorage` levando a fila junto; guardar só o número é o que torna a perda dizível em vez
   * de o usuário descobrir na hora de enviar.
   */
  droppedImages: number
  /** Último toque, base da evicção. */
  touchedAt: number
}

export interface RestoredDraft {
  text: string
  attachments: ComposerAttachment[]
  droppedImages: number
}

export type SaveDraftResult = 'saved' | 'removed' | 'too-large' | 'unavailable'

function draftKey(threadKey: string): string {
  return DRAFT_STORAGE_PREFIX + threadKey
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

/**
 * O recorte do rascunho que vale persistir. `null` quando não há nada a guardar.
 *
 * Anexo implícito fica fora de propósito: ele é derivado do arquivo aberto no viewer e é
 * recalculado a cada render — persistido, viraria chip fixo que o usuário não pediu.
 * `model`/`reasoning`/`accessLevel` também ficam fora: já persistem na thread (F16), e duplicá-los
 * criaria duas verdades, com a do rascunho envelhecendo.
 */
export function serializeDraft(draft: ComposerDraft, now = Date.now()): PersistedDraft | null {
  const text = draft.text
  const attachments = draft.attachments.filter((attachment) => attachment.implicit !== true)
  if (text.trim() === '' && attachments.length === 0) return null
  return { v: 1, text, attachments, droppedImages: draft.images.length, touchedAt: now }
}

function isPersistedDraft(value: unknown): value is PersistedDraft {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  // Versão diferente é descartada, não migrada: rascunho não enviado não vale uma migração.
  if (candidate.v !== 1) return false
  if (typeof candidate.text !== 'string') return false
  if (!Array.isArray(candidate.attachments)) return false
  if (typeof candidate.droppedImages !== 'number') return false
  return true
}

/** `null` para chave ausente, corrompida ou de versão desconhecida — sempre sem lançar. */
export function readDraft(threadKey: string): RestoredDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(threadKey))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isPersistedDraft(parsed)) {
      localStorage.removeItem(draftKey(threadKey))
      return null
    }
    return {
      text: parsed.text,
      attachments: parsed.attachments,
      droppedImages: Math.max(0, Math.trunc(parsed.droppedImages)),
    }
  } catch {
    return null
  }
}

export function removeDraft(threadKey: string): void {
  try {
    localStorage.removeItem(draftKey(threadKey))
  } catch {
    // Storage indisponível: nada a remover que o próximo boot vá encontrar.
  }
}

/**
 * Grava o rascunho, ou remove a chave quando não há nada a guardar.
 *
 * Nunca lança: cota estourada (`QuotaExceededError`) devolve `'unavailable'` e o rascunho segue em
 * memória naquela sessão. Travar o composer por causa da persistência inverteria a prioridade.
 */
export function saveDraft(threadKey: string, draft: ComposerDraft, now = Date.now()): SaveDraftResult {
  const payload = serializeDraft(draft, now)
  if (payload === null) {
    removeDraft(threadKey)
    return 'removed'
  }
  const serialized = JSON.stringify(payload)
  if (byteLength(serialized) > DRAFT_MAX_BYTES) return 'too-large'
  try {
    localStorage.setItem(draftKey(threadKey), serialized)
    return 'saved'
  } catch {
    return 'unavailable'
  }
}

/**
 * Derruba os rascunhos mais antigos por último toque, mantendo no máximo `max`. Devolve quantos
 * saíram. Chave ilegível conta como candidata (é lixo de versão anterior).
 */
export function evictOldDrafts(max = DRAFT_MAX_THREADS): number {
  try {
    const entries: Array<{ key: string; touchedAt: number }> = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key === null || !key.startsWith(DRAFT_STORAGE_PREFIX)) continue
      let touchedAt = 0
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '')
        if (isPersistedDraft(parsed) && typeof parsed.touchedAt === 'number') touchedAt = parsed.touchedAt
      } catch {
        touchedAt = 0
      }
      entries.push({ key, touchedAt })
    }
    if (entries.length <= max) return 0
    entries.sort((a, b) => a.touchedAt - b.touchedAt)
    const excedente = entries.slice(0, entries.length - max)
    for (const entry of excedente) localStorage.removeItem(entry.key)
    return excedente.length
  } catch {
    return 0
  }
}

/**
 * Devolve texto e anexos explícitos ao rascunho corrente, preservando as pills (que vêm da thread).
 * A contagem de imagens perdidas não entra no rascunho: é aviso de UI, com vida própria.
 */
export function restoreIntoDraft(draft: ComposerDraft, restored: RestoredDraft): ComposerDraft {
  return { ...draft, text: restored.text, attachments: restored.attachments }
}

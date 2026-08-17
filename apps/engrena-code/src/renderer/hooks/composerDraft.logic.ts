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

import type { ChatModeItem } from '../services/prompt-library-service'
import type { ThreadAccessLevel, ThreadExecutionMode, ThreadProvider } from '../services/threads-service'
import { slugifyPromptName } from '../../services/prompts/prompt-spec.js'

/**
 * Regras puras da biblioteca de prompts salvos e modos de chat (F28 §3.4): merge do preset de um
 * modo sobre o rascunho do composer e validação de nome/corpo. Sem React e sem service — quem
 * chama o `promptLibraryService` e guarda estado é `usePromptLibrary`.
 */

/** Fatia do rascunho do composer que um modo de chat toca. `ComposerDraft` a satisfaz. */
export interface PromptLibraryDraft {
  provider: ThreadProvider
  model: string | null
  reasoningLevel: string | null
  accessLevel: ThreadAccessLevel
  executionMode: ThreadExecutionMode
  text: string
  chatMode: string | null
}

const PROVIDERS: readonly ThreadProvider[] = ['claude', 'codex', 'kimi', 'minimax', 'glm', 'grok']
const ACCESS_LEVELS: readonly ThreadAccessLevel[] = ['supervised', 'auto-accept-edits', 'full-access']
const EXECUTION_MODES: readonly ThreadExecutionMode[] = ['main', 'worktree']

function asProvider(value: string | null): ThreadProvider | null {
  return value !== null && (PROVIDERS as readonly string[]).includes(value) ? (value as ThreadProvider) : null
}

function asAccessLevel(value: string | null): ThreadAccessLevel | null {
  return value !== null && (ACCESS_LEVELS as readonly string[]).includes(value)
    ? (value as ThreadAccessLevel)
    : null
}

function asExecutionMode(value: string | null): ThreadExecutionMode | null {
  return value !== null && (EXECUTION_MODES as readonly string[]).includes(value)
    ? (value as ThreadExecutionMode)
    : null
}

// ── Preset do modo sobre o rascunho ──────────────────────────────────────────

/**
 * Aplica o preset do modo no rascunho. Provider e execution só mudam em thread nova: na thread
 * existente os dois são imutáveis (mesma regra das pills do composer). `model`, `reasoningLevel`
 * e `accessLevel` valem sempre, com fallback no valor corrente do rascunho.
 */
export function applyModeToDraft<TDraft extends PromptLibraryDraft>(
  draft: TDraft,
  mode: ChatModeItem,
  options: { isNewThread: boolean }
): TDraft {
  const provider = asProvider(mode.provider)
  const accessLevel = asAccessLevel(mode.accessLevel)
  const executionMode = asExecutionMode(mode.executionMode)
  const { isNewThread } = options
  return {
    ...draft,
    chatMode: mode.name,
    provider: isNewThread && provider !== null ? provider : draft.provider,
    model: mode.model ?? draft.model,
    reasoningLevel: mode.reasoningLevel ?? draft.reasoningLevel,
    accessLevel: accessLevel ?? draft.accessLevel,
    executionMode: isNewThread && executionMode !== null ? executionMode : draft.executionMode,
  }
}

/**
 * Seleção da pill de modo. `null` limpa só `chatMode`; nome fora da lista é no-op — devolve a
 * **mesma referência** do rascunho (nem erro, nem limpeza).
 */
export function applyChatModeByName<TDraft extends PromptLibraryDraft>(
  draft: TDraft,
  modes: readonly ChatModeItem[],
  name: string | null,
  options: { isNewThread: boolean }
): TDraft {
  if (name === null) return { ...draft, chatMode: null }
  const mode = modes.find((m) => m.name === name)
  if (mode === undefined) return draft
  return applyModeToDraft(draft, mode, options)
}

/**
 * Modo apagado: limpa `chatMode` só se for o que está selecionado — senão devolve a **mesma
 * referência** e a pill de outro modo continua de pé.
 */
export function clearChatModeIfSelected<TDraft extends PromptLibraryDraft>(
  draft: TDraft,
  deletedName: string
): TDraft {
  return draft.chatMode === deletedName ? { ...draft, chatMode: null } : draft
}

// ── Validação ────────────────────────────────────────────────────────────────

/** Copy exibida em `libraryError` no composer (TaskComposer). */
export const PROMPT_LIBRARY_COPY = {
  promptIncomplete: 'Dê um nome ao prompt e escreva o texto antes de salvar.',
  modeNameRequired: 'Dê um nome ao modo antes de salvar.',
} as const

export type PromptLibraryValidation<T> = { ok: true; value: T } | { ok: false; error: string }

/** Nome passa por `slugifyPromptName`; nome ou corpo vazio barra o POST antes do service. */
export function validateSavedPrompt(
  rawName: string,
  rawText: string
): PromptLibraryValidation<{ name: string; body: string }> {
  const name = slugifyPromptName(rawName)
  const body = rawText.trim()
  if (name === '' || body === '') {
    return { ok: false, error: PROMPT_LIBRARY_COPY.promptIncomplete }
  }
  return { ok: true, value: { name, body } }
}

/** O corpo do modo é o preset do composer, então só o nome é validado aqui. */
export function validateChatModeName(rawName: string): PromptLibraryValidation<string> {
  const name = slugifyPromptName(rawName)
  if (name === '') return { ok: false, error: PROMPT_LIBRARY_COPY.modeNameRequired }
  return { ok: true, value: name }
}

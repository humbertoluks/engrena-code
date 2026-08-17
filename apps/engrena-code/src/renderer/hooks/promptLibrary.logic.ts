import type { ChatModeItem } from '../services/prompt-library-service'
import type { SkillLinkState } from '../services/skills-service'
import type { RuleLinkState } from '../services/rules-service'
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

// ── Catálogo do modo: skills/rules que ele deixa ativas (F28 §3.4) ───────────
//
// Semântica de filtro (decidida com o usuário): o modo restringe o que o projeto já vincula,
// nunca liga o que o projeto não vinculou. Por isso o seletor só oferece o que o turno de fato
// resolve — oferecer mais faria o modo parecer filtrar algo que nunca esteve no catálogo.

export interface ModeCatalogOptions {
  skills: string[]
  rules: string[]
}

export const EMPTY_MODE_CATALOG: ModeCatalogOptions = { skills: [], rules: [] }

/** Mesmo predicado de `resolveSkillsForProject` (`ps.enabled = 1 AND s.enabled = 1`). */
export function selectableSkillNames(skills: readonly SkillLinkState[]): string[] {
  return skills.filter((s) => s.linked && s.enabled && s.enabledInProject !== false).map((s) => s.name)
}

/** Mesmo predicado de `resolveForTurn` das rules (`enabled && activeInProject`). */
export function selectableRuleNames(rules: readonly RuleLinkState[]): string[] {
  return rules.filter((r) => r.enabled && r.activeInProject).map((r) => r.name)
}

/**
 * `null` = o modo não fala do assunto e o catálogo inteiro do projeto vale; `[]` = nenhuma.
 * Desmarcar um item a partir de `null` materializa a lista com todos menos ele — é a única forma
 * de sair do "sem filtro" sem perder o resto. Remarcar tudo NÃO volta para `null`: lista explícita
 * congela o catálogo de hoje, e quem quer acompanhar o projeto usa o botão "Todas".
 */
export function toggleModeCatalogName(
  current: readonly string[] | null,
  name: string,
  all: readonly string[]
): string[] | null {
  if (current === null) return all.filter((item) => item !== name)
  if (current.includes(name)) return current.filter((item) => item !== name)
  return all.filter((item) => current.includes(item) || item === name)
}

/** Sem filtro, tudo aparece marcado — é o que o turno vai receber. */
export function isModeCatalogChecked(current: readonly string[] | null, name: string): boolean {
  return current === null || current.includes(name)
}

// ── Formulário de modo (criar e editar) ──────────────────────────────────────

export interface ChatModeFormDraft {
  name: string
  instructions: string
  skills: string[] | null
  rules: string[] | null
}

export const EMPTY_CHAT_MODE_FORM: ChatModeFormDraft = {
  name: '',
  instructions: '',
  skills: null,
  rules: null,
}

/** Pré-preenche o formulário de edição a partir do modo salvo, sem alias das listas. */
export function chatModeFormFrom(mode: ChatModeItem): ChatModeFormDraft {
  return {
    name: mode.name,
    instructions: mode.instructions,
    skills: mode.skills === null ? null : [...mode.skills],
    rules: mode.rules === null ? null : [...mode.rules],
  }
}

/**
 * Modo renomeado: a pill segue o novo nome se era ele o selecionado — senão devolve a **mesma
 * referência**, como `clearChatModeIfSelected`.
 */
export function renameChatModeIfSelected<TDraft extends PromptLibraryDraft>(
  draft: TDraft,
  previousName: string,
  nextName: string
): TDraft {
  return draft.chatMode === previousName ? { ...draft, chatMode: nextName } : draft
}

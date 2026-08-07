import type { ThreadProvider } from '../../db/repositories/threads.js'

export type ReasoningLevel = 'low' | 'medium' | 'high' | 'extra-high' | 'max'

export interface ProviderCatalogEntry {
  models: string[]
  defaultModel: string
  reasoningLevels: ReasoningLevel[]
  defaultReasoningLevel: ReasoningLevel | null
  multimodal: boolean
}

/** Catálogo estático (spec F16 §5.1/§3.3) — versionado no app, sem descoberta dinâmica via CLI. */
export const PROVIDER_CATALOG: Record<ThreadProvider, ProviderCatalogEntry> = {
  claude: {
    models: ['claude-sonnet-4-6', 'claude-opus-4-1', 'claude-haiku-4-5'],
    defaultModel: 'claude-sonnet-4-6',
    reasoningLevels: ['low', 'medium', 'high', 'extra-high', 'max'],
    defaultReasoningLevel: null,
    multimodal: true,
  },
  codex: {
    models: ['gpt-5-codex', 'gpt-5.1-codex'],
    defaultModel: 'gpt-5-codex',
    reasoningLevels: ['low', 'medium', 'high', 'extra-high', 'max'],
    defaultReasoningLevel: 'medium',
    multimodal: true,
  },
  kimi: {
    models: ['kimi-latest'],
    defaultModel: 'kimi-latest',
    reasoningLevels: ['low', 'medium', 'high'],
    defaultReasoningLevel: null,
    multimodal: false,
  },
  minimax: {
    models: ['abab6.5s-chat'],
    defaultModel: 'abab6.5s-chat',
    reasoningLevels: [],
    defaultReasoningLevel: null,
    multimodal: false,
  },
}

export interface ComposerCatalogResponse {
  providers: Record<ThreadProvider, ProviderCatalogEntry>
}

export function getComposerCatalog(): ComposerCatalogResponse {
  return { providers: PROVIDER_CATALOG }
}

export function isValidModel(provider: ThreadProvider, model: string): boolean {
  return PROVIDER_CATALOG[provider].models.includes(model)
}

export function isValidReasoningLevel(provider: ThreadProvider, level: string): boolean {
  return (PROVIDER_CATALOG[provider].reasoningLevels as string[]).includes(level)
}

export function isMultimodal(provider: ThreadProvider): boolean {
  return PROVIDER_CATALOG[provider].multimodal
}

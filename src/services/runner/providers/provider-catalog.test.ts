import { describe, expect, it } from 'vitest'
import {
  PROVIDER_CATALOG,
  getComposerCatalog,
  isValidModel,
  isValidReasoningLevel,
  isMultimodal,
} from './provider-catalog.js'

const PROVIDERS = ['claude', 'codex', 'kimi', 'minimax'] as const

describe('test_catalog_defaults_per_provider', () => {
  it('defaultModel is a member of models for every provider', () => {
    for (const provider of PROVIDERS) {
      const entry = PROVIDER_CATALOG[provider]
      expect(entry.models).toContain(entry.defaultModel)
    }
  })

  it('defaultReasoningLevel is a member of reasoningLevels or null', () => {
    for (const provider of PROVIDERS) {
      const entry = PROVIDER_CATALOG[provider]
      if (entry.defaultReasoningLevel === null) continue
      expect(entry.reasoningLevels).toContain(entry.defaultReasoningLevel)
    }
  })

  it('multimodal flags match spec (claude/codex true, kimi/minimax false)', () => {
    expect(PROVIDER_CATALOG.claude.multimodal).toBe(true)
    expect(PROVIDER_CATALOG.codex.multimodal).toBe(true)
    expect(PROVIDER_CATALOG.kimi.multimodal).toBe(false)
    expect(PROVIDER_CATALOG.minimax.multimodal).toBe(false)
  })

  it('getComposerCatalog exposes all providers', () => {
    const catalog = getComposerCatalog()
    for (const provider of PROVIDERS) expect(catalog.providers[provider]).toBeDefined()
  })
})

describe('isValidModel / isValidReasoningLevel / isMultimodal', () => {
  it('accepts a model in the catalog and rejects an unknown one', () => {
    expect(isValidModel('claude', 'claude-sonnet-4-6')).toBe(true)
    expect(isValidModel('claude', 'gpt-unknown')).toBe(false)
  })

  it('accepts a reasoning level in the catalog and rejects an unknown one', () => {
    expect(isValidReasoningLevel('codex', 'high')).toBe(true)
    expect(isValidReasoningLevel('minimax', 'high')).toBe(false)
  })

  it('mirrors PROVIDER_CATALOG.multimodal', () => {
    expect(isMultimodal('claude')).toBe(true)
    expect(isMultimodal('minimax')).toBe(false)
  })
})

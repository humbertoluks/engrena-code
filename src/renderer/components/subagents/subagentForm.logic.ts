import type { SubagentInput, SubagentProvider } from '../../../services/db/repositories/subagents.js'

export const SUBAGENT_PROMPT_MAX_BYTES = 1_048_576

export type ToolsMode = 'unrestricted' | 'none' | 'allowlist'

export const READONLY_TOOLS = ['Read', 'Grep', 'Glob']

export function promptExceedsLimit(prompt: string): boolean {
  return new TextEncoder().encode(prompt).length > SUBAGENT_PROMPT_MAX_BYTES
}

export function toolsModeFromValue(tools: string[] | null): ToolsMode {
  if (tools === null) return 'unrestricted'
  if (tools.length === 0) return 'none'
  return 'allowlist'
}

export function toolsValueFromMode(mode: ToolsMode, allowlist: string[]): string[] | null {
  if (mode === 'unrestricted') return null
  if (mode === 'none') return []
  return allowlist
}

export function hidesModelFields(provider: SubagentProvider): boolean {
  return provider === 'inherit'
}

export interface SubagentFormValues {
  name: string
  description: string
  category: string
  provider: SubagentProvider
  model: string
  reasoningLevel: string
  toolsMode: ToolsMode
  toolsAllowlist: string[]
  prompt: string
  idleTimeoutMinutes: string
  enabled: boolean
}

export function emptyFormValues(): SubagentFormValues {
  return {
    name: '',
    description: '',
    category: '',
    provider: 'claude',
    model: '',
    reasoningLevel: '',
    toolsMode: 'unrestricted',
    toolsAllowlist: [],
    prompt: '',
    idleTimeoutMinutes: '',
    enabled: true,
  }
}

export function idleTimeoutIsValid(raw: string): boolean {
  if (raw.trim() === '') return true
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 480
}

export function canSubmitSubagentForm(values: SubagentFormValues): boolean {
  if (values.name.trim() === '') return false
  if (values.description.trim() === '') return false
  if (values.prompt.trim() === '') return false
  if (promptExceedsLimit(values.prompt)) return false
  if (!idleTimeoutIsValid(values.idleTimeoutMinutes)) return false
  return true
}

export function buildSubagentPayload(values: SubagentFormValues): SubagentInput {
  const hideModel = hidesModelFields(values.provider)
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    prompt: values.prompt,
    provider: values.provider,
    model: hideModel || values.model.trim() === '' ? null : values.model.trim(),
    reasoningLevel: hideModel || values.reasoningLevel.trim() === '' ? null : values.reasoningLevel.trim(),
    tools: toolsValueFromMode(values.toolsMode, values.toolsAllowlist),
    category: values.category.trim() === '' ? null : values.category.trim(),
    idleTimeoutMinutes: values.idleTimeoutMinutes.trim() === '' ? null : Number(values.idleTimeoutMinutes),
    enabled: values.enabled,
  }
}

/**
 * Regras puras de prompts salvos e modos de chat (F28 §3.4).
 *
 * Módulo sem `fs`/`electron` de propósito: o renderer importa daqui (nome, variáveis, preview) em
 * vez de re-declarar os literais — mesma decisão de `provider-keys`/`github-token`.
 *
 * Sintaxe de variável copiada dos prompt files do Copilot: `${input:nome}` e
 * `${input:nome:placeholder}`.
 */

export const PROMPT_NAME_MAX = 40
export const PROMPT_BODY_MAX = 20_000
export const PROMPT_DESCRIPTION_MAX = 200
export const MODE_INSTRUCTIONS_MAX = 8_000

/** `nome` é digitado depois de `/`, então vive sob as mesmas regras de um comando: slug curto. */
export function slugifyPromptName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, PROMPT_NAME_MAX)
}

export function isValidPromptName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(name)
}

export interface PromptVariable {
  name: string
  placeholder: string
}

const VARIABLE_RE = /\$\{input:([a-zA-Z0-9_-]+)(?::([^}]*))?\}/g

/** Variáveis na ordem de aparição, sem repetir nome (a segunda ocorrência reusa o mesmo valor). */
export function extractPromptVariables(body: string): PromptVariable[] {
  const found: PromptVariable[] = []
  const seen = new Set<string>()
  for (const match of body.matchAll(VARIABLE_RE)) {
    const name = match[1]
    if (seen.has(name)) continue
    seen.add(name)
    found.push({ name, placeholder: match[2] ?? name })
  }
  return found
}

export function applyPromptVariables(body: string, values: Readonly<Record<string, string>>): string {
  return body.replace(VARIABLE_RE, (_full, name: string, placeholder?: string) => {
    const value = values[name]
    if (value !== undefined && value !== '') return value
    return placeholder ?? name
  })
}

export interface PromptPreview {
  text: string
  /** Trecho da primeira variável no texto final — o composer seleciona para o usuário digitar por cima. */
  selection: { start: number; end: number } | null
}

/**
 * Texto pronto para cair no composer: variáveis viram o placeholder e a primeira fica selecionada.
 * Sem formulário no meio do caminho — digitar por cima é mais rápido que preencher campo a campo.
 */
export function renderPromptForComposer(body: string): PromptPreview {
  const text = applyPromptVariables(body, {})
  const first = extractPromptVariables(body)[0]
  if (first === undefined) return { text, selection: null }
  const start = text.indexOf(first.placeholder)
  if (start < 0) return { text, selection: null }
  return { text, selection: { start, end: start + first.placeholder.length } }
}

export interface PromptSpecError {
  field: string
  message: string
}

export function validatePromptFields(input: {
  name?: unknown
  description?: unknown
  body?: unknown
}): PromptSpecError | null {
  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || !isValidPromptName(input.name)) {
      return { field: 'name', message: 'Nome deve ser um slug (a-z, 0-9, hífen), até 40 caracteres.' }
    }
  }
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== 'string' || input.description.length > PROMPT_DESCRIPTION_MAX) {
      return { field: 'description', message: `Descrição deve ter até ${PROMPT_DESCRIPTION_MAX} caracteres.` }
    }
  }
  if (input.body !== undefined) {
    if (typeof input.body !== 'string' || input.body.trim() === '') {
      return { field: 'body', message: 'Conteúdo do prompt é obrigatório.' }
    }
    if (input.body.length > PROMPT_BODY_MAX) {
      return { field: 'body', message: `Conteúdo deve ter até ${PROMPT_BODY_MAX} caracteres.` }
    }
  }
  return null
}

export function validateModeInstructions(instructions: unknown): PromptSpecError | null {
  if (instructions === undefined || instructions === null) return null
  if (typeof instructions !== 'string' || instructions.length > MODE_INSTRUCTIONS_MAX) {
    return { field: 'instructions', message: `Instruções devem ter até ${MODE_INSTRUCTIONS_MAX} caracteres.` }
  }
  return null
}

export interface ChatModePreset {
  provider: string | null
  model: string | null
  reasoningLevel: string | null
  accessLevel: string | null
  executionMode: string | null
}

/** Bloco que o modo injeta no system prompt do turno (vazio quando o modo só define preset). */
export function composeModeBlock(mode: { name: string; instructions: string } | null): string {
  if (mode === null || mode.instructions.trim() === '') return ''
  return `## Modo de chat: ${mode.name}\n${mode.instructions.trim()}`
}

// ── Catálogo do modo: skills/rules que ele deixa ativas no turno (F28 §3.4) ──
//
// Semântica de **filtro**, decidida com o usuário: o modo restringe o que o projeto já vincula,
// nunca liga o que o projeto não vinculou. O catálogo do projeto continua sendo o teto — assim
// um modo versionado no repo não vira porta de entrada para skill/rule que ninguém aprovou ali.

/** Teto por lista: modo é curadoria, não inventário. */
export const MODE_CATALOG_MAX = 50

/**
 * Lê a lista de nomes de um valor de frontmatter. Aceita as duas formas que aparecem na prática:
 * `skills: a, b` e `skills: ['a', 'b']` (a segunda é a do Copilot).
 *
 * `undefined`/ausente e valor em branco devolvem `null` — "o modo não fala do assunto", que é
 * diferente de `[]` (lista vazia explícita = nenhuma skill). A distinção importa: um `skills:`
 * digitado sem valor por engano não pode apagar o catálogo inteiro do turno.
 */
export function parseNameList(raw: string | undefined | null): string[] | null {
  if (raw === undefined || raw === null) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const inner = /^\[([\s\S]*)\]$/.exec(trimmed)
  const body = inner === null ? trimmed : inner[1]
  if (inner !== null && body.trim() === '') return []
  const names = body
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, '').trim())
    .filter((part) => part !== '')
  return dedupeNames(names).slice(0, MODE_CATALOG_MAX)
}

function dedupeNames(names: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of names) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

/**
 * Valida a lista vinda da API. `undefined`/`null` passam (modo não filtra). Shape errado é 400 em
 * vez de silêncio: um `skills: "a,b"` mandado como string seria normalizado para `null` e o modo
 * pareceria salvo sem filtro nenhum.
 */
export function validateModeCatalog(value: unknown, field: 'skills' | 'rules'): PromptSpecError | null {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return { field, message: `Campo "${field}" deve ser uma lista de nomes.` }
  }
  if (value.length > MODE_CATALOG_MAX) {
    return { field, message: `Campo "${field}" aceita até ${MODE_CATALOG_MAX} nomes.` }
  }
  return null
}

/** Normaliza uma lista vinda da API (array cru) para o mesmo formato do frontmatter. */
export function normalizeNameList(value: unknown): string[] | null {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value)) return null
  const names = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim())
  return dedupeNames(names.filter((name) => name !== '')).slice(0, MODE_CATALOG_MAX)
}

/**
 * Filtra itens do catálogo do projeto pelos nomes que o modo deixou ativos. `allowed === null`
 * (modo sem a chave, ou nenhum modo) devolve a lista intacta. Comparação case-insensitive:
 * quem escreve o modo à mão não deve tropeçar em maiúscula.
 */
export function filterByModeCatalog<T extends { name: string }>(
  items: readonly T[],
  allowed: readonly string[] | null | undefined
): T[] {
  if (allowed === null || allowed === undefined) return [...items]
  const wanted = new Set(allowed.map((name) => name.trim().toLowerCase()))
  return items.filter((item) => wanted.has(item.name.trim().toLowerCase()))
}

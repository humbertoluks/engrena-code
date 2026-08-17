/**
 * Prompts e modos versionados no repositório — paridade com `*.prompt.md` / `*.chatmode.md` do
 * Copilot, que moram no workspace e viajam no git junto do código.
 *
 * Entram como itens **somente leitura** ao lado dos que o usuário cria pela UI (esses ficam no
 * banco): o arquivo é do repo, quem edita é o editor, não o EngrenaCode.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseNameList, slugifyPromptName } from './prompt-spec.js'

export const PROMPT_DIR = join('.engrena', 'prompts')
export const MODE_DIR = join('.engrena', 'modes')

const PROMPT_SUFFIX = '.prompt.md'
const MODE_SUFFIX = '.chatmode.md'
/** Arquivo de instrução, não dump: acima disso é engano (log, dataset) e não entra no prompt. */
const MAX_FILE_BYTES = 64 * 1024

export interface Frontmatter {
  data: Record<string, string>
  body: string
}

/**
 * Frontmatter YAML simples (`chave: valor` por linha) — o mesmo subconjunto que os arquivos do
 * Copilot usam na prática. Sem dependência de parser YAML: valor é string, ponto.
 */
export function parseFrontmatter(raw: string): Frontmatter {
  const text = raw.replace(/^\uFEFF/, '')
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (match === null) return { data: {}, body: text.trim() }

  const data: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const sep = line.indexOf(':')
    if (sep <= 0) continue
    const key = line.slice(0, sep).trim().toLowerCase()
    const value = line
      .slice(sep + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (key !== '') data[key] = value
  }
  return { data, body: text.slice(match[0].length).trim() }
}

function listFiles(dir: string, suffix: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  return entries.filter((name) => name.toLowerCase().endsWith(suffix)).sort()
}

function readSmallFile(path: string): string | null {
  try {
    if (statSync(path).size > MAX_FILE_BYTES) return null
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

export interface FilePrompt {
  name: string
  description: string
  body: string
  /** Path relativo à raiz do projeto — mostrado na UI para o usuário saber onde editar. */
  file: string
}

export function readPromptFiles(projectRoot: string): FilePrompt[] {
  const dir = join(projectRoot, PROMPT_DIR)
  const prompts: FilePrompt[] = []
  for (const fileName of listFiles(dir, PROMPT_SUFFIX)) {
    const raw = readSmallFile(join(dir, fileName))
    if (raw === null) continue
    const { data, body } = parseFrontmatter(raw)
    if (body === '') continue
    const name = slugifyPromptName(data.name ?? fileName.slice(0, -PROMPT_SUFFIX.length))
    if (name === '') continue
    prompts.push({
      name,
      description: data.description ?? '',
      body,
      file: `${PROMPT_DIR.replace(/\\/g, '/')}/${fileName}`,
    })
  }
  return prompts
}

export interface FileChatMode {
  name: string
  description: string
  provider: string | null
  model: string | null
  reasoningLevel: string | null
  accessLevel: string | null
  executionMode: string | null
  instructions: string
  /** `skills:`/`rules:` do frontmatter — `null` quando a chave não aparece (ver prompt-spec). */
  skills: string[] | null
  rules: string[] | null
  file: string
}

function orNull(value: string | undefined): string | null {
  return value === undefined || value.trim() === '' ? null : value.trim()
}

export function readModeFiles(projectRoot: string): FileChatMode[] {
  const dir = join(projectRoot, MODE_DIR)
  const modes: FileChatMode[] = []
  for (const fileName of listFiles(dir, MODE_SUFFIX)) {
    const raw = readSmallFile(join(dir, fileName))
    if (raw === null) continue
    const { data, body } = parseFrontmatter(raw)
    const name = slugifyPromptName(data.name ?? fileName.slice(0, -MODE_SUFFIX.length))
    if (name === '') continue
    modes.push({
      name,
      description: data.description ?? '',
      provider: orNull(data.provider),
      model: orNull(data.model),
      reasoningLevel: orNull(data.reasoning ?? data.reasoninglevel),
      accessLevel: orNull(data.access ?? data.accesslevel),
      executionMode: orNull(data.execution ?? data.executionmode),
      instructions: body,
      skills: parseNameList(data.skills),
      rules: parseNameList(data.rules),
      file: `${MODE_DIR.replace(/\\/g, '/')}/${fileName}`,
    })
  }
  return modes
}

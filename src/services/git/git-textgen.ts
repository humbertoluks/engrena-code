import type { ThreadProvider } from '../db/repositories/threads.js'
import { runCliTurn as defaultRunCliTurn } from '../runner/providers/cli-driver.js'
import type { ProviderUsage } from '../runner/providers/provider-types.js'
import { getVcsStatus, diffWorkingTree, type WorkingTreeDiffFile } from './git-client.js'

export class TextgenError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export type TextgenMode = 'commit' | 'pr'

export interface TextgenInput {
  mode: TextgenMode
  provider: ThreadProvider
  model?: string | null
  apiKey?: string
  cwd: string
}

export interface TextgenResult {
  subject: string
  body?: string
  title?: string
  usage?: ProviderUsage
  costUsd?: number | null
}

/** Injetável para testes — produção usa `runCliTurn` (spawn real do binário do provider), como `dispatch.ts`. */
export type RunCliTurn = typeof defaultRunCliTurn
let runCliTurnImpl: RunCliTurn = defaultRunCliTurn
export function setRunCliTurnForTesting(fn: RunCliTurn): void {
  runCliTurnImpl = fn
}
export function resetRunCliTurnForTesting(): void {
  runCliTurnImpl = defaultRunCliTurn
}

function summarizeDiff(diffs: WorkingTreeDiffFile[], maxChars = 4000): string {
  if (diffs.length === 0) return '(nenhuma alteração pendente detectada)'

  const parts: string[] = []
  let used = 0
  for (const file of diffs) {
    const header = `--- ${file.file} (+${file.additions}/-${file.deletions})`
    const body = file.hunks.map((h) => `${h.header}\n${h.lines.join('\n')}`).join('\n')
    const chunk = `${header}\n${body}`
    if (used + chunk.length > maxChars) {
      parts.push(`... (diff truncado — ${diffs.length} arquivo(s) no total)`)
      break
    }
    parts.push(chunk)
    used += chunk.length
  }
  return parts.join('\n\n')
}

function buildPrompt(mode: TextgenMode, statusLine: string, diffSummary: string): string {
  const shared = [`Status do repositório: ${statusLine}`, `Diff resumido (git diff HEAD):\n${diffSummary}`]

  if (mode === 'commit') {
    return [
      'Você escreve mensagens de commit para o EngrenaCode a partir das alterações pendentes de uma thread.',
      'Responda APENAS com um objeto JSON, sem markdown, sem explicação, no formato exato: {"subject": string, "body": string}.',
      '"subject" segue Conventional Commits, até 72 caracteres, em inglês. "body" é uma string (pode ser vazia) com detalhes relevantes.',
      ...shared,
    ].join('\n\n')
  }

  return [
    'Você escreve título e descrição de Pull Request para o EngrenaCode a partir das alterações pendentes de uma thread.',
    'Responda APENAS com um objeto JSON, sem markdown, sem explicação, no formato exato: {"title": string, "body": string, "subject": string}.',
    '"title" é o título do PR (Conventional Commits, até 72 caracteres, em inglês). "body" é markdown com um resumo das mudanças. "subject" repete o "title" para preencher o commit da sequência composta.',
    ...shared,
  ].join('\n\n')
}

function parseJsonResponse(text: string): Record<string, unknown> {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  return JSON.parse(match ? match[0] : stripped) as Record<string, unknown>
}

const TEXTGEN_FAILED_MESSAGE = 'Não foi possível gerar o texto. Escreva manualmente.'

/**
 * Geração one-shot (spec F14 §3.2): reusa `runCliTurn` com `accessLevel='supervised'` e sem
 * MCP servers — não é um turno de agente, não muta o repositório, não usa lease `agent`.
 */
export async function generateGitText(input: TextgenInput): Promise<TextgenResult> {
  const status = await getVcsStatus(input.cwd)
  const diffs = await diffWorkingTree(input.cwd)
  const statusLine = `branch=${status.branch ?? '(detached)'} ahead=${status.ahead} behind=${status.behind} dirty=${status.dirty}`
  const prompt = buildPrompt(input.mode, statusLine, summarizeDiff(diffs))

  let result
  try {
    result = await runCliTurnImpl({
      provider: input.provider,
      cwd: input.cwd,
      prompt,
      model: input.model ?? undefined,
      accessLevel: 'supervised',
      apiKey: input.apiKey,
      onEvent: () => {},
    })
  } catch {
    throw new TextgenError('textgen_failed', TEXTGEN_FAILED_MESSAGE)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = parseJsonResponse(result.text)
  } catch {
    throw new TextgenError('textgen_failed', TEXTGEN_FAILED_MESSAGE)
  }

  if (input.mode === 'commit') {
    if (typeof parsed.subject !== 'string' || parsed.subject.trim() === '') {
      throw new TextgenError('textgen_failed', TEXTGEN_FAILED_MESSAGE)
    }
    return {
      subject: parsed.subject.trim(),
      body: typeof parsed.body === 'string' ? parsed.body : undefined,
      usage: result.usage,
      costUsd: result.costUsd,
    }
  }

  if (typeof parsed.title !== 'string' || parsed.title.trim() === '') {
    throw new TextgenError('textgen_failed', TEXTGEN_FAILED_MESSAGE)
  }
  const title = parsed.title.trim()
  return {
    subject: typeof parsed.subject === 'string' && parsed.subject.trim() !== '' ? parsed.subject.trim() : title,
    title,
    body: typeof parsed.body === 'string' ? parsed.body : undefined,
    usage: result.usage,
    costUsd: result.costUsd,
  }
}

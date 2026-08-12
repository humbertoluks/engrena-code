/**
 * Anexos de contexto do composer (arquivo aberto, seleção, menção `@path`).
 *
 * Espelha o modelo de attachments do Copilot Chat (`chat/browser/attachments/chatAttachmentModel.ts`):
 * o usuário anexa referências, não texto colado no prompt. A mensagem persistida continua sendo o
 * que ele digitou; o conteúdo dos anexos entra só no prompt enviado ao provider, resolvido no
 * dispatch (arquivo é lido do disco na hora, então nunca vai conteúdo velho).
 *
 * Sem dependências Node — importável pelo renderer e pelo main (mesmo contrato de `composer-images.ts`).
 */

export const MAX_CONTEXT_ATTACHMENTS = 10
/** Teto por anexo no prompt; acima disso o conteúdo entra truncado com marcador. */
export const MAX_ATTACHMENT_CHARS = 20_000

export interface FileAttachmentInput {
  kind: 'file'
  path: string
}

export interface SelectionAttachmentInput {
  kind: 'selection'
  path: string
  text: string
  startLine?: number
  endLine?: number
}

export type ContextAttachmentInput = FileAttachmentInput | SelectionAttachmentInput

export type ContextAttachmentErrorCode =
  | 'attachment_limit_exceeded'
  | 'attachment_invalid'
  | 'attachment_too_large'
  | 'validation_error'

export interface ContextAttachmentError {
  code: ContextAttachmentErrorCode
  message: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Regras: ≤10 anexos, path relativo não vazio, seleção com texto ≤20k chars. `null` = válido. */
export function validateContextAttachments(value: unknown): ContextAttachmentError | null {
  if (!Array.isArray(value)) {
    return { code: 'validation_error', message: 'contextAttachments deve ser uma lista.' }
  }
  if (value.length > MAX_CONTEXT_ATTACHMENTS) {
    return {
      code: 'attachment_limit_exceeded',
      message: `Você pode anexar até ${MAX_CONTEXT_ATTACHMENTS} itens de contexto por mensagem.`,
    }
  }

  for (const raw of value) {
    if (!isPlainObject(raw)) {
      return { code: 'attachment_invalid', message: 'Anexo de contexto inválido.' }
    }
    const path = raw.path
    if (typeof path !== 'string' || path.trim() === '') {
      return { code: 'attachment_invalid', message: 'Anexo de contexto sem caminho.' }
    }
    if (raw.kind === 'file') continue
    if (raw.kind === 'selection') {
      if (typeof raw.text !== 'string' || raw.text.trim() === '') {
        return { code: 'attachment_invalid', message: `Seleção vazia em "${path}".` }
      }
      if (raw.text.length > MAX_ATTACHMENT_CHARS) {
        return { code: 'attachment_too_large', message: `A seleção de "${path}" excede o limite de contexto.` }
      }
      continue
    }
    return { code: 'attachment_invalid', message: 'Tipo de anexo de contexto desconhecido.' }
  }

  return null
}

/** Rótulo curto do anexo — mesmo texto no chip do composer e no bloco do prompt. */
export function attachmentLabel(attachment: ContextAttachmentInput): string {
  if (attachment.kind === 'file') return attachment.path
  const { startLine, endLine } = attachment
  if (typeof startLine === 'number' && typeof endLine === 'number') {
    return `${attachment.path}:${startLine}-${endLine}`
  }
  return `${attachment.path} (seleção)`
}

export function truncateAttachmentContent(content: string, max = MAX_ATTACHMENT_CHARS): string {
  if (content.length <= max) return content
  return `${content.slice(0, max)}\n… (truncado pelo EngrenaCode)`
}

export interface ResolvedAttachment {
  label: string
  content: string
}

/**
 * Bloco anexado ao prompt do turno. Fica antes do texto do usuário e diz de onde veio, para o
 * agente não confundir contexto com pedido.
 */
export function formatContextBlock(resolved: ResolvedAttachment[]): string {
  if (resolved.length === 0) return ''
  const parts = [
    '## Contexto anexado pelo usuário',
    'Estes trechos vieram da UI do EngrenaCode (arquivo aberto, seleção ou anexo). São referência, não o pedido. Releia do disco se precisar do arquivo inteiro.',
  ]
  for (const item of resolved) {
    parts.push(`### ${item.label}\n\`\`\`\n${item.content}\n\`\`\``)
  }
  return parts.join('\n\n')
}

/** Prompt final enviado ao provider: bloco de contexto (se houver) + o que o usuário digitou. */
export function composePromptWithContext(prompt: string, resolved: ResolvedAttachment[]): string {
  const block = formatContextBlock(resolved)
  return block === '' ? prompt : `${block}\n\n---\n\n${prompt}`
}

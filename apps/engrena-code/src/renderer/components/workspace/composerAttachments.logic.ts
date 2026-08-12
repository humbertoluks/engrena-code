/**
 * Anexos de contexto no composer (chips): arquivo do projeto, seleção de texto e o contexto
 * implícito do arquivo aberto no viewer.
 *
 * Espelha o modelo do Copilot Chat (`chat/browser/attachments/chatAttachmentModel.ts` +
 * `chatImplicitContext.ts`): o que vai para o turno é uma lista de referências visíveis e
 * removíveis, não texto colado no prompt. Imagens continuam no `images` do draft (contrato
 * multimodal do provider) e só compartilham a tira de chips na UI.
 */
import {
  attachmentLabel,
  MAX_ATTACHMENT_CHARS,
  MAX_CONTEXT_ATTACHMENTS,
  type ContextAttachmentInput,
} from '../../../services/runner/providers/context-attachments.js'

export { MAX_ATTACHMENT_CHARS, MAX_CONTEXT_ATTACHMENTS }

export interface FileAttachment {
  id: string
  kind: 'file'
  path: string
  /** Veio do arquivo aberto no viewer, não de uma ação explícita — o usuário pode desligar. */
  implicit?: boolean
}

export interface SelectionAttachment {
  id: string
  kind: 'selection'
  path: string
  text: string
  startLine?: number
  endLine?: number
  implicit?: boolean
}

export type ComposerAttachment = FileAttachment | SelectionAttachment

export type AddAttachmentResult =
  | { ok: true; attachments: ComposerAttachment[] }
  | { ok: false; message: string }

function newId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function makeFileAttachment(path: string, implicit = false): FileAttachment {
  return implicit ? { id: newId(), kind: 'file', path, implicit } : { id: newId(), kind: 'file', path }
}

export function makeSelectionAttachment(
  path: string,
  text: string,
  range?: { startLine?: number; endLine?: number },
  implicit = false
): SelectionAttachment {
  const base: SelectionAttachment = { id: newId(), kind: 'selection', path, text }
  if (range?.startLine !== undefined) base.startLine = range.startLine
  if (range?.endLine !== undefined) base.endLine = range.endLine
  if (implicit) base.implicit = true
  return base
}

/** Identidade para dedupe: mesmo arquivo (ou mesma seleção do mesmo trecho) não entra duas vezes. */
export function attachmentKey(attachment: ComposerAttachment): string {
  if (attachment.kind === 'file') return `file:${attachment.path}`
  return `selection:${attachment.path}:${attachment.startLine ?? ''}:${attachment.endLine ?? ''}:${attachment.text.length}`
}

export function attachmentChipLabel(attachment: ComposerAttachment): string {
  return attachmentLabel(toWireAttachment(attachment))
}

export function toWireAttachment(attachment: ComposerAttachment): ContextAttachmentInput {
  if (attachment.kind === 'file') return { kind: 'file', path: attachment.path }
  const wire: ContextAttachmentInput = { kind: 'selection', path: attachment.path, text: attachment.text }
  if (attachment.startLine !== undefined) wire.startLine = attachment.startLine
  if (attachment.endLine !== undefined) wire.endLine = attachment.endLine
  return wire
}

export function toWirePayload(attachments: readonly ComposerAttachment[]): ContextAttachmentInput[] {
  return attachments.map(toWireAttachment)
}

/** Anexo explícito vence o implícito do mesmo arquivo — senão o mesmo conteúdo iria duas vezes. */
export function addAttachment(
  attachments: readonly ComposerAttachment[],
  incoming: ComposerAttachment
): AddAttachmentResult {
  if (incoming.kind === 'selection' && incoming.text.length > MAX_ATTACHMENT_CHARS) {
    return { ok: false, message: `O trecho de "${incoming.path}" excede o limite de contexto.` }
  }

  const key = attachmentKey(incoming)
  const kept = attachments.filter((a) => attachmentKey(a) !== key)
  if (kept.length >= MAX_CONTEXT_ATTACHMENTS) {
    return { ok: false, message: `Você pode anexar até ${MAX_CONTEXT_ATTACHMENTS} itens de contexto por mensagem.` }
  }
  return { ok: true, attachments: [...kept, incoming] }
}

export function removeAttachment(attachments: readonly ComposerAttachment[], id: string): ComposerAttachment[] {
  return attachments.filter((a) => a.id !== id)
}

/**
 * Contexto implícito = o arquivo aberto no viewer (com a seleção, quando houver). Sai da lista
 * assim que o usuário fecha o arquivo, desliga o implícito ou anexa o mesmo arquivo à mão.
 */
export function withImplicitContext(
  explicit: readonly ComposerAttachment[],
  implicit: { path: string; selection?: { text: string; startLine?: number; endLine?: number } } | null,
  enabled: boolean
): ComposerAttachment[] {
  const base = explicit.filter((a) => a.implicit !== true)
  if (!enabled || implicit === null) return base
  const candidate =
    implicit.selection && implicit.selection.text.trim() !== ''
      ? makeSelectionAttachment(
          implicit.path,
          implicit.selection.text.slice(0, MAX_ATTACHMENT_CHARS),
          { startLine: implicit.selection.startLine, endLine: implicit.selection.endLine },
          true
        )
      : makeFileAttachment(implicit.path, true)
  const key = attachmentKey(candidate)
  if (base.some((a) => attachmentKey(a) === key || (a.kind === 'file' && a.path === implicit.path))) return base
  if (base.length >= MAX_CONTEXT_ATTACHMENTS) return base
  return [...base, candidate]
}

/** Texto solto arrastado de fora do projeto vira seleção nomeada — não dá para ler do disco depois. */
export function droppedTextAsAttachment(fileName: string, text: string): ComposerAttachment {
  return makeSelectionAttachment(fileName, text.slice(0, MAX_ATTACHMENT_CHARS))
}

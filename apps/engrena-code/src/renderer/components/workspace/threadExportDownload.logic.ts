/**
 * Download do export no renderer — Blob + âncora, sem IPC nem diálogo nativo.
 * Extraído do hook para cobrir append/click/remove/revoke e falhas de download em unit.
 */

export const EXPORT_COPY = {
  fetchFailed: 'Não foi possível exportar a conversa.',
  downloadFailed: 'Não foi possível baixar o arquivo exportado.',
  exporting: 'Exportando conversa…',
  exportButton: 'Exportar conversa (markdown)',
} as const

export function mimeTypeForExportFormat(format: 'md' | 'json'): string {
  return format === 'md' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8'
}

export interface BrowserDownloadHost {
  createObjectURL: (blob: Blob) => string
  revokeObjectURL: (url: string) => void
  createAnchor: () => HTMLAnchorElement
  appendAnchor: (anchor: HTMLAnchorElement) => void
  removeAnchor: (anchor: HTMLAnchorElement) => void
}

function defaultHost(): BrowserDownloadHost {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement('a'),
    appendAnchor: (anchor) => {
      document.body.appendChild(anchor)
    },
    removeAnchor: (anchor) => {
      anchor.remove()
    },
  }
}

/**
 * Cria Blob → ObjectURL → âncora no DOM → click → remove → revoke (sempre no finally).
 * Lança se createObjectURL/click falhar — o caller mapeia para `downloadFailed`.
 */
export function triggerBrowserDownload(
  content: string,
  fileName: string,
  mimeType: string,
  host: BrowserDownloadHost = defaultHost()
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = host.createObjectURL(blob)
  try {
    const anchor = host.createAnchor()
    anchor.href = url
    anchor.download = fileName
    anchor.rel = 'noopener'
    host.appendAnchor(anchor)
    try {
      anchor.click()
    } finally {
      host.removeAnchor(anchor)
    }
  } finally {
    host.revokeObjectURL(url)
  }
}

/** Mensagem de erro visível a partir da resposta da API (sem engolir falha). */
export function exportFetchErrorMessage(apiMessage: string | undefined): string {
  const trimmed = apiMessage?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : EXPORT_COPY.fetchFailed
}

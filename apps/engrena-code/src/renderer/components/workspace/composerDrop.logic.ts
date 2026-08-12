/**
 * Classificação do que foi solto/colado no composer.
 *
 * Arquivo arrastado de fora do app não tem caminho utilizável no renderer (Electron não expõe
 * `File.path` desde a v32), então texto vira anexo de seleção com o próprio conteúdo. Arquivo
 * arrastado da árvore do projeto carrega o path relativo no dataTransfer e vira anexo de arquivo,
 * que o servidor lê do disco na hora do turno.
 */

/** MIME próprio do drag interno (árvore de arquivos → composer). */
export const DROP_PATH_MIME = 'application/x-engrenacode-path'

/** Extensões tratadas como texto ao soltar de fora do app. */
const TEXT_LIKE = /\.(txt|md|markdown|json|ya?ml|toml|ini|env|csv|log|ts|tsx|js|jsx|mjs|cjs|css|scss|html?|xml|sql|sh|ps1|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|swift)$/i

export type DroppedItem =
  | { kind: 'image'; file: File }
  | { kind: 'text'; file: File }
  | { kind: 'unsupported'; name: string }

export function classifyDroppedFile(file: { name: string; type: string }): DroppedItem['kind'] {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('text/') || TEXT_LIKE.test(file.name)) return 'text'
  return 'unsupported'
}

export function classifyDroppedFiles(files: readonly File[]): DroppedItem[] {
  return files.map((file) => {
    const kind = classifyDroppedFile(file)
    return kind === 'unsupported' ? { kind, name: file.name } : { kind, file }
  })
}

/** Lê os arquivos de texto soltos, truncando no teto de contexto. */
export async function readDroppedFiles(files: readonly File[]): Promise<{
  texts: Array<{ name: string; text: string }>
  images: File[]
  unsupported: string[]
}> {
  const texts: Array<{ name: string; text: string }> = []
  const images: File[] = []
  const unsupported: string[] = []

  for (const item of classifyDroppedFiles(files)) {
    if (item.kind === 'image') {
      images.push(item.file)
      continue
    }
    if (item.kind === 'unsupported') {
      unsupported.push(item.name)
      continue
    }
    texts.push({ name: item.file.name, text: await item.file.text() })
  }

  return { texts, images, unsupported }
}

/** Imagens do clipboard num paste (print de tela, imagem copiada do navegador). */
export function imagesFromClipboard(items: DataTransferItemList | null): File[] {
  if (!items) return []
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return files
}

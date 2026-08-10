/** Max length for the projects-panel thread label (legacy LionCodeLabs: 80). */
export const THREAD_TITLE_MAX_LENGTH = 80

/** When the first prompt has no usable text (whitespace-only). */
export const THREAD_TITLE_FALLBACK = 'Nova thread'

/**
 * Short title for a new thread from the first user solicitation.
 * Uses the first non-empty line, truncated with an ellipsis when over the max.
 */
export function deriveThreadTitle(prompt: string): string {
  const firstLine =
    prompt
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ''
  const title = firstLine.length > 0 ? firstLine : THREAD_TITLE_FALLBACK
  if (title.length <= THREAD_TITLE_MAX_LENGTH) return title
  return `${title.slice(0, THREAD_TITLE_MAX_LENGTH - 3)}...`
}

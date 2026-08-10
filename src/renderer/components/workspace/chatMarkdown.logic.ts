/** Extract fenced-code language from a `language-*` className (remark/rehype). */
export function parseMarkdownCodeLanguage(className: string | undefined): string | null {
  if (!className) return null
  const match = /(?:^|\s)language-([\w#+.-]+)(?:\s|$)/.exec(className)
  return match?.[1] ?? null
}

/** Normalize common aliases for Shiki; unknown langs fall back to plaintext at highlight time. */
export function normalizeCodeLanguage(lang: string | null): string {
  if (!lang) return 'text'
  const lower = lang.toLowerCase()
  const aliases: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    sh: 'bash',
    shell: 'bash',
    yml: 'yaml',
    md: 'markdown',
    plaintext: 'text',
    txt: 'text',
  }
  return aliases[lower] ?? lower
}

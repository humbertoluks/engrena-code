/** Languages shipped in the renderer highlighter. Unknown ids fall back to plaintext. */
export const HIGHLIGHT_LANGUAGES = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'json',
  'jsonc',
  'html',
  'css',
  'scss',
  'markdown',
  'mdx',
  'bash',
  'yaml',
  'toml',
  'sql',
  'python',
  'go',
  'rust',
  'java',
  'php',
  'ruby',
  'c',
  'cpp',
  'csharp',
  'swift',
  'kotlin',
  'dart',
  'graphql',
  'docker',
  'dockerfile',
  'diff',
  'xml',
  'vue',
  'svelte',
  'lua',
  'r',
  'proto',
  'ini',
  'makefile',
  'prisma',
] as const

export type HighlightLanguage = (typeof HIGHLIGHT_LANGUAGES)[number]

const HIGHLIGHT_LANGUAGE_SET: ReadonlySet<string> = new Set(HIGHLIGHT_LANGUAGES)

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
    'c++': 'cpp',
    'c#': 'csharp',
    rs: 'rust',
    make: 'makefile',
  }
  return aliases[lower] ?? lower
}

/** Map a fence language to a bundled highlighter id, or `text` when we do not ship that grammar. */
export function resolveHighlightLanguage(lang: string | null): HighlightLanguage | 'text' {
  const normalized = normalizeCodeLanguage(lang)
  if (normalized === 'text') return 'text'
  if (HIGHLIGHT_LANGUAGE_SET.has(normalized)) return normalized as HighlightLanguage
  return 'text'
}

/** Full GFM+Shiki is expensive per delta — stream with a light path until the bubble settles. */
export type MarkdownRenderPath = 'light' | 'full'

export function selectMarkdownRenderPath(streaming: boolean): MarkdownRenderPath {
  return streaming ? 'light' : 'full'
}

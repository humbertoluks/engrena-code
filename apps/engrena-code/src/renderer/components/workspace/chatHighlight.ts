import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { HighlighterCore, LanguageRegistration } from 'shiki/core'
import type { ShikiThemeName } from '@engrena/ui'
import {
  type HighlightLanguage,
  resolveHighlightLanguage,
} from './chatMarkdown.logic'

const LANG_LOADERS: Record<
  HighlightLanguage,
  () => Promise<{ default: LanguageRegistration | LanguageRegistration[] }>
> = {
  javascript: () => import('@shikijs/langs/javascript'),
  typescript: () => import('@shikijs/langs/typescript'),
  jsx: () => import('@shikijs/langs/jsx'),
  tsx: () => import('@shikijs/langs/tsx'),
  json: () => import('@shikijs/langs/json'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  html: () => import('@shikijs/langs/html'),
  css: () => import('@shikijs/langs/css'),
  scss: () => import('@shikijs/langs/scss'),
  markdown: () => import('@shikijs/langs/markdown'),
  mdx: () => import('@shikijs/langs/mdx'),
  bash: () => import('@shikijs/langs/bash'),
  yaml: () => import('@shikijs/langs/yaml'),
  toml: () => import('@shikijs/langs/toml'),
  sql: () => import('@shikijs/langs/sql'),
  python: () => import('@shikijs/langs/python'),
  go: () => import('@shikijs/langs/go'),
  rust: () => import('@shikijs/langs/rust'),
  java: () => import('@shikijs/langs/java'),
  php: () => import('@shikijs/langs/php'),
  ruby: () => import('@shikijs/langs/ruby'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  csharp: () => import('@shikijs/langs/csharp'),
  swift: () => import('@shikijs/langs/swift'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  dart: () => import('@shikijs/langs/dart'),
  graphql: () => import('@shikijs/langs/graphql'),
  docker: () => import('@shikijs/langs/docker'),
  dockerfile: () => import('@shikijs/langs/dockerfile'),
  diff: () => import('@shikijs/langs/diff'),
  xml: () => import('@shikijs/langs/xml'),
  vue: () => import('@shikijs/langs/vue'),
  svelte: () => import('@shikijs/langs/svelte'),
  lua: () => import('@shikijs/langs/lua'),
  r: () => import('@shikijs/langs/r'),
  proto: () => import('@shikijs/langs/proto'),
  ini: () => import('@shikijs/langs/ini'),
  makefile: () => import('@shikijs/langs/makefile'),
  prisma: () => import('@shikijs/langs/prisma'),
}

let highlighterPromise: Promise<HighlighterCore> | null = null

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    langs: [],
    themes: [
      import('@shikijs/themes/github-light'),
      import('@shikijs/themes/github-dark'),
    ],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })
  return highlighterPromise
}

/** Theme-aware fenced-code HTML. Grammars load on demand; unknown langs render as plaintext. */
export async function highlightCode(
  code: string,
  language: string,
  theme: ShikiThemeName,
): Promise<string> {
  const highlighter = await getHighlighter()
  const lang = resolveHighlightLanguage(language)
  if (lang !== 'text') {
    const loaded = highlighter.getLoadedLanguages()
    if (!loaded.includes(lang)) {
      await highlighter.loadLanguage(LANG_LOADERS[lang])
    }
  }
  return highlighter.codeToHtml(code, { lang, theme })
}

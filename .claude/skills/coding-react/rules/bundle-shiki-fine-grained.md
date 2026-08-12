---
title: Load Shiki with an explicit lang/theme set, never the full entry
impact: HIGH
impactDescription: codeToHtml from shiki emits every grammar and theme as async chunks
tags: bundle, shiki, highlighter, code-splitting
---

## Load Shiki with an explicit lang/theme set, never the full entry

`import { codeToHtml } from 'shiki'` registra *todas* as grammars e temas. O bundler emite chunks enormes (WASM Oniguruma, emacs-lisp, cpp, dezenas de temas) mesmo quando o chat só usa duas paletas. Monte o highlighter com `shiki/core`, engine JavaScript, e `import()` estático por lang/tema que o produto realmente destaca. Lang desconhecida cai em plaintext.

**Incorrect (entry completa):**

```typescript
import { codeToHtml } from 'shiki'

export async function highlight(code: string, lang: string, theme: string) {
  return codeToHtml(code, { lang, theme })
}
```

**Correct (core + loaders explícitos):**

```typescript
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { HighlighterCore, LanguageRegistration } from 'shiki/core'

const LANG_LOADERS: Record<string, () => Promise<{ default: LanguageRegistration | LanguageRegistration[] }>> = {
  typescript: () => import('@shikijs/langs/typescript'),
  python: () => import('@shikijs/langs/python'),
}

let highlighterPromise: Promise<HighlighterCore> | null = null

function getHighlighter() {
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

export async function highlight(code: string, lang: string, theme: 'github-light' | 'github-dark') {
  const highlighter = await getHighlighter()
  const loader = LANG_LOADERS[lang]
  if (!loader) return highlighter.codeToHtml(code, { lang: 'text', theme })
  if (!highlighter.getLoadedLanguages().includes(lang)) {
    await highlighter.loadLanguage(loader)
  }
  return highlighter.codeToHtml(code, { lang, theme })
}
```

O módulo do highlighter entra no renderer via `import()` dinâmico no bloco de código, não como import estático da árvore do chat. A lista de langs suportadas e o fallback para `text` vivem num `*.logic.ts` testável.

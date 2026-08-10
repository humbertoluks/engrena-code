import { useEffect, useState, type ReactElement } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeSanitize from 'rehype-sanitize'
import { codeToHtml } from 'shiki'
import { shikiThemeFromResolved, useTheme } from '@engrena/ui'
import { normalizeCodeLanguage, parseMarkdownCodeLanguage } from './chatMarkdown.logic'

function CodeBlock({ code, language }: Readonly<{ code: string; language: string }>): ReactElement {
  const { resolvedTheme } = useTheme()
  const theme = shikiThemeFromResolved(resolvedTheme)
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const lang = normalizeCodeLanguage(language)

    void (async () => {
      try {
        const next = await codeToHtml(code, { lang, theme })
        if (!cancelled) setHtml(next)
      } catch {
        try {
          const next = await codeToHtml(code, { lang: 'text', theme })
          if (!cancelled) setHtml(next)
        } catch {
          if (!cancelled) setHtml(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [code, language, theme])

  if (html) {
    return (
      <div
        className="chat-markdown-code my-sm overflow-x-auto rounded-md border border-border text-[12px] leading-relaxed"
        // Shiki escapes source text; theme HTML is trusted highlighter output only.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <pre className="my-sm overflow-x-auto rounded-md border border-border bg-surface-2 p-md font-mono text-[12px] leading-relaxed text-fg">
      <code>{code}</code>
    </pre>
  )
}

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-sm mt-md text-lg font-semibold text-fg first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-sm mt-md text-base font-semibold text-fg first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-xs mt-md text-sm font-semibold text-fg first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-xs mt-sm text-sm font-semibold text-fg first:mt-0">{children}</h4>,
  h5: ({ children }) => <h5 className="mb-xs mt-sm text-sm font-medium text-fg first:mt-0">{children}</h5>,
  h6: ({ children }) => <h6 className="mb-xs mt-sm text-sm font-medium text-muted first:mt-0">{children}</h6>,
  p: ({ children }) => <p className="mb-sm last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-sm list-disc space-y-xs pl-md last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-sm list-decimal space-y-xs pl-md last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-sm border-l-2 border-accent pl-md text-muted">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-md border-border" />,
  table: ({ children }) => (
    <div className="my-sm overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-left text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-2">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border last:border-b-0">{children}</tr>,
  th: ({ children }) => (
    <th className="border-b border-border px-md py-sm font-semibold text-fg">{children}</th>
  ),
  td: ({ children }) => <td className="px-md py-sm align-top text-fg">{children}</td>,
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const lang = parseMarkdownCodeLanguage(className)
    const text = String(children).replace(/\n$/, '')
    if (lang !== null) {
      return <CodeBlock code={text} language={lang} />
    }
    return (
      <code className="rounded-sm bg-surface-2 px-[5px] py-px font-mono text-[12px] text-fg">{children}</code>
    )
  },
  del: ({ children }) => <del className="text-muted">{children}</del>,
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
}

export interface ChatMarkdownProps {
  content: string
  className?: string
}

/** GFM markdown for assistant chat replies (theme-aware fenced code via Shiki). */
export function ChatMarkdown({ content, className }: Readonly<ChatMarkdownProps>): ReactElement {
  const wrapperClass = ['chat-markdown text-sm leading-relaxed text-fg', className].filter(Boolean).join(' ')

  return (
    <div className={wrapperClass}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeSanitize]}
        components={markdownComponents}
      >
        {content}
      </Markdown>
    </div>
  )
}

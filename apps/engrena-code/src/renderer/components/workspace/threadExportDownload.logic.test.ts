import { describe, expect, it } from 'vitest'
import {
  EXPORT_COPY,
  exportFetchErrorMessage,
  mimeTypeForExportFormat,
  triggerBrowserDownload,
  type BrowserDownloadHost,
} from './threadExportDownload.logic.js'

interface MockHost extends BrowserDownloadHost {
  clicks: number
  revoked: string[]
  appended: HTMLAnchorElement[]
  removed: HTMLAnchorElement[]
}

function makeHost(overrides: Partial<BrowserDownloadHost> = {}): MockHost {
  let clicks = 0
  const revoked: string[] = []
  const appended: HTMLAnchorElement[] = []
  const removed: HTMLAnchorElement[] = []
  const anchor = {
    href: '',
    download: '',
    rel: '',
    click: () => {
      clicks += 1
    },
  } as HTMLAnchorElement

  const host: MockHost = {
    get clicks() {
      return clicks
    },
    revoked,
    appended,
    removed,
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: (url) => {
      revoked.push(url)
    },
    createAnchor: () => anchor,
    appendAnchor: (a) => {
      appended.push(a)
    },
    removeAnchor: (a) => {
      removed.push(a)
    },
    ...overrides,
  }
  return host
}

describe('mimeTypeForExportFormat', () => {
  it('escolhe MIME por formato', () => {
    expect(mimeTypeForExportFormat('md')).toContain('markdown')
    expect(mimeTypeForExportFormat('json')).toContain('json')
  })
})

describe('exportFetchErrorMessage', () => {
  it('usa mensagem da API quando há texto', () => {
    expect(exportFetchErrorMessage('Thread não encontrada.')).toBe('Thread não encontrada.')
  })

  it('cai no fallback português quando a API não manda mensagem', () => {
    expect(exportFetchErrorMessage(undefined)).toBe(EXPORT_COPY.fetchFailed)
    expect(exportFetchErrorMessage('   ')).toBe(EXPORT_COPY.fetchFailed)
  })
})

describe('triggerBrowserDownload', () => {
  it('append → click → remove → revoke na ordem', () => {
    const host = makeHost()
    triggerBrowserDownload('# oi', 'conversa.md', 'text/markdown', host)

    expect(host.appended).toHaveLength(1)
    expect(host.appended[0]?.download).toBe('conversa.md')
    expect(host.clicks).toBe(1)
    expect(host.removed).toHaveLength(1)
    expect(host.revoked).toEqual(['blob:mock-url'])
  })

  it('revoga o ObjectURL mesmo se o click falhar', () => {
    const host = makeHost({
      createAnchor: () =>
        ({
          href: '',
          download: '',
          rel: '',
          click: () => {
            throw new Error('click blocked')
          },
        }) as HTMLAnchorElement,
    })

    expect(() => triggerBrowserDownload('x', 'a.md', 'text/markdown', host)).toThrow('click blocked')
    expect(host.removed).toHaveLength(1)
    expect(host.revoked).toEqual(['blob:mock-url'])
  })

  it('propaga falha de createObjectURL sem deixar âncora órfã', () => {
    const host = makeHost({
      createObjectURL: () => {
        throw new Error('quota')
      },
    })
    expect(() => triggerBrowserDownload('x', 'a.md', 'text/markdown', host)).toThrow('quota')
    expect(host.appended).toHaveLength(0)
    expect(host.revoked).toHaveLength(0)
  })
})

import { describe, expect, it } from 'vitest'
import { resolveBrowseStartPath } from './addProjectModal.logic'

describe('resolveBrowseStartPath', () => {
  it('uses the unlock workspace when the path field is empty', () => {
    expect(resolveBrowseStartPath('', 'C:\\Users\\Me\\Code\\repos')).toBe(
      'C:\\Users\\Me\\Code\\repos',
    )
    expect(resolveBrowseStartPath('   ', '~/dev')).toBe('~/dev')
  })

  it('prefers a path already typed in the form', () => {
    expect(resolveBrowseStartPath('  D:\\work\\acme  ', '~/dev')).toBe('D:\\work\\acme')
  })

  it('returns null when both sides are blank', () => {
    expect(resolveBrowseStartPath('', '  ')).toBeNull()
  })
})

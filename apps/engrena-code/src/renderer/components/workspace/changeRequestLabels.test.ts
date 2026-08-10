import { describe, expect, it } from 'vitest'
import { changeRequestLabels } from './changeRequestLabels'

describe('changeRequestLabels', () => {
  it('labels_gitlab_uses_mr — short=MR for gitlab', () => {
    const labels = changeRequestLabels('gitlab')
    expect(labels.short).toBe('MR')
    expect(labels.quickCommitPushPr).toBe('Commit, push & MR')
    expect(labels.stageOpeningPr).toBe('Abrindo MR…')
    expect(labels.viewPr).toBe('Ver MR')
    expect(labels.placeholderPrTitle).toBe('Título da MR')
  })

  it('uses PR for github, bitbucket, azure, unknown and null', () => {
    for (const kind of ['github', 'bitbucket', 'azure', 'unknown', null] as const) {
      const labels = changeRequestLabels(kind)
      expect(labels.short).toBe('PR')
      expect(labels.quickCommitPushPr).toBe('Commit, push & PR')
      expect(labels.viewPr).toBe('Ver PR')
      expect(labels.placeholderPrTitle).toBe('Título do PR')
    }
  })
})

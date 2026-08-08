import type { VcsProviderKind } from '../../services/projects-service'

export interface ChangeRequestLabels {
  short: 'PR' | 'MR'
  quickCommitPushPr: string
  stageOpeningPr: string
  placeholderPrTitle: string
  placeholderPrBody: string
  prFieldsToggle: string
  viewPr: string
}

/** GitLab usa MR; os demais (incl. remote ainda não detectado) usam PR — ui.md §B / copy.md `vcs.cr.short.*`. */
export function changeRequestLabels(kind: VcsProviderKind): ChangeRequestLabels {
  const short: 'PR' | 'MR' = kind === 'gitlab' ? 'MR' : 'PR'
  const article = short === 'MR' ? 'da' : 'do'

  return {
    short,
    quickCommitPushPr: `Commit, push & ${short}`,
    stageOpeningPr: `Abrindo ${short}…`,
    placeholderPrTitle: `Título ${article} ${short}`,
    placeholderPrBody: `Descrição ${article} ${short} (markdown, opcional)`,
    prFieldsToggle: `Detalhes ${article} ${short}`,
    viewPr: `Ver ${short}`,
  }
}

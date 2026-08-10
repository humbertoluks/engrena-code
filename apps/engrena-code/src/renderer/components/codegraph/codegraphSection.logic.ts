import type { CodegraphUiStatus } from '../../services/codegraph-service'

const COPY = {
  badgeIndexed: (n: number) => `CodeGraph: indexado (${n}h atrás)`,
  badgeIndexing: 'CodeGraph: indexando…',
  badgeUnsupported: 'CodeGraph: não suportado',
  badgeAbsent: 'sem graph',
  badgeError: 'erro',
  titleAbsent: 'CodeGraph ausente — clique para criar',
  titleBuilding: 'Indexação em andamento',
  titleReady: 'CodeGraph pronto — o agente consulta o grafo de símbolos',
  titleUnsupported: 'CodeGraph: não suportado',
} as const

export type CodegraphBadgeStatus = CodegraphUiStatus | 'error'

/** Rótulo curto do badge na sidebar (F19 ui.md). */
export function badgeLabel(status: CodegraphBadgeStatus, ageHours: number | null): string {
  switch (status) {
    case 'indexed':
      return COPY.badgeIndexed(ageHours ?? 0)
    case 'indexing':
      return COPY.badgeIndexing
    case 'unsupported':
      return COPY.badgeUnsupported
    case 'error':
      return COPY.badgeError
    default:
      return COPY.badgeAbsent
  }
}

/** Tooltip / title do badge conforme o estado do graph. */
export function badgeTitle(status: CodegraphBadgeStatus): string {
  switch (status) {
    case 'indexed':
      return COPY.titleReady
    case 'indexing':
      return COPY.titleBuilding
    case 'unsupported':
      return COPY.titleUnsupported
    default:
      return COPY.titleAbsent
  }
}

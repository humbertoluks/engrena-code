/** Copy F29 — ids espelham docs/F29-monitor-de-execucao/copy.md */

export const GRAPH_COPY = {
  tab: 'Grafo',
  loading: 'Carregando grafo…',
  emptyNoThread: 'Selecione uma thread para ver a execução.',
  emptyIdle: 'Ainda não há delegações nesta thread.',
  nodeRoot: 'Agente',
  nodeBatch: 'Batch',
  nodeStage: 'Stage',
  status: {
    running: 'em execução',
    completed: 'concluído',
    error: 'erro',
    timeout: 'timeout',
    idle: 'ocioso',
    waiting_user: 'aguardando',
    cancelled: 'cancelado',
    pending: 'pendente',
    failed: 'falhou',
    skipped: 'ignorado',
  } as const,
  // Singular de verdade: o nó mostra "1 tool"/"1 ação" no primeiro evento do turno, e ele
  // aparece na tela em todo turno que usa uma ferramenta só.
  metaTools: (n: number) => (n === 1 ? '1 tool' : `${n} tools`),
  metaActions: (n: number) => (n === 1 ? '1 ação' : `${n} ações`),
  inspectorTitle: 'Mensagem',
  inspectorFrom: 'De',
  inspectorTo: 'Para',
  inspectorStatus: 'Status',
  inspectorStarted: 'Início',
  inspectorDuration: 'Duração',
  inspectorTask: 'Task',
  inspectorReturn: 'Retorno',
  inspectorClose: 'Fechar',
  inspectorEmptyReturn: '(sem retorno ainda)',
} as const

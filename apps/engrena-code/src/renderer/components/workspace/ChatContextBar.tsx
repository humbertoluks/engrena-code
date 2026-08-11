import type { ReactElement } from 'react'
import type { VcsStatus } from '../../services/projects-service'
import type { Thread } from '../../services/threads-service'

/**
 * O que os painéis recolhidos deixariam de contar.
 *
 * Recolher só é aceitável se nada essencial sumir junto. Com Projetos em trilho, o usuário perde a
 * única indicação de onde está; com a sidebar direita em trilho, perde a branch — e a branch decide
 * onde o commit do agente vai cair. Esses dois sinais migram para a barra de abas da conversa, que
 * é o único lugar sempre visível. Cada grupo aparece exatamente quando o painel dele não está.
 */

const COPY = {
  untitledThread: 'Nova conversa',
  noThread: 'Nenhuma conversa aberta',
  detached: 'HEAD destacada',
  dirtyTitle: 'Há alterações não commitadas',
  cleanTitle: 'Working tree limpo',
  aheadTitle: (n: number) => `${n} commit(s) à frente do remoto`,
  behindTitle: (n: number) => `${n} commit(s) atrás do remoto`,
  noGit: 'Sem git',
} as const

export interface ChatContextBarProps {
  /** Projetos está em trilho — a identidade da conversa precisa aparecer aqui. */
  showIdentity: boolean
  /** Sidebar direita está em trilho — o estado do repositório precisa aparecer aqui. */
  showRepo: boolean
  projectName: string | null
  thread: Thread | null
  vcsStatus: VcsStatus | null
}

export function ChatContextBar({
  showIdentity,
  showRepo,
  projectName,
  thread,
  vcsStatus,
}: Readonly<ChatContextBarProps>): ReactElement | null {
  if (!showIdentity && !showRepo) return null

  // A régua separa controle de estado: à esquerda dela abas, à direita só leitura.
  return (
    <div className="ml-xs flex min-w-0 flex-1 items-center gap-sm overflow-hidden border-l border-border pl-sm">
      {showIdentity ? (
        <Identity projectName={projectName} thread={thread} />
      ) : (
        <span className="flex-1" />
      )}
      {showRepo ? <Repo vcsStatus={vcsStatus} /> : null}
    </div>
  )
}

function Identity({
  projectName,
  thread,
}: Readonly<{ projectName: string | null; thread: Thread | null }>): ReactElement {
  if (projectName === null) {
    return <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{COPY.noThread}</span>
  }

  const title = thread === null ? COPY.noThread : (thread.title ?? COPY.untitledThread)

  return (
    <p className="flex min-w-0 flex-1 items-baseline gap-xs overflow-hidden text-[12px]">
      <span className="shrink-0 truncate font-medium text-fg/80">{projectName}</span>
      <span aria-hidden="true" className="shrink-0 text-muted/60">
        /
      </span>
      <span className="truncate text-muted">{title}</span>
    </p>
  )
}

function Repo({ vcsStatus }: Readonly<{ vcsStatus: VcsStatus | null }>): ReactElement {
  if (vcsStatus === null || !vcsStatus.hasGit) {
    return <span className="shrink-0 text-[11.5px] text-muted">{COPY.noGit}</span>
  }

  const branch = vcsStatus.detached ? COPY.detached : (vcsStatus.branch ?? '—')

  return (
    <span className="flex shrink-0 items-center gap-xs">
      <span title={branch} className="max-w-[160px] truncate font-mono text-[11.5px] text-muted">
        {branch}
      </span>
      {/* O ponto é a leitura rápida; o texto ao lado é o que o leitor de tela anuncia. */}
      <span
        aria-hidden="true"
        title={vcsStatus.dirty ? COPY.dirtyTitle : COPY.cleanTitle}
        className={`h-[6px] w-[6px] shrink-0 rounded-full ${vcsStatus.dirty ? 'bg-amber' : 'bg-fg/25'}`}
      />
      <span className="sr-only">{vcsStatus.dirty ? COPY.dirtyTitle : COPY.cleanTitle}</span>
      {vcsStatus.ahead > 0 ? (
        <span title={COPY.aheadTitle(vcsStatus.ahead)} className="shrink-0 text-[11px] text-muted">
          ↑{vcsStatus.ahead}
        </span>
      ) : null}
      {vcsStatus.behind > 0 ? (
        <span
          title={COPY.behindTitle(vcsStatus.behind)}
          className="shrink-0 text-[11px] text-muted"
        >
          ↓{vcsStatus.behind}
        </span>
      ) : null}
    </span>
  )
}

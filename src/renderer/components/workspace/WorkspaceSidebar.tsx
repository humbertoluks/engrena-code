import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { Project, VcsStatus } from '../../services/projects-service'
import type { Thread } from '../../services/threads-service'
import { rulesService } from '../../services/rules-service'
import { skillsService } from '../../services/skills-service'
import { subagentsService } from '../../services/subagents-service'
import { ProjectRulesModal } from '../rules/ProjectRulesModal'
import { ProjectSkillsModal } from '../skills/ProjectSkillsModal'
import { ProjectSubagentsModal } from '../subagents/ProjectSubagentsModal'
import { GitActions } from './GitActions'

const COPY = {
  newThread: 'Nova Thread',
  noProject: 'Selecione um projeto para ver o ambiente, os vínculos e as ações do repositório.',
  ambiente: 'Ambiente',
  thread: 'Thread',
  harness: 'Repo Harness',
  harnessRules: 'Rules',
  harnessSkills: 'Skills',
  harnessSubagents: 'SubAgents',
  linkedOne: (n: number) => `${n} vinculado`,
  linkedMany: (n: number) => `${n} vinculados`,
  activeOne: (n: number) => `${n} ativa`,
  activeMany: (n: number) => `${n} ativas`,
} as const

function pluralCount(n: number, one: (n: number) => string, many: (n: number) => string): string {
  return n === 1 ? one(n) : many(n)
}

export interface WorkspaceSidebarProps {
  project: Project | null
  selectedThread: Thread | null
  vcsStatus: VcsStatus | null
  onNewThread: () => void
  onCommit: (subject: string) => Promise<{ ok: boolean; error?: string }>
  onPush: () => Promise<{ ok: boolean; error?: string }>
}

export function WorkspaceSidebar({
  project,
  selectedThread,
  vcsStatus,
  onNewThread,
  onCommit,
  onPush,
}: Readonly<WorkspaceSidebarProps>): ReactElement {
  const [rulesCount, setRulesCount] = useState<number | null>(null)
  const [skillsCount, setSkillsCount] = useState<number | null>(null)
  const [subagentsCount, setSubagentsCount] = useState<number | null>(null)
  const [openModal, setOpenModal] = useState<'rules' | 'skills' | 'subagents' | null>(null)

  useEffect(() => {
    if (!project) {
      setRulesCount(null)
      setSkillsCount(null)
      setSubagentsCount(null)
      return
    }
    let cancelled = false

    rulesService.counts().then((res) => {
      if (!cancelled && !res.error) setRulesCount(res.activeByProject[project.id] ?? 0)
    }).catch(() => {})

    skillsService.listForProject(project.id).then((res) => {
      if (!cancelled && !res.error) setSkillsCount(res.filter((s) => s.linked).length)
    }).catch(() => {})

    subagentsService.counts().then((res) => {
      if (!cancelled && !res.error) setSubagentsCount(res.linkedByProject[project.id] ?? 0)
    }).catch(() => {})

    return () => {
      cancelled = true
    }
  }, [project])

  return (
    <div className="flex h-full flex-col gap-md overflow-y-auto rounded-xl border border-border bg-surface p-sm">
      {project ? (
        <button
          type="button"
          onClick={onNewThread}
          className="rounded-md border border-border bg-surface-2 px-sm py-xs text-[12px] font-medium hover:bg-surface"
        >
          + {COPY.newThread}
        </button>
      ) : null}

      {!project ? (
        <p className="text-[12px] text-muted">{COPY.noProject}</p>
      ) : (
        <>
          <section>
            <h3 className="mb-xs text-[11px] font-bold uppercase tracking-[0.07em] text-muted">{COPY.ambiente}</h3>
            <p className="truncate font-mono text-[11px] text-muted" title={project.path}>
              {project.path}
            </p>
            {vcsStatus?.branch ? <p className="mt-[2px] text-[11px] text-muted">branch: {vcsStatus.branch}</p> : null}
          </section>

          {selectedThread ? (
            <section>
              <h3 className="mb-xs text-[11px] font-bold uppercase tracking-[0.07em] text-muted">{COPY.thread}</h3>
              <p className="text-[11px] text-muted">
                {selectedThread.provider} · {selectedThread.accessLevel} · {selectedThread.executionMode} · {selectedThread.state}
              </p>
            </section>
          ) : null}

          <section>
            <GitActions vcsStatus={vcsStatus} selectedThread={selectedThread} onCommit={onCommit} onPush={onPush} />
          </section>

          <section>
            <h3 className="mb-xs text-[11px] font-bold uppercase tracking-[0.07em] text-muted">{COPY.harness}</h3>
            <div className="flex flex-col gap-[2px]">
              <HarnessRow
                label={COPY.harnessRules}
                meta={rulesCount === null ? '' : pluralCount(rulesCount, COPY.activeOne, COPY.activeMany)}
                onClick={() => setOpenModal('rules')}
              />
              <HarnessRow
                label={COPY.harnessSkills}
                meta={skillsCount === null ? '' : pluralCount(skillsCount, COPY.linkedOne, COPY.linkedMany)}
                onClick={() => setOpenModal('skills')}
              />
              <HarnessRow
                label={COPY.harnessSubagents}
                meta={subagentsCount === null ? '' : pluralCount(subagentsCount, COPY.linkedOne, COPY.linkedMany)}
                onClick={() => setOpenModal('subagents')}
              />
            </div>
          </section>
        </>
      )}

      {project && openModal === 'rules' ? (
        <ProjectRulesModal projectId={project.id} onClose={() => setOpenModal(null)} />
      ) : null}
      {project && openModal === 'skills' ? (
        <ProjectSkillsModal projectId={project.id} onClose={() => setOpenModal(null)} />
      ) : null}
      {project && openModal === 'subagents' ? (
        <ProjectSubagentsModal projectId={project.id} onClose={() => setOpenModal(null)} />
      ) : null}
    </div>
  )
}

function HarnessRow({ label, meta, onClick }: Readonly<{ label: string; meta: string; onClick: () => void }>): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between rounded-md px-xs py-[3px] text-left text-[12px] text-fg hover:bg-surface-2"
    >
      <span>{label}</span>
      <span className="text-[11px] text-muted">{meta}</span>
    </button>
  )
}

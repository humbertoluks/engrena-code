import { useCallback, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { Project, VcsStatus } from '../../services/projects-service'
import type { PipelineHistory, Thread } from '../../services/threads-service'
import type { SubagentRun } from '../../services/subagents-service'
import type { MemoryStatus } from '../../services/memory-service'
import type { UsageLimitStatusResponse } from '../../services/consumo-service'
import { rulesService } from '../../services/rules-service'
import { skillsService } from '../../services/skills-service'
import { subagentsService } from '../../services/subagents-service'
import { mcpsService } from '../../services/mcps-service'
import { ProjectRulesModal } from '../rules/ProjectRulesModal'
import { ProjectSkillsModal } from '../skills/ProjectSkillsModal'
import { ProjectSubagentsModal } from '../subagents/ProjectSubagentsModal'
import { ProjectMcpsModal } from '../mcps/ProjectMcpsModal'
import { ProjectMemoryModal } from '../memory/ProjectMemoryModal'
import { SubagentActivity } from '../subagents/SubagentActivity'
import { PipelinePanel } from './PipelinePanel'
import { GitActions } from './GitActions'
import { CodegraphSection } from '../codegraph/CodegraphSection'
import { FileExplorer } from './FileExplorer'
import { SidebarInfoRow, SidebarSection } from './SidebarSection'
import {
  AmbienteIcon,
  HarnessIcon,
  LimitesIcon,
  PlusIcon,
  RepoIcon,
  ThreadIcon,
} from './sidebarIcons'

const COPY = {
  newThread: 'Nova Thread',
  newThreadTitle: 'Nova thread no projeto',
  noProject: 'Selecione um projeto para ver o ambiente, os vínculos e as ações do repositório.',
  limites: 'Limites',
  limitesEmpty: 'Sem limite configurado.',
  limitesAdjust: 'Ajustar em Consumo',
  limitesFmt: (spent: number, limit: number, pct: number) =>
    `$${spent.toFixed(2)} / $${limit.toFixed(2)} · ${Math.round(pct)}%`,
  ambiente: 'Ambiente',
  ambienteProjeto: 'Projeto',
  ambientePath: 'Caminho',
  ambienteBranch: 'Branch',
  ambienteAlteracoes: 'Alterações',
  thread: 'Thread',
  threadProvider: 'Provider',
  threadAccess: 'Acesso',
  threadExecution: 'Execução',
  threadState: 'Estado',
  threadEmpty: 'Abra ou inicie uma thread para ver o detalhe.',
  repositorio: 'Repositório',
  harness: 'Repo Harness',
  harnessRules: 'Rules',
  harnessSkills: 'Skills',
  harnessSubagents: 'SubAgents',
  harnessMcps: 'MCPs',
  harnessMemory: 'Memória',
  harnessError: 'Não foi possível atualizar os vínculos.',
  linkedOne: (n: number) => `${n} vinculado`,
  linkedMany: (n: number) => `${n} vinculados`,
  activeOne: (n: number) => `${n} ativa`,
  activeMany: (n: number) => `${n} ativas`,
  memoryEntriesOne: (n: number) => `${n} entrada`,
  memoryEntriesMany: (n: number) => `${n} entradas`,
  memoryDisabled: 'desligada',
  memoryCorrupted: 'journal ilegível',
} as const

const NEW_THREAD_BTN =
  'inline-flex flex-1 items-center justify-center gap-sm rounded-full border border-border bg-surface-2 px-md py-sm text-[12px] font-semibold text-fg/80 transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50'

const HARNESS_ROW =
  'flex w-full items-center justify-between rounded-md px-sm py-[4px] text-left text-[12px] text-fg transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

// docs/F24-multi-vcs/copy.md `vcs.badge.*`
const VCS_BADGE_LABEL: Record<'github' | 'gitlab' | 'bitbucket' | 'azure', string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  azure: 'Azure DevOps',
}

/** Meta da linha Memória (F20 ui.md §A) — corrompido vence desligada, que vence a contagem. */
function memoryMeta(status: MemoryStatus | null): string {
  if (status === null) return ''
  if (status.corrupted) return COPY.memoryCorrupted
  if (!status.enabled) return COPY.memoryDisabled
  return pluralCount(status.entryCount, COPY.memoryEntriesOne, COPY.memoryEntriesMany)
}

function pluralCount(n: number, one: (n: number) => string, many: (n: number) => string): string {
  return n === 1 ? one(n) : many(n)
}

function workingTreeSummary(vcsStatus: VcsStatus | null): string {
  if (!vcsStatus?.hasGit) return '—'
  return vcsStatus.dirty ? 'com mudanças' : 'limpo'
}

export interface WorkspaceSidebarProps {
  project: Project | null
  selectedThread: Thread | null
  vcsStatus: VcsStatus | null
  memoryStatus: MemoryStatus | null
  usageLimitStatus: UsageLimitStatusResponse | null
  onMemoryChanged: () => void
  subagentRuns: SubagentRun[]
  onOpenSubagentRun: (run: SubagentRun) => void
  pipeline: PipelineHistory | null
  onAnswerPipelineCheckpoint: (input: { selectedOptions: string[]; freeText: string | null }) => void
  pipelineAnswerBusy: boolean
  pipelineAnswerError: string | null
  onCancelPipeline: () => void
  onNewThread: () => void
  onCommit: (subject: string, body?: string) => Promise<{ ok: boolean; error?: string }>
  onPush: () => Promise<{ ok: boolean; error?: string }>
  onOpenPr: (input?: { title?: string; body?: string }) => Promise<{ ok: boolean; error?: string; url?: string }>
  onTextgen: (mode: 'commit' | 'pr') => Promise<{ ok: boolean; error?: string; subject?: string; body?: string; title?: string }>
}

export function WorkspaceSidebar({
  project,
  selectedThread,
  vcsStatus,
  memoryStatus,
  usageLimitStatus,
  onMemoryChanged,
  subagentRuns,
  onOpenSubagentRun,
  pipeline,
  onAnswerPipelineCheckpoint,
  pipelineAnswerBusy,
  pipelineAnswerError,
  onCancelPipeline,
  onNewThread,
  onCommit,
  onPush,
  onOpenPr,
  onTextgen,
}: Readonly<WorkspaceSidebarProps>): ReactElement {
  const [rulesCount, setRulesCount] = useState<number | null>(null)
  const [skillsCount, setSkillsCount] = useState<number | null>(null)
  const [subagentsCount, setSubagentsCount] = useState<number | null>(null)
  const [mcpsCount, setMcpsCount] = useState<number | null>(null)
  const [harnessError, setHarnessError] = useState<string | null>(null)
  const [openModal, setOpenModal] = useState<'rules' | 'skills' | 'subagents' | 'mcps' | 'memory' | null>(null)

  const refreshHarnessCounts = useCallback((projectId: string) => {
    const onHarnessFail = (label: string, err: unknown): void => {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error(`[harness] ${label} counts failed`, err)
      setHarnessError(COPY.harnessError)
    }

    setHarnessError(null)

    rulesService
      .counts()
      .then((res) => {
        if (!res.error) setRulesCount(res.activeByProject[projectId] ?? 0)
      })
      .catch((err) => onHarnessFail('rules', err))

    skillsService
      .listForProject(projectId)
      .then((res) => {
        if (!res.error) setSkillsCount(res.filter((s) => s.linked).length)
      })
      .catch((err) => onHarnessFail('skills', err))

    subagentsService
      .counts()
      .then((res) => {
        if (!res.error) setSubagentsCount(res.linkedByProject[projectId] ?? 0)
      })
      .catch((err) => onHarnessFail('subagents', err))

    mcpsService
      .listForProject(projectId)
      .then((res) => {
        if (Array.isArray(res)) setMcpsCount(res.filter((m) => m.linked).length)
      })
      .catch((err) => onHarnessFail('mcps', err))
  }, [])

  useEffect(() => {
    if (!project) {
      setRulesCount(null)
      setSkillsCount(null)
      setSubagentsCount(null)
      setMcpsCount(null)
      setHarnessError(null)
      return
    }
    refreshHarnessCounts(project.id)
  }, [project, refreshHarnessCounts])

  const limitItem = usageLimitStatus?.items[0] ?? null

  return (
    <aside
      aria-label="Painel do workspace"
      className="flex h-full min-w-0 flex-col gap-sm overflow-y-auto rounded-xl border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-surface p-sm"
    >
      <div className="flex items-center gap-sm">
        <button
          type="button"
          onClick={onNewThread}
          disabled={!project}
          title={COPY.newThreadTitle}
          className={NEW_THREAD_BTN}
        >
          <PlusIcon />
          {COPY.newThread}
        </button>
      </div>

      <SidebarSection title={COPY.limites} icon={<LimitesIcon />} collapsible>
        {limitItem ? (
          <>
            <SidebarInfoRow label={limitItem.scope === 'global' ? 'Global' : 'Projeto'}>
              <span className="font-mono text-[11.5px]">
                {COPY.limitesFmt(limitItem.spentUsd, limitItem.limitUsd, limitItem.pct)}
              </span>
            </SidebarInfoRow>
            <a
              href="#consumo"
              className="mx-sm mb-xs rounded-md px-sm py-[4px] text-[12px] text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {COPY.limitesAdjust}
            </a>
          </>
        ) : (
          <>
            <p className="m-0 px-sm py-[4px] text-[12px] text-muted">{COPY.limitesEmpty}</p>
            <a
              href="#consumo"
              className="mx-sm mb-xs rounded-md px-sm py-[4px] text-[12px] text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {COPY.limitesAdjust}
            </a>
          </>
        )}
      </SidebarSection>

      {!project ? (
        <p className="m-0 px-sm text-xs leading-relaxed text-muted">{COPY.noProject}</p>
      ) : (
        <>
          <SubagentActivity runs={subagentRuns} onOpenRun={onOpenSubagentRun} />

          {selectedThread && pipeline ? (
            <PipelinePanel
              pipeline={pipeline}
              onAnswer={onAnswerPipelineCheckpoint}
              answerBusy={pipelineAnswerBusy}
              answerError={pipelineAnswerError}
              onCancel={onCancelPipeline}
            />
          ) : null}

          <SidebarSection title={COPY.ambiente} icon={<AmbienteIcon />} collapsible>
            <SidebarInfoRow label={COPY.ambienteProjeto} title={project.name}>
              <span className="truncate font-semibold text-fg">{project.name}</span>
            </SidebarInfoRow>
            <SidebarInfoRow label={COPY.ambientePath} title={project.path}>
              <span className="truncate font-mono text-[11px] text-muted">{project.path}</span>
            </SidebarInfoRow>
            <SidebarInfoRow label={COPY.ambienteBranch}>
              <span className="font-mono text-[11.5px]">{vcsStatus?.branch ?? '—'}</span>
            </SidebarInfoRow>
            <SidebarInfoRow label={COPY.ambienteAlteracoes} title="Linhas na working tree">
              <span className="font-mono text-[11.5px]">{workingTreeSummary(vcsStatus)}</span>
            </SidebarInfoRow>
            {vcsStatus?.kind && vcsStatus.kind !== 'unknown' ? (
              <SidebarInfoRow label="VCS">
                <span className="rounded-sm border border-border px-xs py-[1px] font-mono text-[10.5px] text-muted">
                  {VCS_BADGE_LABEL[vcsStatus.kind]}
                </span>
              </SidebarInfoRow>
            ) : null}
          </SidebarSection>

          <FileExplorer projectId={project.id} changedFiles={vcsStatus?.dirtyFiles ?? []} />

          <SidebarSection title={COPY.thread} icon={<ThreadIcon />} collapsible>
            {selectedThread ? (
              <>
                <SidebarInfoRow label={COPY.threadProvider}>
                  <span className="font-mono text-[11.5px]">{selectedThread.provider}</span>
                </SidebarInfoRow>
                <SidebarInfoRow label={COPY.threadAccess}>
                  <span className="font-mono text-[11.5px]">{selectedThread.accessLevel}</span>
                </SidebarInfoRow>
                <SidebarInfoRow label={COPY.threadExecution}>
                  <span className="font-mono text-[11.5px]">{selectedThread.executionMode}</span>
                </SidebarInfoRow>
                <SidebarInfoRow label={COPY.threadState}>
                  <span className="font-mono text-[11.5px]">{selectedThread.state}</span>
                </SidebarInfoRow>
              </>
            ) : (
              <p className="m-0 px-sm py-[4px] text-[12px] text-muted">{COPY.threadEmpty}</p>
            )}
          </SidebarSection>

          <SidebarSection title={COPY.repositorio} icon={<RepoIcon />} collapsible>
            <GitActions
              vcsStatus={vcsStatus}
              selectedThread={selectedThread}
              onCommit={onCommit}
              onPush={onPush}
              onOpenPr={onOpenPr}
              onTextgen={onTextgen}
            />
          </SidebarSection>

          <CodegraphSection projectId={project.id} />

          <SidebarSection title={COPY.harness} icon={<HarnessIcon />} collapsible defaultOpen>
            {harnessError !== null ? (
              <p role="alert" className="m-0 px-sm py-[4px] text-[11.5px] text-red">
                {harnessError}
              </p>
            ) : null}
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
              meta={
                subagentsCount === null ? '' : pluralCount(subagentsCount, COPY.linkedOne, COPY.linkedMany)
              }
              onClick={() => setOpenModal('subagents')}
            />
            <HarnessRow
              label={COPY.harnessMcps}
              meta={mcpsCount === null ? '' : pluralCount(mcpsCount, COPY.linkedOne, COPY.linkedMany)}
              onClick={() => setOpenModal('mcps')}
            />
            <HarnessRow
              label={COPY.harnessMemory}
              meta={memoryMeta(memoryStatus)}
              onClick={() => setOpenModal('memory')}
            />
          </SidebarSection>
        </>
      )}

      {project && openModal === 'rules' ? (
        <ProjectRulesModal
          projectId={project.id}
          onClose={() => {
            setOpenModal(null)
            refreshHarnessCounts(project.id)
          }}
        />
      ) : null}
      {project && openModal === 'skills' ? (
        <ProjectSkillsModal
          projectId={project.id}
          onClose={() => {
            setOpenModal(null)
            refreshHarnessCounts(project.id)
          }}
        />
      ) : null}
      {project && openModal === 'subagents' ? (
        <ProjectSubagentsModal
          projectId={project.id}
          onClose={() => {
            setOpenModal(null)
            refreshHarnessCounts(project.id)
          }}
        />
      ) : null}
      {project && openModal === 'mcps' ? (
        <ProjectMcpsModal
          projectId={project.id}
          onClose={() => {
            setOpenModal(null)
            refreshHarnessCounts(project.id)
          }}
        />
      ) : null}
      {project && openModal === 'memory' ? (
        <ProjectMemoryModal
          projectId={project.id}
          status={memoryStatus}
          onChanged={onMemoryChanged}
          onClose={() => setOpenModal(null)}
        />
      ) : null}
    </aside>
  )
}

function HarnessRow({
  label,
  meta,
  onClick,
}: Readonly<{ label: string; meta: string; onClick: () => void }>): ReactElement {
  return (
    <button type="button" onClick={onClick} className={HARNESS_ROW}>
      <span>{label}</span>
      <span className="truncate text-[11px] text-muted">{meta}</span>
    </button>
  )
}

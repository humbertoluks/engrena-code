import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { RuleFormModal } from './RuleFormModal'
import type { RuleFormSubmitResult, RuleFormValues } from './RuleFormModal'
import { formatKb, isAggregateHot } from './ruleForm.logic'
import { rulesService } from '../../services/rules-service'
import type { RuleLinkState } from '../../services/rules-service'

const ACTIVE_CAP = 15

const COPY = {
  title: 'Rules deste projeto',
  pillActive: (n: number) => `${n} ${n === 1 ? 'ativa' : 'ativas'}`,
  ctaNew: '+ Nova rule',
  ariaClose: 'Fechar',
  empty: 'Nenhuma rule ainda. Crie a primeira com “+ Nova rule”.',
  sectionGlobals: 'Globais',
  sectionGlobalsEmpty: 'Nenhuma rule global.',
  sectionProject: 'Deste projeto',
  sectionProjectEmpty: 'Nenhuma rule de projeto. Crie com “+ Nova rule” para valer só aqui.',
  toggleGlobalActive: 'ativa neste projeto',
  ariaGlobalActive: (name: string) => `Ativa ${name} neste projeto`,
  badgeSuppressed: 'suprimida aqui',
  toggleLinked: 'vinculada a este projeto',
  ariaLinked: (name: string) => `Vincular ${name} a este projeto`,
  pillOn: 'on',
  pillOff: 'off',
  pillTitleOn: 'Habilitada neste projeto',
  pillTitleOff: 'Desabilitada neste projeto',
  footerAggregate: (n: number, kb: string) => `Rules ativas neste projeto: ${n} · ${kb} por turno`,
  footerAggregateHot: (n: number, kb: string) =>
    `Rules ativas neste projeto: ${n} · ${kb} por turno — acima de 16 KB; considere enxugar (não bloqueia).`,
  warnActiveCap: (n: number) => `${n} rules ativas — acima de 15; considere enxugar (não bloqueia).`,
  errorLoad: 'Não foi possível carregar as rules do projeto.',
  errorLink: 'Não foi possível atualizar o vínculo.',
  errorEnabled: 'Não foi possível alterar o estado no projeto.',
  errorPrelink: 'Rule criada, mas não foi possível vinculá-la ao projeto.',
} as const

interface ProjectRulesModalProps {
  projectId: string
  onClose: () => void
}

function CloseIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[16px] w-[16px]" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

interface RuleLinkCardProps {
  rule: RuleLinkState
  busy: boolean
  children: React.ReactNode
}

function RuleLinkCard({ rule, busy, children }: Readonly<RuleLinkCardProps>): ReactElement {
  const active = rule.enabled && rule.activeInProject
  return (
    <div
      className={`rounded-lg border p-md ${active ? 'border-accent/50 bg-surface-2/40' : 'border-border'} ${busy ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-xs">
            <h4 className="text-[13.5px] font-semibold text-fg">{rule.name}</h4>
            {rule.suppressedHere ? (
              <span className="rounded-full border border-border px-sm py-[1px] text-[10.5px] text-muted">
                {COPY.badgeSuppressed}
              </span>
            ) : null}
          </div>
          <p className="mt-[2px] font-mono text-[11px] text-muted">{formatKb(rule.contentBytes)}</p>
          {rule.description !== null ? (
            <p className="mt-xs line-clamp-2 text-[12px] text-muted">{rule.description}</p>
          ) : null}
        </div>
        <div className="flex flex-shrink-0 items-center gap-sm">{children}</div>
      </div>
    </div>
  )
}

export function ProjectRulesModal({ projectId, onClose }: Readonly<ProjectRulesModalProps>): ReactElement {
  const [links, setLinks] = useState<RuleLinkState[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    const res = await rulesService.listForProject(projectId)
    if (res.error) {
      setLoadError(COPY.errorLoad)
      return
    }
    setLinks(res.rules)
    setLoadError(null)
  }, [projectId])

  useEffect(() => { void load() }, [load])

  const globals = useMemo(() => links?.filter((r) => r.isGlobal) ?? [], [links])
  const projectOnly = useMemo(() => links?.filter((r) => !r.isGlobal) ?? [], [links])

  const activeRules = useMemo(() => links?.filter((r) => r.enabled && r.activeInProject) ?? [], [links])
  const activeCount = activeRules.length
  const aggregateBytes = activeRules.reduce((sum, r) => sum + r.contentBytes, 0)
  const hot = isAggregateHot(aggregateBytes)
  const overCap = activeCount > ACTIVE_CAP

  const runAction = useCallback(async (id: string, action: () => Promise<{ error?: { code: string; message: string } }>, errorCopy: string): Promise<void> => {
    setBusyId(id)
    setActionError(null)
    const res = await action()
    if (res.error) setActionError(errorCopy)
    await load()
    setBusyId(null)
  }, [load])

  const handleToggleGlobalActive = useCallback((rule: RuleLinkState): void => {
    const nextActive = rule.suppressedHere
    void runAction(rule.id, () => rulesService.setProjectLink(projectId, rule.id, { enabled: nextActive }), COPY.errorEnabled)
  }, [projectId, runAction])

  const handleToggleLinked = useCallback((rule: RuleLinkState): void => {
    if (rule.linked) {
      void runAction(rule.id, () => rulesService.unlinkFromProject(projectId, rule.id), COPY.errorLink)
    } else {
      void runAction(rule.id, () => rulesService.setProjectLink(projectId, rule.id, { enabled: true }), COPY.errorLink)
    }
  }, [projectId, runAction])

  const handleToggleEnabledInProject = useCallback((rule: RuleLinkState): void => {
    void runAction(rule.id, () => rulesService.setProjectLink(projectId, rule.id, { enabled: !rule.enabledInProject }), COPY.errorEnabled)
  }, [projectId, runAction])

  const handleCreateSubmit = useCallback(async (values: RuleFormValues): Promise<RuleFormSubmitResult> => {
    const created = await rulesService.create(values)
    if (created.error) return { ok: false, code: created.error.code }

    setFormOpen(false)

    if (!values.isGlobal) {
      const linked = await rulesService.setProjectLink(projectId, created.rule.id, { enabled: true })
      if (linked.error) setActionError(COPY.errorPrelink)
    }

    await load()
    return { ok: true }
  }, [projectId, load])

  return (
    <div className="fixed inset-0 z-50 flex place-items-center justify-center bg-black/50 p-lg">
      <div className="flex max-h-[86vh] w-full max-w-[880px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-lg shadow-lg">
        <div className="flex items-center justify-between gap-md">
          <div className="flex items-center gap-sm">
            <h2 className="font-display text-[17px] font-semibold text-fg">{COPY.title}</h2>
            <span className="rounded-full border border-border bg-surface-2 px-sm py-[1px] font-mono text-[11px] text-muted">
              {COPY.pillActive(activeCount)}
            </span>
          </div>
          <div className="flex items-center gap-sm">
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-sm border border-border bg-surface-2 px-sm py-[5px] text-[12.5px] font-medium text-fg hover:bg-surface"
            >
              {COPY.ctaNew}
            </button>
            <button type="button" onClick={onClose} aria-label={COPY.ariaClose} className="text-muted hover:text-fg">
              <CloseIcon />
            </button>
          </div>
        </div>

        {loadError !== null ? <p role="alert" className="mt-md text-[12.5px] text-red">{loadError}</p> : null}
        {actionError !== null ? <p role="alert" className="mt-md text-[12.5px] text-red">{actionError}</p> : null}

        {links !== null && links.length === 0 ? (
          <p className="mt-lg text-[13px] text-muted">{COPY.empty}</p>
        ) : (
          <div className="mt-lg flex flex-col gap-lg">
            <div>
              <h3 className="mb-sm text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">{COPY.sectionGlobals}</h3>
              {globals.length === 0 ? (
                <p className="text-[12.5px] text-muted">{COPY.sectionGlobalsEmpty}</p>
              ) : (
                <div className="grid grid-cols-1 gap-sm md:grid-cols-2">
                  {globals.map((rule) => (
                    <RuleLinkCard key={rule.id} rule={rule} busy={busyId === rule.id}>
                      <label className="flex items-center gap-xs text-[11.5px] text-muted">
                        <input
                          type="checkbox"
                          checked={!rule.suppressedHere}
                          disabled={busyId === rule.id || !rule.enabled}
                          aria-label={COPY.ariaGlobalActive(rule.name)}
                          onChange={() => handleToggleGlobalActive(rule)}
                        />
                        {COPY.toggleGlobalActive}
                      </label>
                    </RuleLinkCard>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-sm text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">{COPY.sectionProject}</h3>
              {projectOnly.length === 0 ? (
                <p className="text-[12.5px] text-muted">{COPY.sectionProjectEmpty}</p>
              ) : (
                <div className="grid grid-cols-1 gap-sm md:grid-cols-2">
                  {projectOnly.map((rule) => (
                    <RuleLinkCard key={rule.id} rule={rule} busy={busyId === rule.id}>
                      <label className="flex items-center gap-xs text-[11.5px] text-muted">
                        <input
                          type="checkbox"
                          checked={rule.linked}
                          disabled={busyId === rule.id}
                          aria-label={COPY.ariaLinked(rule.name)}
                          onChange={() => handleToggleLinked(rule)}
                        />
                        {COPY.toggleLinked}
                      </label>
                      {rule.linked ? (
                        <button
                          type="button"
                          disabled={busyId === rule.id}
                          title={rule.enabledInProject === true ? COPY.pillTitleOn : COPY.pillTitleOff}
                          onClick={() => handleToggleEnabledInProject(rule)}
                          className={`rounded-full border px-sm py-[1px] text-[10.5px] font-mono ${
                            rule.enabledInProject === true ? 'border-accent/50 text-accent' : 'border-border text-muted'
                          }`}
                        >
                          {rule.enabledInProject === true ? COPY.pillOn : COPY.pillOff}
                        </button>
                      ) : null}
                    </RuleLinkCard>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-lg border-t border-border pt-md">
          <p className={`font-mono text-[11.5px] ${hot ? 'text-amber' : 'text-muted'}`}>
            {hot ? COPY.footerAggregateHot(activeCount, formatKb(aggregateBytes)) : COPY.footerAggregate(activeCount, formatKb(aggregateBytes))}
          </p>
          {overCap ? <p className="mt-xs text-[11.5px] text-amber">{COPY.warnActiveCap(activeCount)}</p> : null}
        </div>
      </div>

      {formOpen ? (
        <RuleFormModal mode="new" initial={null} onCancel={() => setFormOpen(false)} onSubmit={handleCreateSubmit} />
      ) : null}
    </div>
  )
}

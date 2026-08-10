import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { skillsService, type SkillLinkState } from '../../services/skills-service'

const COPY = {
  title: 'Skills deste projeto',
  empty: 'Nenhuma skill global. Crie no menu Skills.',
  emptyFiltered: 'Nada corresponde aos filtros.',
  toggle: 'Ativo neste projeto',
  ariaToggle: (name: string) => `Ativar ${name} neste projeto`,
  pillOn: 'on',
  pillOff: 'off',
  pillTitleOn: 'Habilitada neste projeto',
  pillTitleOff: 'Desabilitada neste projeto',
  moveUp: (name: string) => `Subir ${name}`,
  moveDown: (name: string) => `Descer ${name}`,
  errorLoad: 'Não foi possível carregar as skills do projeto.',
  errorLink: 'Não foi possível atualizar o vínculo.',
  errorEnabled: 'Não foi possível alterar o estado no projeto.',
  errorReorder: 'Não foi possível reordenar.',
  warnCap: 'Mais de 30 skills vinculadas neste projeto — considere enxugar (não bloqueia).',
} as const

const CAP_WARNING_THRESHOLD = 30

function sortLinks(links: SkillLinkState[]): SkillLinkState[] {
  return [...links].sort((a, b) => {
    if (a.linked !== b.linked) return a.linked ? -1 : 1
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })
}

interface ProjectSkillsModalProps {
  projectId: string
  onClose: () => void
}

export function ProjectSkillsModal({ projectId, onClose }: Readonly<ProjectSkillsModalProps>): ReactElement {
  const [links, setLinks] = useState<SkillLinkState[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await skillsService.listForProject(projectId)
      if (!mountedRef.current) return
      if (!Array.isArray(res)) {
        setLoadError(COPY.errorLoad)
        return
      }
      setLinks(res)
      setLoadError(null)
    } catch {
      if (mountedRef.current) setLoadError(COPY.errorLoad)
    }
  }, [projectId])

  useEffect(() => { void load() }, [load])

  const sorted = useMemo(() => sortLinks(links), [links])
  const linkedCount = useMemo(() => links.filter((l) => l.linked).length, [links])

  const handleToggleLinked = useCallback(async (link: SkillLinkState): Promise<void> => {
    setBusyId(link.id)
    setActionError(null)
    try {
      const res = link.linked
        ? await skillsService.unlinkSkill(projectId, link.id)
        : await skillsService.linkSkill(projectId, link.id, { enabled: true, sortOrder: links.length })
      if (!mountedRef.current) return
      if (res.error) {
        setActionError(COPY.errorLink)
        return
      }
      await load()
    } catch {
      if (mountedRef.current) setActionError(COPY.errorLink)
    } finally {
      if (mountedRef.current) setBusyId(null)
    }
  }, [projectId, links.length, load])

  const handleToggleEnabled = useCallback(async (link: SkillLinkState): Promise<void> => {
    setBusyId(link.id)
    setActionError(null)
    try {
      const res = await skillsService.linkSkill(projectId, link.id, {
        enabled: !(link.enabledInProject ?? false),
      })
      if (!mountedRef.current) return
      if (res.error) {
        setActionError(COPY.errorEnabled)
        return
      }
      await load()
    } catch {
      if (mountedRef.current) setActionError(COPY.errorEnabled)
    } finally {
      if (mountedRef.current) setBusyId(null)
    }
  }, [projectId, load])

  const handleReorder = useCallback(async (link: SkillLinkState, direction: -1 | 1): Promise<void> => {
    const linkedSorted = sorted.filter((l) => l.linked)
    const idx = linkedSorted.findIndex((l) => l.id === link.id)
    const swapIdx = idx + direction
    if (idx === -1 || swapIdx < 0 || swapIdx >= linkedSorted.length) return

    const a = linkedSorted[idx]
    const b = linkedSorted[swapIdx]
    setBusyId(a.id)
    setActionError(null)
    try {
      await Promise.all([
        skillsService.linkSkill(projectId, a.id, { sortOrder: b.sortOrder ?? 0 }),
        skillsService.linkSkill(projectId, b.id, { sortOrder: a.sortOrder ?? 0 }),
      ])
      if (mountedRef.current) await load()
    } catch {
      if (mountedRef.current) setActionError(COPY.errorReorder)
    } finally {
      if (mountedRef.current) setBusyId(null)
    }
  }, [projectId, sorted, load])

  return (
    <div className="fixed inset-0 z-50 flex place-items-center justify-center bg-black/50 px-md">
      <div className="flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-lg shadow-lg">
        <div className="mb-md flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-fg">{COPY.title}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-fg" aria-label="Fechar">
            ✕
          </button>
        </div>

        {loadError !== null ? (
          <p role="alert" className="text-[12.5px] text-red">{loadError}</p>
        ) : null}

        {actionError !== null ? (
          <p role="alert" className="mb-sm text-[12.5px] text-red">{actionError}</p>
        ) : null}

        {linkedCount > CAP_WARNING_THRESHOLD ? (
          <p className="mb-sm text-[12.5px] text-amber">{COPY.warnCap}</p>
        ) : null}

        {sorted.length === 0 ? (
          <p className="text-[13px] text-muted">{COPY.empty}</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {sorted.map((link) => (
              <div
                key={link.id}
                className={`flex items-center justify-between rounded-md border p-md ${
                  link.linked ? 'border-accent/50' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-sm">
                  <input
                    type="checkbox"
                    checked={link.linked}
                    disabled={busyId === link.id}
                    onChange={() => { void handleToggleLinked(link) }}
                    aria-label={COPY.ariaToggle(link.name)}
                  />
                  <span className="text-[13.5px] font-medium text-fg">{link.name}</span>
                </div>

                {link.linked ? (
                  <div className="flex items-center gap-sm">
                    <button
                      type="button"
                      onClick={() => { void handleReorder(link, -1) }}
                      disabled={busyId === link.id}
                      title={COPY.moveUp(link.name)}
                      aria-label={COPY.moveUp(link.name)}
                      className="text-muted hover:text-fg disabled:opacity-50"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => { void handleReorder(link, 1) }}
                      disabled={busyId === link.id}
                      title={COPY.moveDown(link.name)}
                      aria-label={COPY.moveDown(link.name)}
                      className="text-muted hover:text-fg disabled:opacity-50"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => { void handleToggleEnabled(link) }}
                      disabled={busyId === link.id}
                      title={link.enabledInProject ? COPY.pillTitleOn : COPY.pillTitleOff}
                      className={`rounded-full border px-sm text-[11px] ${
                        link.enabledInProject
                          ? 'border-green/50 text-green'
                          : 'border-border text-muted'
                      }`}
                    >
                      {link.enabledInProject ? COPY.pillOn : COPY.pillOff}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

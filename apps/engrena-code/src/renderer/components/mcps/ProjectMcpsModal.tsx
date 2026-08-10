import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { mcpsService, type McpLinkState } from '../../services/mcps-service'

const COPY = {
  title: 'MCPs deste projeto',
  empty: 'Nenhum MCP global. Crie no menu MCPs.',
  emptyFiltered: 'Nada corresponde aos filtros.',
  note: 'As mudanças valem no próximo turno — um turno em andamento mantém o snapshot de MCPs de quando começou. No Codex, integrações MCP exigem Full access explícito; não há bypass ou desativação automática do sandbox.',
  badgeNeedsCredential: 'requer credencial',
  toggle: 'Ativo neste projeto',
  ariaToggle: (name: string) => `Ativar ${name} neste projeto`,
  pillOn: 'on',
  pillOff: 'off',
  pillTitleOn: 'Habilitada neste projeto',
  pillTitleOff: 'Desabilitada neste projeto',
  moveUp: (name: string) => `Subir ${name}`,
  moveDown: (name: string) => `Descer ${name}`,
  countOne: (n: number) => `${n} vinculado`,
  countMany: (n: number) => `${n} vinculados`,
  errorLoad: 'Não foi possível carregar os MCPs do projeto.',
  errorLink: 'Não foi possível atualizar o vínculo.',
  errorEnabled: 'Não foi possível alterar o estado no projeto.',
  errorReorder: 'Não foi possível reordenar.',
  ariaClose: 'Fechar',
} as const

function sortLinks(links: McpLinkState[]): McpLinkState[] {
  return [...links].sort((a, b) => {
    if (a.linked !== b.linked) return a.linked ? -1 : 1
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })
}

export interface ProjectMcpsModalProps {
  projectId: string
  onClose: () => void
}

export function ProjectMcpsModal({ projectId, onClose }: Readonly<ProjectMcpsModalProps>): ReactElement {
  const [links, setLinks] = useState<McpLinkState[]>([])
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
      const res = await mcpsService.listForProject(projectId)
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

  const handleToggleLinked = useCallback(async (link: McpLinkState): Promise<void> => {
    setBusyId(link.id)
    setActionError(null)
    try {
      const res = link.linked
        ? await mcpsService.unlinkMcp(projectId, link.id)
        : await mcpsService.linkMcp(projectId, link.id, { enabled: true, sortOrder: links.length })
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

  const handleToggleEnabled = useCallback(async (link: McpLinkState): Promise<void> => {
    setBusyId(link.id)
    setActionError(null)
    try {
      const res = await mcpsService.linkMcp(projectId, link.id, { enabled: !link.enabledInProject })
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

  const handleReorder = useCallback(async (link: McpLinkState, direction: -1 | 1): Promise<void> => {
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
        mcpsService.linkMcp(projectId, a.id, { sortOrder: b.sortOrder ?? 0 }),
        mcpsService.linkMcp(projectId, b.id, { sortOrder: a.sortOrder ?? 0 }),
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
      <div className="flex max-h-[86vh] w-full max-w-[880px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-lg shadow-lg">
        <div className="mb-md flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <h2 className="text-[17px] font-semibold text-fg">{COPY.title}</h2>
            <span className="rounded-full border border-border px-sm text-[11px] text-muted">
              {linkedCount === 1 ? COPY.countOne(linkedCount) : COPY.countMany(linkedCount)}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-fg" aria-label={COPY.ariaClose}>
            ✕
          </button>
        </div>

        <p className="mb-md rounded-sm border border-border bg-surface-2/40 p-sm text-[11.5px] text-muted">{COPY.note}</p>

        {loadError !== null ? <p role="alert" className="text-[12.5px] text-red">{loadError}</p> : null}
        {actionError !== null ? <p role="alert" className="mb-sm text-[12.5px] text-red">{actionError}</p> : null}

        {sorted.length === 0 ? (
          <p className="text-[13px] text-muted">{COPY.empty}</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {sorted.map((link) => (
              <div
                key={link.id}
                className={`flex items-center justify-between rounded-md border p-md ${link.linked ? 'border-accent/50' : 'border-border'}`}
              >
                <div className="flex items-center gap-sm">
                  <input
                    type="checkbox"
                    checked={link.linked}
                    disabled={busyId === link.id}
                    onChange={() => { void handleToggleLinked(link) }}
                    aria-label={COPY.ariaToggle(link.name)}
                  />
                  <div className="flex flex-col">
                    <span className="text-[13.5px] font-medium text-fg">{link.name}</span>
                    <span className="font-mono text-[11px] text-muted">
                      {link.transport}{link.url ? ` · ${link.url}` : ''}
                    </span>
                  </div>
                  {link.needsCredential ? (
                    <span className="rounded-full border border-amber/60 px-sm text-[11px] text-amber">
                      {COPY.badgeNeedsCredential}
                    </span>
                  ) : null}
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
                      className={`rounded-full border px-sm text-[11px] ${link.enabledInProject ? 'border-green/50 text-green' : 'border-border text-muted'}`}
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

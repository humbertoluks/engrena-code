import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import type { SubagentLinkState } from '../../../services/db/repositories/subagents.js'
import { subagentsService } from '../../services/subagents-service.js'
import { t } from './copy.js'
import { exceedsSoftCap, filterLinkStates, reorderLinkedItems } from './projectSubagentsModal.logic.js'

export interface ProjectSubagentsModalProps {
  projectId: string
  onClose: () => void
}

function modelMeta(s: SubagentLinkState): string {
  if (s.provider === 'inherit') return t('subagentsLink.meta.inherit')
  return s.model ? `${s.provider} · ${s.model}` : s.provider
}

interface LinkCardProps {
  state: SubagentLinkState
  busy: boolean
  onToggleLinked: () => void
  onToggleEnabled: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}

function LinkCard({
  state,
  busy,
  onToggleLinked,
  onToggleEnabled,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: Readonly<LinkCardProps>): ReactElement {
  return (
    <div
      className={`rounded-lg border p-md ${state.linked ? 'border-accent/50' : 'border-border'}`}
    >
      <div className="flex items-center justify-between gap-sm">
        <label className="flex items-center gap-sm text-sm text-fg">
          <input type="checkbox" checked={state.linked} disabled={busy} onChange={onToggleLinked} />
          {state.name}
        </label>
        {state.linked ? (
          <div className="flex items-center gap-xs">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={busy || !canMoveUp}
              aria-label={t('subagentsLink.move.up', { name: state.name })}
              className="text-muted hover:text-fg disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={busy || !canMoveDown}
              aria-label={t('subagentsLink.move.down', { name: state.name })}
              className="text-muted hover:text-fg disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={onToggleEnabled}
              disabled={busy}
              title={state.enabledInProject ? t('subagentsLink.pill.title.on') : t('subagentsLink.pill.title.off')}
              aria-label={t('subagentsLink.aria.toggle', { name: state.name })}
              className={`rounded-full px-sm text-[11px] font-mono ${
                state.enabledInProject ? 'bg-green/20 text-green' : 'bg-surface-2 text-muted'
              }`}
            >
              {state.enabledInProject ? t('subagentsLink.pill.on') : t('subagentsLink.pill.off')}
            </button>
          </div>
        ) : null}
      </div>
      <p className="mt-xs line-clamp-2 text-[12px] text-muted">{state.description}</p>
      <p className="mt-xs font-mono text-[11px] text-muted">{modelMeta(state)}</p>
    </div>
  )
}

export function ProjectSubagentsModal({ projectId, onClose }: Readonly<ProjectSubagentsModalProps>): ReactElement {
  const [states, setStates] = useState<SubagentLinkState[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryTab, setCategoryTab] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      const data = await subagentsService.listProjectLinks(projectId)
      setStates(data)
      setLoadError(null)
    } catch {
      setLoadError(t('subagentsLink.error.load'))
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const linkedCount = useMemo(() => (states ?? []).filter((s) => s.linked).length, [states])
  const filtered = useMemo(() => filterLinkStates(states ?? [], search, categoryTab), [states, search, categoryTab])
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const s of states ?? []) {
      if (s.category) set.add(s.category)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [states])

  const handleToggleLinked = useCallback(
    async (state: SubagentLinkState): Promise<void> => {
      setBusyId(state.id)
      setActionError(null)
      try {
        if (state.linked) {
          await subagentsService.unlink(projectId, state.id)
        } else {
          await subagentsService.upsertLink(projectId, state.id, { enabled: true })
        }
        await load()
      } catch {
        setActionError(t('subagentsLink.error.link'))
      } finally {
        setBusyId(null)
      }
    },
    [projectId, load]
  )

  const handleToggleEnabled = useCallback(
    async (state: SubagentLinkState): Promise<void> => {
      setBusyId(state.id)
      setActionError(null)
      try {
        await subagentsService.upsertLink(projectId, state.id, { enabled: !state.enabledInProject })
        await load()
      } catch {
        setActionError(t('subagentsLink.error.enabled'))
      } finally {
        setBusyId(null)
      }
    },
    [projectId, load]
  )

  const handleReorder = useCallback(
    async (id: string, direction: 'up' | 'down'): Promise<void> => {
      if (!states) return
      const linked = states.filter((s) => s.linked)
      const items = reorderLinkedItems(linked, id, direction)
      setBusyId(id)
      setActionError(null)
      try {
        await subagentsService.setCatalogOrder(projectId, items)
        await load()
      } catch {
        setActionError(t('subagentsLink.error.reorder'))
      } finally {
        setBusyId(null)
      }
    },
    [states, projectId, load]
  )

  const linkedSorted = useMemo(
    () => (states ?? []).filter((s) => s.linked).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [states]
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-lg"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('subagentsLink.title')}
        className="flex max-h-[88vh] w-full max-w-[640px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-lg shadow-lg"
      >
        <div className="mb-md flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-fg">{t('subagentsLink.title')}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-fg" aria-label={t('subagentsRun.audit.close')}>
            ×
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('subagents.search.placeholder')}
          className="mb-md h-[38px] rounded-md border border-border bg-surface-2 px-md text-sm text-fg focus:border-accent focus:outline-none"
        />

        {categories.length > 0 ? (
          <div className="mb-md flex items-center gap-md border-b border-border">
            <button
              type="button"
              onClick={() => setCategoryTab('')}
              className={`border-b-2 px-xs pb-xs text-[13px] ${
                categoryTab === '' ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
              }`}
            >
              {t('subagents.tab.all')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryTab(cat)}
                className={`border-b-2 px-xs pb-xs text-[13px] ${
                  categoryTab === cat ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        ) : null}

        {exceedsSoftCap(linkedCount) ? (
          <p className="mb-md text-[12px] text-amber">{t('subagentsLink.warn.cap', { N: linkedCount })}</p>
        ) : null}

        {loadError !== null ? (
          <p role="alert" className="mb-md text-sm text-red">
            {loadError}
          </p>
        ) : null}
        {actionError !== null ? (
          <p role="alert" className="mb-md text-sm text-red">
            {actionError}
          </p>
        ) : null}

        {states === null ? null : filtered.length === 0 ? (
          <p className="py-lg text-center text-[13px] text-muted">
            {states.length === 0 ? t('subagentsLink.empty') : t('subagentsLink.empty.filtered')}
          </p>
        ) : (
          <div className="flex flex-col gap-sm">
            {filtered.map((s) => {
              const idx = linkedSorted.findIndex((x) => x.id === s.id)
              return (
                <LinkCard
                  key={s.id}
                  state={s}
                  busy={busyId === s.id}
                  onToggleLinked={() => {
                    void handleToggleLinked(s)
                  }}
                  onToggleEnabled={() => {
                    void handleToggleEnabled(s)
                  }}
                  onMoveUp={() => {
                    void handleReorder(s.id, 'up')
                  }}
                  onMoveDown={() => {
                    void handleReorder(s.id, 'down')
                  }}
                  canMoveUp={idx > 0}
                  canMoveDown={idx >= 0 && idx < linkedSorted.length - 1}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

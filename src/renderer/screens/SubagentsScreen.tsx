import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { ButtonPrimary } from '../components/ButtonPrimary'
import { SubagentFormModal, type SubmitResult } from '../components/subagents/SubagentFormModal'
import { t } from '../components/subagents/copy'
import { subagentsService, type Subagent, type SubagentInput } from '../services/subagents-service'

// ── Helpers ──────────────────────────────────────────────────────────────────

function modelLabel(s: Subagent): string {
  if (s.model) return s.model
  return s.provider === 'inherit' ? t('subagents.card.model.inherit') : t('subagents.card.model.default')
}

function reasoningLabel(s: Subagent): string {
  if (s.reasoningLevel) return t('subagents.card.meta.reasoning', { level: s.reasoningLevel })
  return s.provider === 'inherit'
    ? t('subagents.card.meta.reasoning.inherit')
    : t('subagents.card.meta.reasoning.default')
}

function providerLabel(s: Subagent): string {
  switch (s.provider) {
    case 'claude':
      return t('subagents.provider.claude')
    case 'codex':
      return t('subagents.provider.codex')
    case 'kimi':
      return t('subagents.provider.kimi')
    default:
      return t('subagents.provider.inherit')
  }
}

function matchesSearch(s: Subagent, query: string): boolean {
  if (query.trim() === '') return true
  const needle = query.trim().toLowerCase()
  return s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle)
}

const MAX_TOOL_CHIPS = 4

// ── Card ─────────────────────────────────────────────────────────────────────

interface SubagentCardProps {
  subagent: Subagent
  pendingDelete: boolean
  busy: boolean
  onToggleEnabled: () => void
  onEdit: () => void
  onDeleteRequest: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}

function SubagentCard({
  subagent,
  pendingDelete,
  busy,
  onToggleEnabled,
  onEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: Readonly<SubagentCardProps>): ReactElement {
  const toolsChips =
    subagent.tools === null
      ? [t('subagents.card.tools.all')]
      : subagent.tools.length === 0
        ? [t('subagents.card.tools.none')]
        : subagent.tools.slice(0, MAX_TOOL_CHIPS)
  const extraTools =
    subagent.tools !== null && subagent.tools.length > MAX_TOOL_CHIPS ? subagent.tools.length - MAX_TOOL_CHIPS : 0

  return (
    <div className={`rounded-lg border border-border bg-surface p-lg ${subagent.enabled ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-sm">
        <div className="flex flex-wrap items-center gap-xs">
          <h3 className="text-[15px] font-semibold text-fg">{subagent.name}</h3>
          <span className="rounded-md bg-accent px-sm text-[11px] font-semibold text-bg">{providerLabel(subagent)}</span>
          {!subagent.enabled ? (
            <span className="rounded-full border border-border px-sm text-[11px] text-muted">
              {t('subagents.card.badge.disabled')}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-xs">
          <button
            type="button"
            onClick={onToggleEnabled}
            disabled={busy}
            title={subagent.enabled ? t('subagents.card.action.disable') : t('subagents.card.action.enable')}
            className="text-[12px] text-muted hover:text-fg disabled:opacity-50"
          >
            {subagent.enabled ? t('subagents.card.action.disable') : t('subagents.card.action.enable')}
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            title={t('subagents.card.action.edit')}
            className="text-[12px] text-muted hover:text-fg disabled:opacity-50"
          >
            {t('subagents.card.action.edit')}
          </button>
          {pendingDelete ? (
            <span className="flex items-center gap-xs">
              <button type="button" onClick={onDeleteConfirm} className="text-[12px] font-medium text-red">
                {t('subagents.card.action.delete.confirm')}
              </button>
              <button type="button" onClick={onDeleteCancel} className="text-[12px] text-muted hover:text-fg">
                {t('subagents.card.action.delete.cancel')}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={onDeleteRequest}
              disabled={busy}
              title={t('subagents.card.action.delete')}
              className="text-[12px] text-muted hover:text-red disabled:opacity-50"
            >
              {t('subagents.card.action.delete')}
            </button>
          )}
        </div>
      </div>

      <p className="mt-xs font-mono text-[11.5px] text-muted">{modelLabel(subagent)}</p>
      <p className="mt-sm line-clamp-3 text-[12.5px] text-muted">{subagent.description}</p>

      <div className="mt-sm flex flex-wrap gap-xs">
        {toolsChips.map((chip) => (
          <span key={chip} className="rounded-md bg-surface-2 px-sm text-[11px] text-fg">
            {chip}
          </span>
        ))}
        {extraTools > 0 ? <span className="rounded-md bg-surface-2 px-sm text-[11px] text-muted">+{extraTools}</span> : null}
      </div>

      <div className="mt-sm flex items-center gap-sm text-[11px] text-muted">
        <span>{reasoningLabel(subagent)}</span>
        {subagent.category ? (
          <>
            <span>·</span>
            <span>{subagent.category}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────

export function SubagentsScreen(): ReactElement {
  const [subagents, setSubagents] = useState<Subagent[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [categoryTab, setCategoryTab] = useState('')
  const [modal, setModal] = useState<{ mode: 'new' } | { mode: 'edit'; subagent: Subagent } | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await subagentsService.list()
      if (!mountedRef.current) return
      if (res.error) {
        setLoadError(t('subagents.error.load'))
        return
      }
      setSubagents(res.subagents)
      setLoadError(null)
    } catch {
      if (mountedRef.current) setLoadError(t('subagents.error.load'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const s of subagents ?? []) {
      if (s.category) set.add(s.category)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [subagents])

  const models = useMemo(() => {
    const set = new Set<string>()
    for (const s of subagents ?? []) {
      if (s.model) set.add(s.model)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [subagents])

  const filtered = useMemo(() => {
    return (subagents ?? []).filter((s) => {
      if (!matchesSearch(s, search)) return false
      if (modelFilter !== '' && s.model !== modelFilter) return false
      if (categoryTab !== '' && s.category !== categoryTab) return false
      return true
    })
  }, [subagents, search, modelFilter, categoryTab])

  const handleSubmit = useCallback(
    async (payload: SubagentInput): Promise<SubmitResult> => {
      const isEdit = modal?.mode === 'edit'
      const res = isEdit
        ? await subagentsService.update(modal.subagent.id, payload)
        : await subagentsService.create(payload)
      if (res.error) {
        if (res.error.code === 'subagent_name_conflict') {
          return { ok: false, message: t('subagentsForm.error.nameConflict') }
        }
        if (res.error.code === 'too_long') {
          return { ok: false, message: t('subagentsForm.error.promptOver') }
        }
        return { ok: false, message: res.error.message || t('subagentsForm.error.generic') }
      }
      setModal(null)
      await load()
      return { ok: true }
    },
    [modal, load]
  )

  const handleToggleEnabled = useCallback(
    async (s: Subagent): Promise<void> => {
      setBusyId(s.id)
      setActionError(null)
      const previous = subagents
      setSubagents((prev) => (prev ? prev.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)) : prev))
      const res = await subagentsService.update(s.id, { enabled: !s.enabled })
      setBusyId(null)
      if (res.error) {
        setSubagents(previous ?? null)
        setActionError(t('subagents.error.update'))
      }
    },
    [subagents]
  )

  const handleDeleteConfirm = useCallback(
    async (id: string): Promise<void> => {
      setBusyId(id)
      setPendingDeleteId(null)
      setActionError(null)
      const res = await subagentsService.remove(id)
      setBusyId(null)
      if (res.error) {
        setActionError(t('subagents.error.delete'))
        return
      }
      await load()
    },
    [load]
  )

  if (loadError !== null && subagents === null) {
    return (
      <section id="subagents" className="mx-auto w-full max-w-[1180px] px-lg py-lg">
        <p role="alert" className="text-sm text-red">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => {
            void load()
          }}
          className="mt-sm text-sm text-accent underline"
        >
          Tentar novamente
        </button>
      </section>
    )
  }

  const isFiltered = search.trim() !== '' || modelFilter !== '' || categoryTab !== ''

  return (
    <section id="subagents" className="mx-auto w-full max-w-[1180px] px-lg py-lg">
      <div className="flex items-start justify-between gap-md">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-fg">{t('subagents.title')}</h1>
          <p className="mt-xs text-[13px] text-muted">{t('subagents.subtitle')}</p>
        </div>
        <ButtonPrimary onClick={() => setModal({ mode: 'new' })}>{t('subagents.cta.new')}</ButtonPrimary>
      </div>

      <div className="mt-md flex flex-wrap items-center gap-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('subagents.search.placeholder')}
          className="h-[42px] w-full max-w-[320px] rounded-md border border-border bg-surface px-md text-sm text-fg focus:border-accent focus:outline-none"
        />
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="h-[42px] rounded-md border border-border bg-surface px-md text-sm text-fg"
        >
          <option value="">{t('subagents.filter.model.all')}</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {categories.length > 0 ? (
        <div className="mt-md flex items-center gap-md border-b border-border">
          <button
            type="button"
            onClick={() => setCategoryTab('')}
            className={`border-b-2 px-xs pb-xs text-[13px] ${
              categoryTab === '' ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {t('subagents.tab.all')} <span className="text-accent">{subagents?.length ?? 0}</span>
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
              {cat} <span className="text-accent">{subagents?.filter((s) => s.category === cat).length ?? 0}</span>
            </button>
          ))}
        </div>
      ) : null}

      {actionError !== null ? (
        <p role="alert" className="mt-md text-sm text-red">
          {actionError}
        </p>
      ) : null}

      {subagents === null ? null : filtered.length === 0 ? (
        <p className="mt-xl text-center text-[13px] text-muted">
          {isFiltered ? t('subagents.empty.filtered') : t('subagents.empty.none')}
        </p>
      ) : (
        <div className="mt-lg grid grid-cols-1 gap-md lg:grid-cols-2">
          {filtered.map((s) => (
            <SubagentCard
              key={s.id}
              subagent={s}
              pendingDelete={pendingDeleteId === s.id}
              busy={busyId === s.id}
              onToggleEnabled={() => {
                void handleToggleEnabled(s)
              }}
              onEdit={() => setModal({ mode: 'edit', subagent: s })}
              onDeleteRequest={() => setPendingDeleteId(s.id)}
              onDeleteConfirm={() => {
                void handleDeleteConfirm(s.id)
              }}
              onDeleteCancel={() => setPendingDeleteId(null)}
            />
          ))}
        </div>
      )}

      {modal !== null ? (
        <SubagentFormModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.subagent : undefined}
          onCancel={() => setModal(null)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </section>
  )
}

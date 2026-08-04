import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { ButtonPrimary } from '../components/ButtonPrimary'
import { RuleFormModal } from '../components/rules/RuleFormModal'
import type { RuleFormSubmitResult, RuleFormValues } from '../components/rules/RuleFormModal'
import { formatContentSize } from '../components/rules/ruleForm.logic'
import { rulesService } from '../services/rules-service'
import type { Rule } from '../services/rules-service'

const COPY = {
  title: 'Rules',
  subtitle:
    'Instruções permanentes injetadas em todo turno. As globais valem para todos os projetos; as demais, só onde forem vinculadas na tela principal.',
  ctaNew: '+ Nova rule',
  searchPlaceholder: 'Buscar por nome ou descrição…',
  tabAll: 'Todas',
  emptyNone: 'Nenhuma rule ainda. Crie a primeira com “+ Nova rule”.',
  emptyFiltered: 'Nenhuma rule corresponde aos filtros.',
  badgeGlobal: 'Global',
  badgeDisabled: 'desativada',
  actionEnable: 'Ativar',
  actionDisable: 'Desativar',
  actionEdit: 'Editar',
  actionDelete: 'Excluir',
  actionDeleteConfirm: 'Excluir?',
  actionDeleteCancel: 'Não',
  errorLoad: 'Não foi possível carregar as rules.',
  errorDelete: 'Não foi possível excluir a rule.',
  errorUpdate: 'Não foi possível atualizar a rule.',
} as const

function RuleIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[16px] w-[16px] text-muted" aria-hidden="true">
      <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9 12h6M9 16h6M9 8h2" />
    </svg>
  )
}

interface RuleCardProps {
  rule: Rule
  pendingDelete: boolean
  onToggleEnabled: () => void
  onEdit: () => void
  onDeleteRequest: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}

function RuleCard({
  rule,
  pendingDelete,
  onToggleEnabled,
  onEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: Readonly<RuleCardProps>): ReactElement {
  return (
    <div className={`rounded-lg border border-border bg-surface p-lg ${rule.enabled ? '' : 'opacity-60'}`}>
      <div className="flex items-start gap-sm">
        <RuleIcon />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-xs">
            <h3 className="text-[14px] font-semibold text-fg">{rule.name}</h3>
            {rule.isGlobal ? (
              <span className="rounded-sm border border-amber/60 bg-amber/15 px-sm py-[1px] text-[10.5px] font-semibold uppercase text-amber">
                {COPY.badgeGlobal}
              </span>
            ) : null}
            {rule.category !== null ? (
              <span className="rounded-md bg-accent px-sm py-[1px] text-[11px] font-semibold text-bg">{rule.category}</span>
            ) : null}
            {!rule.enabled ? (
              <span className="rounded-full border border-border px-sm py-[1px] text-[10.5px] text-muted">{COPY.badgeDisabled}</span>
            ) : null}
          </div>
          <p className="mt-xs font-mono text-[11.5px] text-muted">{formatContentSize(rule.content)}</p>

          <div className="mt-sm flex items-center gap-md text-[12px]">
            <button type="button" onClick={onToggleEnabled} className="text-muted hover:text-fg">
              {rule.enabled ? COPY.actionDisable : COPY.actionEnable}
            </button>
            <button type="button" onClick={onEdit} className="text-muted hover:text-fg">
              {COPY.actionEdit}
            </button>
            {pendingDelete ? (
              <span className="flex items-center gap-xs">
                <button type="button" onClick={onDeleteConfirm} className="text-red hover:underline">
                  {COPY.actionDeleteConfirm}
                </button>
                <button type="button" onClick={onDeleteCancel} className="text-muted hover:text-fg">
                  {COPY.actionDeleteCancel}
                </button>
              </span>
            ) : (
              <button type="button" onClick={onDeleteRequest} className="text-muted hover:text-red">
                {COPY.actionDelete}
              </button>
            )}
          </div>

          {rule.description !== null ? (
            <p className="mt-sm line-clamp-3 text-[12.5px] text-muted">{rule.description}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function RulesScreen(): ReactElement {
  const [rules, setRules] = useState<Rule[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: 'new' } | { mode: 'edit'; rule: Rule } | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const loadRules = useCallback(async (): Promise<void> => {
    try {
      const res = await rulesService.list()
      if (!mountedRef.current) return
      if (res.error) {
        setLoadError(COPY.errorLoad)
        return
      }
      setRules(res.rules)
      setLoadError(null)
    } catch {
      if (mountedRef.current) setLoadError(COPY.errorLoad)
    }
  }, [])

  useEffect(() => { void loadRules() }, [loadRules])

  const categories = useMemo(() => {
    if (rules === null) return []
    const counts = new Map<string, number>()
    for (const rule of rules) {
      if (rule.category !== null) counts.set(rule.category, (counts.get(rule.category) ?? 0) + 1)
    }
    return Array.from(counts.entries())
  }, [rules])

  const filteredRules = useMemo(() => {
    if (rules === null) return []
    const query = search.trim().toLowerCase()
    return rules.filter((rule) => {
      if (activeCategory !== null && rule.category !== activeCategory) return false
      if (query === '') return true
      return rule.name.toLowerCase().includes(query) || (rule.description ?? '').toLowerCase().includes(query)
    })
  }, [rules, search, activeCategory])

  const handleToggleEnabled = useCallback(async (rule: Rule): Promise<void> => {
    setRules((prev) => prev?.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)) ?? prev)
    setActionError(null)
    const res = await rulesService.update(rule.id, { enabled: !rule.enabled })
    if (res.error) {
      setRules((prev) => prev?.map((r) => (r.id === rule.id ? rule : r)) ?? prev)
      setActionError(COPY.errorUpdate)
    }
  }, [])

  const handleDeleteConfirm = useCallback(async (id: string): Promise<void> => {
    setPendingDeleteId(null)
    const res = await rulesService.remove(id)
    if (res.error) {
      setActionError(COPY.errorDelete)
      return
    }
    setRules((prev) => prev?.filter((r) => r.id !== id) ?? prev)
  }, [])

  const handleFormSubmit = useCallback(async (values: RuleFormValues): Promise<RuleFormSubmitResult> => {
    const res = modal?.mode === 'edit'
      ? await rulesService.update(modal.rule.id, values)
      : await rulesService.create(values)

    if (res.error) return { ok: false, code: res.error.code }

    setModal(null)
    await loadRules()
    return { ok: true }
  }, [modal, loadRules])

  if (loadError !== null) {
    return (
      <section className="mx-auto w-full max-w-[1180px] px-lg py-lg">
        <p role="alert" className="text-sm text-red">{loadError}</p>
        <button type="button" onClick={() => { void loadRules() }} className="mt-sm text-sm text-accent underline">
          Tentar novamente
        </button>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-[1180px] px-lg py-lg text-fg">
      <div className="flex items-start justify-between gap-md">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">{COPY.title}</h1>
          <p className="mt-xs text-[13px] text-muted">{COPY.subtitle}</p>
        </div>
        <ButtonPrimary onClick={() => setModal({ mode: 'new' })}>{COPY.ctaNew}</ButtonPrimary>
      </div>

      <div className="mt-md">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={COPY.searchPlaceholder}
          aria-label={COPY.searchPlaceholder}
          className="h-[42px] w-full max-w-[420px] rounded-md border border-border bg-surface px-md text-sm text-fg focus:border-accent focus:outline-none"
        />
      </div>

      {categories.length > 0 ? (
        <div className="mt-md flex flex-wrap items-center gap-md border-b border-border" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === null}
            onClick={() => setActiveCategory(null)}
            className={`border-b-2 pb-xs text-[13px] ${activeCategory === null ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'}`}
          >
            {COPY.tabAll} <span className={activeCategory === null ? 'text-accent' : ''}>{rules?.length ?? 0}</span>
          </button>
          {categories.map(([category, count]) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={activeCategory === category}
              onClick={() => setActiveCategory(category)}
              className={`border-b-2 pb-xs text-[13px] ${activeCategory === category ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'}`}
            >
              {category} <span className={activeCategory === category ? 'text-accent' : ''}>{count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {actionError !== null ? (
        <p role="alert" className="mt-md text-[12.5px] text-red">{actionError}</p>
      ) : null}

      <div className="mt-lg">
        {rules === null ? null : filteredRules.length === 0 ? (
          <p className="text-[13px] text-muted">
            {rules.length === 0 ? COPY.emptyNone : COPY.emptyFiltered}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
            {filteredRules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                pendingDelete={pendingDeleteId === rule.id}
                onToggleEnabled={() => { void handleToggleEnabled(rule) }}
                onEdit={() => setModal({ mode: 'edit', rule })}
                onDeleteRequest={() => setPendingDeleteId(rule.id)}
                onDeleteConfirm={() => { void handleDeleteConfirm(rule.id) }}
                onDeleteCancel={() => setPendingDeleteId(null)}
              />
            ))}
          </div>
        )}
      </div>

      {modal !== null ? (
        <RuleFormModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.rule : null}
          onCancel={() => setModal(null)}
          onSubmit={handleFormSubmit}
        />
      ) : null}
    </section>
  )
}

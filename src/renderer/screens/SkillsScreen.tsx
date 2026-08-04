import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { ButtonPrimary } from '../components/ButtonPrimary'
import { SkillFormModal } from '../components/skills/SkillFormModal'
import type { SkillFormSubmitInput } from '../components/skills/SkillFormModal'
import { formatContentSize } from '../components/skills/skillForm.logic'
import { skillsService, type Skill } from '../services/skills-service'

const COPY = {
  title: 'Skills',
  subtitle:
    'Instruções reutilizáveis carregadas sob demanda pelo agente. Vincule-as a um projeto na tela principal para entrarem no catálogo.',
  ctaNew: '+ Nova skill',
  searchPlaceholder: 'Buscar por nome ou descrição…',
  tabAll: 'Todas',
  emptyNone: 'Nenhuma skill ainda. Crie a primeira com "+ Nova skill".',
  emptyFiltered: 'Nenhuma skill corresponde aos filtros.',
  badgeDisabled: 'desativada',
  actionEnable: 'Ativar',
  actionDisable: 'Desativar',
  actionEdit: 'Editar',
  actionDelete: 'Excluir',
  actionDeleteConfirm: 'Excluir?',
  actionDeleteCancel: 'Não',
  errorLoad: 'Não foi possível carregar as skills.',
  errorDelete: 'Não foi possível excluir a skill.',
  errorUpdate: 'Não foi possível atualizar a skill.',
  errorNetwork: 'Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução.',
  errorGeneric: 'Não foi possível salvar a skill. Tente novamente.',
  errorNameConflict: 'Já existe uma skill com este nome. Escolha outro.',
} as const

type ModalState = { mode: 'new' } | { mode: 'edit'; skill: Skill } | null

function matchesFilters(skill: Skill, search: string, category: string | null): boolean {
  if (category !== null && (skill.category ?? '') !== category) return false
  if (search === '') return true
  const needle = search.toLowerCase()
  return skill.name.toLowerCase().includes(needle) || skill.description.toLowerCase().includes(needle)
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface SkillCardProps {
  skill: Skill
  pendingDelete: boolean
  busy: boolean
  onToggleEnabled: () => void
  onEdit: () => void
  onDeleteClick: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}

function SkillCard({
  skill,
  pendingDelete,
  busy,
  onToggleEnabled,
  onEdit,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}: Readonly<SkillCardProps>): ReactElement {
  return (
    <div className={`rounded-lg border border-border bg-surface p-lg ${skill.enabled ? '' : 'opacity-60'}`}>
      <div className="mb-sm flex flex-wrap items-center gap-xs">
        <h3 className="text-[15px] font-semibold text-fg">{skill.name}</h3>
        {skill.category !== null ? (
          <span className="rounded-md bg-accent px-sm text-[11px] font-semibold text-bg">
            {skill.category}
          </span>
        ) : null}
        {!skill.enabled ? (
          <span className="rounded-full border border-border px-sm text-[11px] text-muted">
            {COPY.badgeDisabled}
          </span>
        ) : null}
      </div>

      <span className="font-mono text-[11.5px] text-muted">{formatContentSize(skill.content)}</span>

      <p className="mt-sm line-clamp-3 text-[12.5px] text-muted">{skill.description}</p>

      <div className="mt-md flex items-center gap-sm">
        <button
          type="button"
          onClick={onToggleEnabled}
          disabled={busy}
          title={skill.enabled ? COPY.actionDisable : COPY.actionEnable}
          className="text-[12.5px] text-accent hover:underline disabled:opacity-50"
        >
          {skill.enabled ? COPY.actionDisable : COPY.actionEnable}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          title={COPY.actionEdit}
          className="text-[12.5px] text-muted hover:text-fg disabled:opacity-50"
        >
          {COPY.actionEdit}
        </button>
        {pendingDelete ? (
          <span className="flex items-center gap-xs text-[12.5px]">
            <button type="button" onClick={onDeleteConfirm} disabled={busy} className="text-red hover:underline">
              {COPY.actionDeleteConfirm}
            </button>
            <button type="button" onClick={onDeleteCancel} disabled={busy} className="text-muted hover:underline">
              {COPY.actionDeleteCancel}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={onDeleteClick}
            disabled={busy}
            title={COPY.actionDelete}
            className="text-[12.5px] text-muted hover:text-red disabled:opacity-50"
          >
            {COPY.actionDelete}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────

export function SkillsScreen(): ReactElement {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const loadSkills = useCallback(async (): Promise<void> => {
    try {
      const res = await skillsService.list()
      if (!mountedRef.current) return
      if (res.error) {
        setLoadError(COPY.errorLoad)
        return
      }
      setSkills(res.skills)
      setLoadError(null)
    } catch {
      if (mountedRef.current) setLoadError(COPY.errorLoad)
    }
  }, [])

  useEffect(() => { void loadSkills() }, [loadSkills])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const skill of skills) {
      if (skill.category !== null) set.add(skill.category)
    }
    return [...set].sort()
  }, [skills])

  const filtered = useMemo(
    () => skills.filter((s) => matchesFilters(s, search, activeCategory)),
    [skills, search, activeCategory]
  )

  const handleCreateClick = useCallback((): void => {
    setFormError(null)
    setModal({ mode: 'new' })
  }, [])

  const handleEdit = useCallback((skill: Skill): void => {
    setFormError(null)
    setModal({ mode: 'edit', skill })
  }, [])

  const handleCancelModal = useCallback((): void => {
    setModal(null)
    setFormError(null)
  }, [])

  const handleSubmit = useCallback(async (input: SkillFormSubmitInput): Promise<void> => {
    if (modal === null) return
    setSaving(true)
    setFormError(null)
    try {
      const res = modal.mode === 'new'
        ? await skillsService.create(input)
        : await skillsService.update(modal.skill.id, input)

      if (!mountedRef.current) return

      if (res.error) {
        setSaving(false)
        setFormError(
          res.error.code === 'skill_name_conflict' ? COPY.errorNameConflict : COPY.errorGeneric
        )
        return
      }

      setSkills((prev) => {
        if (modal.mode === 'new') return [...prev, res.skill]
        return prev.map((s) => (s.id === res.skill.id ? res.skill : s))
      })
      setSaving(false)
      setModal(null)
    } catch {
      if (mountedRef.current) {
        setSaving(false)
        setFormError(COPY.errorNetwork)
      }
    }
  }, [modal])

  const handleToggleEnabled = useCallback(async (skill: Skill): Promise<void> => {
    setBusyId(skill.id)
    setRowError(null)
    const nextEnabled = !skill.enabled
    setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, enabled: nextEnabled } : s)))
    try {
      const res = await skillsService.update(skill.id, { enabled: nextEnabled })
      if (!mountedRef.current) return
      if (res.error) {
        setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, enabled: skill.enabled } : s)))
        setRowError(COPY.errorUpdate)
      }
    } catch {
      if (mountedRef.current) {
        setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, enabled: skill.enabled } : s)))
        setRowError(COPY.errorUpdate)
      }
    } finally {
      if (mountedRef.current) setBusyId(null)
    }
  }, [])

  const handleDeleteConfirm = useCallback(async (skill: Skill): Promise<void> => {
    setBusyId(skill.id)
    setRowError(null)
    try {
      const res = await skillsService.remove(skill.id)
      if (!mountedRef.current) return
      if (res.error) {
        setRowError(COPY.errorDelete)
        setBusyId(null)
        return
      }
      setSkills((prev) => prev.filter((s) => s.id !== skill.id))
      setPendingDeleteId(null)
      setBusyId(null)
    } catch {
      if (mountedRef.current) {
        setRowError(COPY.errorDelete)
        setBusyId(null)
      }
    }
  }, [])

  if (loadError !== null) {
    return (
      <section className="mx-auto w-full max-w-[1180px] px-lg py-lg">
        <p role="alert" className="text-sm text-red">{loadError}</p>
        <button type="button" onClick={() => { void loadSkills() }} className="mt-sm text-sm text-accent underline">
          Tentar novamente
        </button>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-[1180px] px-lg py-lg text-fg">
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">{COPY.title}</h1>
          <p className="mt-xs text-[13px] text-muted">{COPY.subtitle}</p>
        </div>
        <ButtonPrimary onClick={handleCreateClick}>{COPY.ctaNew}</ButtonPrimary>
      </div>

      <div className="mt-md">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={COPY.searchPlaceholder}
          className="h-[42px] w-full max-w-[420px] rounded-md border border-border bg-surface px-md text-sm text-fg placeholder:text-muted focus:outline-none focus:border-accent"
          aria-label={COPY.searchPlaceholder}
        />
      </div>

      {categories.length > 0 ? (
        <div className="mt-md flex flex-wrap items-center gap-md border-b border-border">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`border-b-2 pb-xs text-[13px] font-medium ${
              activeCategory === null ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {COPY.tabAll} <span className="text-accent">{skills.length}</span>
          </button>
          {categories.map((category) => {
            const count = skills.filter((s) => s.category === category).length
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`border-b-2 pb-xs text-[13px] font-medium ${
                  activeCategory === category ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
                }`}
              >
                {category} <span className="text-accent">{count}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {rowError !== null ? (
        <p role="alert" className="mt-md text-[12.5px] text-red">{rowError}</p>
      ) : null}

      <div className="mt-lg">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-muted">
            {skills.length === 0 ? COPY.emptyNone : COPY.emptyFiltered}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
            {filtered.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                pendingDelete={pendingDeleteId === skill.id}
                busy={busyId === skill.id}
                onToggleEnabled={() => { void handleToggleEnabled(skill) }}
                onEdit={() => handleEdit(skill)}
                onDeleteClick={() => setPendingDeleteId(skill.id)}
                onDeleteConfirm={() => { void handleDeleteConfirm(skill) }}
                onDeleteCancel={() => setPendingDeleteId(null)}
              />
            ))}
          </div>
        )}
      </div>

      {modal !== null ? (
        <SkillFormModal
          skill={modal.mode === 'edit' ? modal.skill : null}
          saving={saving}
          errorMessage={formError}
          onSubmit={(input) => { void handleSubmit(input) }}
          onCancel={handleCancelModal}
        />
      ) : null}
    </section>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { ButtonPrimary } from '../components/ButtonPrimary'
import { McpFormModal } from '../components/mcps/McpFormModal'
import { McpCatalogModal } from '../components/mcps/McpCatalogModal'
import { McpOauthControls } from '../components/mcps/McpOauthControls'
import { mcpsService, type Mcp, type McpCreateInput, type McpPreset } from '../services/mcps-service'

const COPY = {
  title: 'MCPs',
  subtitle: 'Servers MCP externos (stdio, http, sse) disponíveis aos agentes. Vincule-os a um projeto na tela principal para entrarem no turno.',
  ctaCatalog: 'Adicionar do catálogo',
  ctaNew: '+ Novo MCP',
  searchPlaceholder: 'Buscar por nome ou descrição…',
  tabAll: 'Todas',
  emptyNone: 'Nenhum MCP ainda. Crie com "+ Novo MCP".',
  emptyFiltered: 'Nenhum MCP corresponde aos filtros.',
  badgeDisabled: 'desativado',
  actionEnable: 'Ativar',
  actionDisable: 'Desativar',
  actionEdit: 'Editar',
  actionDelete: 'Excluir',
  actionDeleteConfirm: 'Excluir?',
  actionDeleteCancel: 'Não',
  ctaConvertOauth: 'Converter para OAuth',
  errorLoad: 'Não foi possível carregar os MCPs.',
  errorDelete: 'Não foi possível excluir o MCP.',
  errorUpdate: 'Não foi possível atualizar o MCP.',
  errorConvert: 'Não foi possível converter o MCP para OAuth.',
} as const

type ModalState = { mode: 'new' } | { mode: 'edit'; mcp: Mcp } | null

function matchesFilters(mcp: Mcp, search: string, category: string | null): boolean {
  if (category !== null && (mcp.category ?? '') !== category) return false
  if (search === '') return true
  const needle = search.toLowerCase()
  return mcp.name.toLowerCase().includes(needle) || (mcp.description ?? '').toLowerCase().includes(needle)
}

interface McpCardProps {
  mcp: Mcp
  oauthSiblingPresetId: string | null
  pendingDelete: boolean
  busy: boolean
  onToggleEnabled: () => void
  onEdit: () => void
  onDeleteClick: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
  onConvertOauth: (toPresetId: string) => void
}

function McpCard({
  mcp,
  oauthSiblingPresetId,
  pendingDelete,
  busy,
  onToggleEnabled,
  onEdit,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
  onConvertOauth,
}: Readonly<McpCardProps>): ReactElement {
  return (
    <div className={`rounded-lg border border-border bg-surface p-lg ${mcp.enabled ? '' : 'opacity-60'}`}>
      <div className="mb-sm flex flex-wrap items-center gap-xs">
        <h3 className="text-[15px] font-semibold text-fg">{mcp.name}</h3>
        <span className="rounded-md bg-accent px-sm font-mono text-[11px] text-bg">{mcp.transport}</span>
        {mcp.category !== null ? (
          <span className="rounded-full border border-border px-sm text-[11px] text-muted">{mcp.category}</span>
        ) : null}
        {!mcp.enabled ? (
          <span className="rounded-full border border-border px-sm text-[11px] text-muted">{COPY.badgeDisabled}</span>
        ) : null}
      </div>

      <span className="font-mono text-[11.5px] text-muted truncate">
        {mcp.transport === 'stdio' ? mcp.command : mcp.url}
      </span>

      {mcp.description !== null ? (
        <p className="mt-sm line-clamp-3 text-[12.5px] text-muted">{mcp.description}</p>
      ) : null}

      <div className="mt-md flex items-center gap-sm">
        <button
          type="button"
          onClick={onToggleEnabled}
          disabled={busy}
          title={mcp.enabled ? COPY.actionDisable : COPY.actionEnable}
          className="text-[12.5px] text-accent hover:underline disabled:opacity-50"
        >
          {mcp.enabled ? COPY.actionDisable : COPY.actionEnable}
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

      {mcp.authMode === 'oauth' ? <McpOauthControls mcpId={mcp.id} initialStatus={mcp.oauthStatus} /> : null}

      {mcp.authMode !== 'oauth' && oauthSiblingPresetId !== null ? (
        <button
          type="button"
          onClick={() => onConvertOauth(oauthSiblingPresetId)}
          title="Troca esta definição pela versão remota OAuth do catálogo (vínculos por projeto preservados)"
          className="mt-sm text-[12px] text-accent hover:underline"
        >
          {COPY.ctaConvertOauth}
        </button>
      ) : null}
    </div>
  )
}

export function McpsScreen(): ReactElement {
  const [mcps, setMcps] = useState<Mcp[]>([])
  const [presets, setPresets] = useState<McpPreset[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
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

  const loadMcps = useCallback(async (): Promise<void> => {
    try {
      const res = await mcpsService.list()
      if (!mountedRef.current) return
      if (res.error) {
        setLoadError(COPY.errorLoad)
        return
      }
      setMcps(res.mcps)
      setLoadError(null)
    } catch {
      if (mountedRef.current) setLoadError(COPY.errorLoad)
    }
  }, [])

  useEffect(() => { void loadMcps() }, [loadMcps])

  useEffect(() => {
    mcpsService.catalog().then((res) => {
      if (mountedRef.current && !res.error) setPresets(res.presets)
    }).catch(() => {})
  }, [])

  const installedPresetIds = useMemo(() => new Set(mcps.map((m) => m.presetId).filter((id): id is string => id !== null)), [mcps])

  const oauthSiblingByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const preset of presets) {
      if (preset.authMode === 'oauth') map.set(preset.name, preset.id)
    }
    return map
  }, [presets])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const mcp of mcps) {
      if (mcp.category !== null) set.add(mcp.category)
    }
    return [...set].sort()
  }, [mcps])

  const filtered = useMemo(() => mcps.filter((m) => matchesFilters(m, search, activeCategory)), [mcps, search, activeCategory])

  const handleCreateClick = useCallback((): void => {
    setFormError(null)
    setModal({ mode: 'new' })
  }, [])

  const handleEdit = useCallback((mcp: Mcp): void => {
    setFormError(null)
    setModal({ mode: 'edit', mcp })
  }, [])

  const handleCancelModal = useCallback((): void => {
    setModal(null)
    setFormError(null)
  }, [])

  const handleSubmit = useCallback(async (input: McpCreateInput): Promise<void> => {
    if (modal === null) return
    setSaving(true)
    setFormError(null)
    try {
      const res = modal.mode === 'new' ? await mcpsService.create(input) : await mcpsService.update(modal.mcp.id, input)
      if (!mountedRef.current) return
      if (res.error) {
        setSaving(false)
        setFormError(res.error.code === 'mcp_name_conflict' ? 'Já existe um MCP com este nome. Escolha outro.' : 'Não foi possível salvar o MCP. Tente novamente.')
        return
      }
      setMcps((prev) => (modal.mode === 'new' ? [...prev, res.mcp] : prev.map((m) => (m.id === res.mcp.id ? res.mcp : m))))
      setSaving(false)
      setModal(null)
    } catch {
      if (mountedRef.current) {
        setSaving(false)
        setFormError('Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução.')
      }
    }
  }, [modal])

  const handleToggleEnabled = useCallback(async (mcp: Mcp): Promise<void> => {
    setBusyId(mcp.id)
    setRowError(null)
    const nextEnabled = !mcp.enabled
    setMcps((prev) => prev.map((m) => (m.id === mcp.id ? { ...m, enabled: nextEnabled } : m)))
    try {
      const res = await mcpsService.update(mcp.id, { enabled: nextEnabled })
      if (!mountedRef.current) return
      if (res.error) {
        setMcps((prev) => prev.map((m) => (m.id === mcp.id ? { ...m, enabled: mcp.enabled } : m)))
        setRowError(COPY.errorUpdate)
      }
    } catch {
      if (mountedRef.current) {
        setMcps((prev) => prev.map((m) => (m.id === mcp.id ? { ...m, enabled: mcp.enabled } : m)))
        setRowError(COPY.errorUpdate)
      }
    } finally {
      if (mountedRef.current) setBusyId(null)
    }
  }, [])

  const handleDeleteConfirm = useCallback(async (mcp: Mcp): Promise<void> => {
    setBusyId(mcp.id)
    setRowError(null)
    try {
      const res = await mcpsService.remove(mcp.id)
      if (!mountedRef.current) return
      if (res.error) {
        setRowError(COPY.errorDelete)
        setBusyId(null)
        return
      }
      setMcps((prev) => prev.filter((m) => m.id !== mcp.id))
      setPendingDeleteId(null)
      setBusyId(null)
    } catch {
      if (mountedRef.current) {
        setRowError(COPY.errorDelete)
        setBusyId(null)
      }
    }
  }, [])

  const handleConvertOauth = useCallback(async (mcp: Mcp, toPresetId: string): Promise<void> => {
    setBusyId(mcp.id)
    setRowError(null)
    try {
      const res = await mcpsService.oauthConvert(mcp.id, toPresetId)
      if (!mountedRef.current) return
      if (res.error) {
        setRowError(COPY.errorConvert)
        return
      }
      setMcps((prev) => prev.map((m) => (m.id === mcp.id ? res.mcp : m)))
    } catch {
      if (mountedRef.current) setRowError(COPY.errorConvert)
    } finally {
      if (mountedRef.current) setBusyId(null)
    }
  }, [])

  if (loadError !== null) {
    return (
      <section className="mx-auto w-full max-w-[1180px] px-lg py-lg">
        <p role="alert" className="text-sm text-red">{loadError}</p>
        <button type="button" onClick={() => { void loadMcps() }} className="mt-sm text-sm text-accent underline">
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
        <div className="flex items-center gap-sm">
          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            className="rounded-sm border border-border bg-surface-2 px-md py-sm text-[13px] text-fg hover:border-accent"
          >
            {COPY.ctaCatalog}
          </button>
          <ButtonPrimary onClick={handleCreateClick}>{COPY.ctaNew}</ButtonPrimary>
        </div>
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
            className={`border-b-2 pb-xs text-[13px] font-medium ${activeCategory === null ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'}`}
          >
            {COPY.tabAll} <span className="text-accent">{mcps.length}</span>
          </button>
          {categories.map((category) => {
            const count = mcps.filter((m) => m.category === category).length
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`border-b-2 pb-xs text-[13px] font-medium ${activeCategory === category ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'}`}
              >
                {category} <span className="text-accent">{count}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {rowError !== null ? <p role="alert" className="mt-md text-[12.5px] text-red">{rowError}</p> : null}

      <div className="mt-lg">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-muted">{mcps.length === 0 ? COPY.emptyNone : COPY.emptyFiltered}</p>
        ) : (
          <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
            {filtered.map((mcp) => (
              <McpCard
                key={mcp.id}
                mcp={mcp}
                oauthSiblingPresetId={oauthSiblingByName.get(mcp.name) ?? null}
                pendingDelete={pendingDeleteId === mcp.id}
                busy={busyId === mcp.id}
                onToggleEnabled={() => { void handleToggleEnabled(mcp) }}
                onEdit={() => handleEdit(mcp)}
                onDeleteClick={() => setPendingDeleteId(mcp.id)}
                onDeleteConfirm={() => { void handleDeleteConfirm(mcp) }}
                onDeleteCancel={() => setPendingDeleteId(null)}
                onConvertOauth={(toPresetId) => { void handleConvertOauth(mcp, toPresetId) }}
              />
            ))}
          </div>
        )}
      </div>

      {modal !== null ? (
        <McpFormModal
          mcp={modal.mode === 'edit' ? modal.mcp : null}
          saving={saving}
          errorMessage={formError}
          onSubmit={(input) => { void handleSubmit(input) }}
          onCancel={handleCancelModal}
        />
      ) : null}

      {catalogOpen ? (
        <McpCatalogModal
          installedPresetIds={installedPresetIds}
          onInstalled={(mcp) => setMcps((prev) => [...prev, mcp])}
          onClose={() => setCatalogOpen(false)}
        />
      ) : null}
    </section>
  )
}

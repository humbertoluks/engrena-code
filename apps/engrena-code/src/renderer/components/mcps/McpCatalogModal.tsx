import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { mcpsService, type Mcp, type McpPreset } from '../../services/mcps-service'

const COPY = {
  title: 'Adicionar do catálogo',
  subtitle: 'Presets first-party prontos — instalar cria a definição global; os segredos você preenche no cofre em seguida.',
  loading: 'Carregando catálogo…',
  badgeOauth: 'OAuth',
  badgeExperimental: 'experimental',
  badgeInstalled: 'instalado',
  metaSecrets: (keys: string[]) => `segredos: ${keys.join(', ')}`,
  ctaInstall: 'Instalar',
  ctaInstalled: 'Instalado',
  ctaInstalling: 'Instalando…',
  errorLoad: 'Não foi possível carregar o catálogo.',
  errorInstall: 'Não foi possível instalar o preset. Tente novamente.',
  ariaClose: 'Fechar',
} as const

export interface McpCatalogModalProps {
  installedPresetIds: Set<string>
  onInstalled: (mcp: Mcp) => void
  onClose: () => void
}

export function McpCatalogModal({ installedPresetIds, onInstalled, onClose }: Readonly<McpCatalogModalProps>): ReactElement {
  const [presets, setPresets] = useState<McpPreset[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [installedHere, setInstalledHere] = useState<Set<string>>(new Set())

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    mcpsService
      .catalog()
      .then((res) => {
        if (!mountedRef.current) return
        if (res.error) {
          setLoadError(COPY.errorLoad)
          return
        }
        setPresets(res.presets)
      })
      .catch(() => {
        if (mountedRef.current) setLoadError(COPY.errorLoad)
      })
  }, [])

  const handleInstall = useCallback(async (preset: McpPreset): Promise<void> => {
    setInstallingId(preset.id)
    setInstallError(null)
    try {
      const res = await mcpsService.installPreset(preset.id)
      if (!mountedRef.current) return
      if (res.error) {
        setInstallError(COPY.errorInstall)
        return
      }
      setInstalledHere((prev) => new Set(prev).add(preset.id))
      onInstalled(res.mcp)
    } catch {
      if (mountedRef.current) setInstallError(COPY.errorInstall)
    } finally {
      if (mountedRef.current) setInstallingId(null)
    }
  }, [onInstalled])

  return (
    <div className="fixed inset-0 z-50 flex place-items-center justify-center bg-black/50 px-md">
      <div className="flex max-h-[86vh] w-full max-w-[880px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-lg shadow-lg">
        <div className="mb-md flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-fg">{COPY.title}</h2>
            <p className="mt-xs text-[12.5px] text-muted">{COPY.subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-fg" aria-label={COPY.ariaClose}>
            ✕
          </button>
        </div>

        {loadError !== null ? <p role="alert" className="text-[12.5px] text-red">{loadError}</p> : null}
        {installError !== null ? <p role="alert" className="mb-sm text-[12.5px] text-red">{installError}</p> : null}

        {presets === null ? (
          <p className="text-[13px] text-muted">{COPY.loading}</p>
        ) : (
          <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
            {presets.map((preset) => {
              const installed = installedPresetIds.has(preset.id) || installedHere.has(preset.id)
              const installing = installingId === preset.id
              const secretKeys = Object.values(preset.secretEnv ?? {})
              return (
                <div key={preset.id} className="rounded-lg border border-border bg-surface-2 p-md">
                  <div className="flex flex-wrap items-center gap-xs">
                    <h3 className="text-[14px] font-semibold text-fg">{preset.name}</h3>
                    {preset.authMode === 'oauth' ? (
                      <span className="rounded-full border border-border px-sm text-[11px] text-muted">{COPY.badgeOauth}</span>
                    ) : null}
                    {preset.experimental ? (
                      <span className="rounded-full border border-amber/60 px-sm text-[11px] text-amber">{COPY.badgeExperimental}</span>
                    ) : null}
                    <span className="rounded-full border border-border px-sm text-[11px] text-muted">{preset.category}</span>
                    {installed ? (
                      <span className="rounded-full border border-green/60 px-sm text-[11px] text-green">{COPY.badgeInstalled}</span>
                    ) : null}
                  </div>
                  <p className="mt-xs text-[12.5px] text-muted">{preset.description}</p>
                  {secretKeys.length > 0 ? (
                    <p className="mt-xs font-mono text-[11px] text-muted">{COPY.metaSecrets(secretKeys)}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => { void handleInstall(preset) }}
                    disabled={installed || installing}
                    className="mt-sm rounded-sm border border-border bg-surface px-md py-xs text-[12.5px] text-fg hover:border-accent disabled:opacity-50"
                  >
                    {installed ? COPY.ctaInstalled : installing ? COPY.ctaInstalling : COPY.ctaInstall}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

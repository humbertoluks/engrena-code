import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { ComposerCatalog } from '../../services/threads-service'
import type { ThreadProvider } from '../../services/threads-service'

const COPY = {
  pickerSearchPlaceholder: 'Buscar modelos…',
  pickerEmpty: 'Nenhum modelo encontrado.',
  reasoningGroup: 'Reasoning',
  reasoningDefaultSuffix: ' (default)',
  lockProvider: 'Modelos do provider da thread — o provider é imutável.',
} as const

const PROVIDER_LABEL: Record<ThreadProvider, string> = {
  claude: 'Claude',
  codex: 'Codex',
  kimi: 'Kimi',
  minimax: 'Minimax',
}

const REASONING_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  'extra-high': 'Extra High',
  max: 'Max',
}

function useClickOutside(onOutside: () => void): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onOutside])
  return ref
}

export interface ComposerModelControlsProps {
  catalog: ComposerCatalog | null
  provider: ThreadProvider
  model: string | null
  reasoningLevel: string | null
  lockProvider: boolean
  disabled: boolean
  onChangeProvider: (provider: ThreadProvider) => void
  onChangeModel: (model: string) => void
  onChangeReasoningLevel: (level: string) => void
}

export function ComposerModelControls({
  catalog,
  provider,
  model,
  reasoningLevel,
  lockProvider,
  disabled,
  onChangeProvider,
  onChangeModel,
  onChangeReasoningLevel,
}: Readonly<ComposerModelControlsProps>): ReactElement | null {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [reasoningOpen, setReasoningOpen] = useState(false)
  const [search, setSearch] = useState('')

  const pickerRef = useClickOutside(() => setPickerOpen(false))
  const reasoningRef = useClickOutside(() => setReasoningOpen(false))

  if (catalog === null) return null

  const entry = catalog.providers[provider]
  const modelLabel = model ?? entry.defaultModel
  const filteredModels = entry.models.filter((m) => m.toLowerCase().includes(search.toLowerCase()))
  const providers = Object.keys(catalog.providers) as ThreadProvider[]

  return (
    <div className="flex items-center gap-xs">
      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          disabled={disabled}
          title={lockProvider ? COPY.lockProvider : undefined}
          aria-label={`Provider e modelo: ${PROVIDER_LABEL[provider]} · ${modelLabel}`}
          onClick={() => setPickerOpen((v) => !v)}
          className="rounded-md border border-border bg-surface px-xs py-[3px] text-[12px] font-medium hover:bg-surface-2 disabled:opacity-50"
        >
          {PROVIDER_LABEL[provider]} · {modelLabel}
        </button>

        {pickerOpen ? (
          <div className="absolute bottom-[calc(100%+6px)] left-0 z-10 flex h-[360px] w-[min(440px,92vw)] flex-col rounded-lg border border-border bg-surface shadow-lg">
            {!lockProvider ? (
              <div aria-label="Providers" className="flex flex-wrap gap-xs border-b border-border p-xs">
                {providers.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      onChangeProvider(p)
                      setSearch('')
                    }}
                    className={`rounded-md px-xs py-[2px] text-[11px] ${
                      p === provider ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2'
                    }`}
                  >
                    {PROVIDER_LABEL[p]}
                  </button>
                ))}
              </div>
            ) : null}

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={COPY.pickerSearchPlaceholder}
              aria-label={COPY.pickerSearchPlaceholder}
              className="border-b border-border bg-transparent px-sm py-xs text-[12px] text-fg placeholder:text-muted focus:outline-none"
            />

            <div aria-label="Modelos" className="flex-1 overflow-y-auto p-xs">
              {filteredModels.length === 0 ? (
                <p className="p-sm text-[12px] text-muted">{COPY.pickerEmpty}</p>
              ) : (
                filteredModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onChangeModel(m)
                      setPickerOpen(false)
                    }}
                    className={`block w-full rounded-md px-sm py-[4px] text-left text-[12.5px] ${
                      m === modelLabel ? 'bg-accent/15 text-fg' : 'text-fg hover:bg-surface-2'
                    }`}
                  >
                    {m}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>

      {entry.reasoningLevels.length > 0 ? (
        <div className="relative" ref={reasoningRef}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setReasoningOpen((v) => !v)}
            aria-label={`Reasoning: ${reasoningLevel ? REASONING_LABEL[reasoningLevel] : entry.defaultReasoningLevel ? REASONING_LABEL[entry.defaultReasoningLevel] : 'default'}`}
            className="rounded-md border border-border bg-surface px-xs py-[3px] text-[12px] font-medium hover:bg-surface-2 disabled:opacity-50"
          >
            {reasoningLevel ? REASONING_LABEL[reasoningLevel] : entry.defaultReasoningLevel ? REASONING_LABEL[entry.defaultReasoningLevel] : COPY.reasoningGroup}
          </button>

          {reasoningOpen ? (
            <div className="absolute bottom-[calc(100%+6px)] left-0 z-10 w-[230px] rounded-lg border border-border bg-surface p-xs shadow-lg">
              <p className="px-sm py-[2px] text-[10px] uppercase tracking-wide text-muted">{COPY.reasoningGroup}</p>
              {entry.reasoningLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => {
                    onChangeReasoningLevel(level)
                    setReasoningOpen(false)
                  }}
                  className={`block w-full rounded-md px-sm py-[4px] text-left text-[12.5px] ${
                    (reasoningLevel ?? entry.defaultReasoningLevel) === level ? 'bg-accent/15 text-fg' : 'text-fg hover:bg-surface-2'
                  }`}
                >
                  {REASONING_LABEL[level] ?? level}
                  {entry.defaultReasoningLevel === level ? COPY.reasoningDefaultSuffix : ''}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

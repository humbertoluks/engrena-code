import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { ChatModeItem } from '../../services/prompt-library-service'
import {
  chatModeFormFrom,
  isModeCatalogChecked,
  toggleModeCatalogName,
  EMPTY_CHAT_MODE_FORM,
  type ChatModeFormDraft,
  type ModeCatalogOptions,
} from '../../hooks/promptLibrary.logic'

/**
 * Seletor de modo de chat (F28 §3.4) — equivalente a `*.chatmode.md`: um preset de
 * provider/modelo/reasoning/access/execution + instruções que entram no system prompt do turno.
 *
 * O mesmo formulário cria e edita: `editing === null` é modo novo (POST, preset capturado do
 * composer), `editing !== null` é PUT sobre um modo do banco. Modo vindo de arquivo do repositório
 * é somente leitura — não ganha lápis nem ×, porque a fonte da verdade dele é o arquivo.
 */

const COPY = {
  label: 'Modo',
  none: 'Sem modo',
  ariaOpen: (current: string) => `Modo de chat: ${current}`,
  group: 'Modos do projeto',
  empty: 'Nenhum modo salvo neste projeto.',
  fromRepo: 'do repositório',
  remove: 'Remover modo',
  edit: 'Editar modo',
  editingTitle: (name: string) => `Editando: ${name}`,
  newTitle: 'Novo modo',
  namePlaceholder: 'Nome do modo…',
  savePlaceholder: 'Salvar preset atual como…',
  instructionsPlaceholder: 'Instruções do modo (opcional) — entram no system prompt do turno',
  skillsLabel: 'Skills do modo',
  rulesLabel: 'Rules do modo',
  catalogAll: 'Todas',
  catalogAllTitle: 'Sem filtro: o modo usa tudo que o projeto vincular, inclusive o que entrar depois',
  catalogEmpty: 'Nada vinculado ao projeto.',
  catalogNoneSelected: 'Nenhuma — o turno roda sem esta fonte.',
  capturePreset: 'Regravar preset com o composer atual',
  capturePresetTitle: 'Substitui provider/modelo/reasoning/access/execution do modo pelo que está no composer agora',
  save: 'Salvar',
  cancel: 'Cancelar',
} as const

export interface ComposerModePickerProps {
  modes: readonly ChatModeItem[]
  /** Skills/rules que o projeto resolve hoje — o teto do que o modo pode filtrar. */
  catalog: ModeCatalogOptions
  value: string | null
  disabled: boolean
  /** Disparado ao abrir a lista — relê modos e catálogo, que mudam por fora da UI. */
  onOpen?: () => void
  onApply: (name: string | null) => void
  onSave: (form: ChatModeFormDraft) => Promise<boolean>
  onUpdate: (
    id: string,
    previousName: string,
    form: ChatModeFormDraft,
    options: { capturePreset: boolean }
  ) => Promise<boolean>
  onDelete: (id: string, name: string) => void
}

/** Tri-estado do catálogo: `null` = todas (sem filtro), lista = só essas, `[]` = nenhuma. */
function ModeCatalogSelector({
  label,
  all,
  selected,
  onToggle,
  onSelectAll,
}: Readonly<{
  label: string
  all: readonly string[]
  selected: string[] | null
  onToggle: (name: string) => void
  onSelectAll: () => void
}>): ReactElement {
  return (
    <fieldset className="mb-xs rounded-md border border-border px-sm py-[4px]">
      <legend className="flex items-center gap-xs px-[2px] text-[10px] uppercase tracking-wide text-muted">
        {label}
        <button
          type="button"
          onClick={onSelectAll}
          title={COPY.catalogAllTitle}
          className={`rounded-[4px] border px-[4px] py-0 text-[9.5px] uppercase tracking-wide ${
            selected === null ? 'border-accent bg-accent/15 text-fg' : 'border-border text-muted hover:text-fg'
          }`}
        >
          {COPY.catalogAll}
        </button>
      </legend>
      {all.length === 0 ? (
        <p className="py-[2px] text-[11px] text-muted">{COPY.catalogEmpty}</p>
      ) : (
        <div className="max-h-[92px] overflow-y-auto">
          {all.map((name) => (
            <label key={name} className="flex cursor-pointer items-center gap-xs py-[1px] text-[11.5px] text-fg">
              <input
                type="checkbox"
                checked={isModeCatalogChecked(selected, name)}
                onChange={() => onToggle(name)}
                className="h-[12px] w-[12px] accent-accent"
              />
              <span className="truncate">{name}</span>
            </label>
          ))}
          {selected !== null && selected.length === 0 ? (
            <p className="py-[1px] text-[10.5px] text-amber">{COPY.catalogNoneSelected}</p>
          ) : null}
        </div>
      )}
    </fieldset>
  )
}

export function ComposerModePicker({
  modes,
  catalog,
  value,
  disabled,
  onOpen,
  onApply,
  onSave,
  onUpdate,
  onDelete,
}: Readonly<ComposerModePickerProps>): ReactElement {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ChatModeFormDraft>(EMPTY_CHAT_MODE_FORM)
  /** `{ id, name }` do modo em edição; `null` = formulário de criação. */
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [capturePreset, setCapturePreset] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  function resetForm(): void {
    setForm(EMPTY_CHAT_MODE_FORM)
    setEditing(null)
    setCapturePreset(false)
  }

  function startEditing(mode: ChatModeItem): void {
    if (mode.id === null) return
    setForm(chatModeFormFrom(mode))
    setEditing({ id: mode.id, name: mode.name })
    setCapturePreset(false)
  }

  async function handleSave(): Promise<void> {
    if (form.name.trim() === '') return
    const ok =
      editing === null
        ? await onSave(form)
        : await onUpdate(editing.id, editing.name, form, { capturePreset })
    if (!ok) return
    resetForm()
    setOpen(false)
  }

  const current = value ?? COPY.none

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        aria-label={COPY.ariaOpen(current)}
        onClick={() => {
          // Só na abertura. Fora do updater do `setOpen` de propósito: updater tem de ser puro
          // (o StrictMode chama duas vezes) e `open` do render corrente já é o valor certo aqui.
          if (!open) onOpen?.()
          setOpen((v) => !v)
        }}
        className="flex items-center gap-[2px] rounded-md border border-border bg-surface px-xs py-[3px] text-[11px] disabled:opacity-50"
      >
        <span className="uppercase tracking-wide text-muted">{COPY.label}</span>
        <span className={value === null ? 'text-muted' : 'font-medium text-fg'}>{current}</span>
      </button>

      {open ? (
        <div className="absolute bottom-[calc(100%+6px)] left-0 z-50 w-[min(320px,92vw)] rounded-lg border border-border bg-surface p-xs shadow-lg">
          <p className="px-sm py-[2px] text-[10px] uppercase tracking-wide text-muted">{COPY.group}</p>

          <button
            type="button"
            onClick={() => {
              onApply(null)
              setOpen(false)
            }}
            className={`block w-full rounded-md px-sm py-[4px] text-left text-[12.5px] ${
              value === null ? 'bg-accent/15 text-fg' : 'text-muted hover:bg-surface-2'
            }`}
          >
            {COPY.none}
          </button>

          {modes.length === 0 ? (
            <p className="px-sm py-[6px] text-[11.5px] text-muted">{COPY.empty}</p>
          ) : (
            modes.map((mode) => (
              <div key={mode.file ?? mode.id} className="group/mode flex items-center gap-xs rounded-md hover:bg-surface-2">
                <button
                  type="button"
                  onClick={() => {
                    onApply(mode.name)
                    setOpen(false)
                  }}
                  className={`min-w-0 flex-1 rounded-md px-sm py-[4px] text-left text-[12.5px] ${
                    value === mode.name ? 'bg-accent/15 text-fg' : 'text-fg'
                  }`}
                >
                  <span className="font-medium">{mode.name}</span>
                  <span className="truncate text-[11px] text-muted">
                    {mode.description !== '' ? ` — ${mode.description}` : ''}
                    {mode.source === 'file' ? ` (${COPY.fromRepo})` : ''}
                  </span>
                </button>
                {mode.source === 'db' && mode.id !== null ? (
                  <>
                    <button
                      type="button"
                      aria-label={`${COPY.edit}: ${mode.name}`}
                      title={COPY.edit}
                      onClick={() => startEditing(mode)}
                      className={`shrink-0 rounded-md px-xs py-[2px] text-[11px] hover:text-accent ${
                        editing?.id === mode.id
                          ? 'text-accent opacity-100'
                          : 'text-muted opacity-0 group-focus-within/mode:opacity-100 group-hover/mode:opacity-100'
                      }`}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      aria-label={`${COPY.remove}: ${mode.name}`}
                      title={COPY.remove}
                      onClick={() => onDelete(mode.id as string, mode.name)}
                      className="mr-xs shrink-0 rounded-md px-xs py-[2px] text-[12px] text-muted opacity-0 hover:text-red group-focus-within/mode:opacity-100 group-hover/mode:opacity-100"
                    >
                      ×
                    </button>
                  </>
                ) : null}
              </div>
            ))
          )}

          <div className="mt-xs border-t border-border pt-xs">
            <p className="mb-xs px-sm text-[10px] uppercase tracking-wide text-muted">
              {editing === null ? COPY.newTitle : COPY.editingTitle(editing.name)}
            </p>

            <textarea
              value={form.instructions}
              onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))}
              placeholder={COPY.instructionsPlaceholder}
              aria-label={COPY.instructionsPlaceholder}
              rows={2}
              className="mb-xs w-full resize-none rounded-md border border-border bg-surface-2 px-sm py-[4px] text-[12px] text-fg placeholder:text-muted focus:border-accent focus:outline-none"
            />

            <ModeCatalogSelector
              label={COPY.skillsLabel}
              all={catalog.skills}
              selected={form.skills}
              onToggle={(name) =>
                setForm((prev) => ({ ...prev, skills: toggleModeCatalogName(prev.skills, name, catalog.skills) }))
              }
              onSelectAll={() => setForm((prev) => ({ ...prev, skills: null }))}
            />

            <ModeCatalogSelector
              label={COPY.rulesLabel}
              all={catalog.rules}
              selected={form.rules}
              onToggle={(name) =>
                setForm((prev) => ({ ...prev, rules: toggleModeCatalogName(prev.rules, name, catalog.rules) }))
              }
              onSelectAll={() => setForm((prev) => ({ ...prev, rules: null }))}
            />

            {editing !== null ? (
              <label
                title={COPY.capturePresetTitle}
                className="mb-xs flex cursor-pointer items-center gap-xs text-[11px] text-muted"
              >
                <input
                  type="checkbox"
                  checked={capturePreset}
                  onChange={(e) => setCapturePreset(e.target.checked)}
                  className="h-[12px] w-[12px] accent-accent"
                />
                {COPY.capturePreset}
              </label>
            ) : null}

            <div className="flex items-center gap-xs">
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleSave()
                  }
                }}
                placeholder={editing === null ? COPY.savePlaceholder : COPY.namePlaceholder}
                aria-label={editing === null ? COPY.savePlaceholder : COPY.namePlaceholder}
                className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-sm py-[3px] text-[12px] text-fg placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={form.name.trim() === ''}
                className="shrink-0 rounded-md bg-accent px-sm py-[3px] text-[11px] font-medium text-white disabled:opacity-50"
              >
                {COPY.save}
              </button>
              {editing !== null ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="shrink-0 rounded-md px-xs py-[3px] text-[11px] text-muted hover:text-fg"
                >
                  {COPY.cancel}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

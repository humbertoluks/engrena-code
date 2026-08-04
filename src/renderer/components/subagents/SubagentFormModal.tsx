import { useEffect, useState } from 'react'
import type { FormEvent, ReactElement, ReactNode } from 'react'
import { ButtonPrimary } from '../ButtonPrimary'
import { ButtonSecondary } from '../ButtonSecondary'
import { InlineFeedback } from '../InlineFeedback'
import type { SubagentInput, SubagentProvider } from '../../../services/db/repositories/subagents.js'
import type { Subagent } from '../../services/subagents-service.js'
import {
  READONLY_TOOLS,
  buildSubagentPayload,
  canSubmitSubagentForm,
  emptyFormValues,
  hidesModelFields,
  toolsModeFromValue,
  type SubagentFormValues,
} from './subagentForm.logic.js'
import { t, type SubagentsCopyId } from './copy.js'

const PROVIDERS: { value: SubagentProvider; labelId: SubagentsCopyId }[] = [
  { value: 'inherit', labelId: 'subagentsForm.provider.inherit' },
  { value: 'claude', labelId: 'subagentsForm.provider.claude' },
  { value: 'codex', labelId: 'subagentsForm.provider.codex' },
  { value: 'kimi', labelId: 'subagentsForm.provider.kimi' },
]

const REASONING_LEVELS: { value: string; labelId: SubagentsCopyId }[] = [
  { value: 'low', labelId: 'subagentsForm.reasoning.low' },
  { value: 'medium', labelId: 'subagentsForm.reasoning.medium' },
  { value: 'high', labelId: 'subagentsForm.reasoning.high' },
  { value: 'extra-high', labelId: 'subagentsForm.reasoning.extra-high' },
  { value: 'max', labelId: 'subagentsForm.reasoning.max' },
]

function valuesFromSubagent(s: Subagent | undefined): SubagentFormValues {
  if (!s) return emptyFormValues()
  return {
    name: s.name,
    description: s.description,
    category: s.category ?? '',
    provider: s.provider,
    model: s.model ?? '',
    reasoningLevel: s.reasoningLevel ?? '',
    toolsMode: toolsModeFromValue(s.tools),
    toolsAllowlist: s.tools ?? [],
    prompt: s.prompt,
    idleTimeoutMinutes: s.idleTimeoutMinutes != null ? String(s.idleTimeoutMinutes) : '',
    enabled: s.enabled,
  }
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x))
}

const LABEL_CLASS = 'text-[12px] font-semibold uppercase tracking-[0.04em] text-muted'
const HINT_CLASS = 'text-[11.5px] text-muted'
const INPUT_CLASS =
  'w-full rounded-sm border border-border bg-surface-2 px-md py-sm text-sm text-fg transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'
const TEXTAREA_MONO_CLASS = `${INPUT_CLASS} font-mono resize-y`

interface FieldProps {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
}

function Field({ label, hint, htmlFor, children }: Readonly<FieldProps>): ReactElement {
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={htmlFor} className={LABEL_CLASS}>
        {label}
      </label>
      {children}
      {hint !== undefined ? <p className={HINT_CLASS}>{hint}</p> : null}
    </div>
  )
}

interface ToolsModeButtonProps {
  active: boolean
  onClick: () => void
  children: ReactNode
}

function ToolsModeButton({ active, onClick, children }: Readonly<ToolsModeButtonProps>): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-sm py-[3px] text-[11px] transition-colors ${
        active ? 'border-accent bg-accent/20 text-accent' : 'border-border bg-surface-2 text-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}

interface ToolsAllowlistEditorProps {
  value: string[]
  onChange: (tools: string[]) => void
}

function ToolsAllowlistEditor({ value, onChange }: Readonly<ToolsAllowlistEditorProps>): ReactElement {
  const [draft, setDraft] = useState('')

  const addTool = (): void => {
    const name = draft.trim()
    if (name === '' || value.includes(name)) {
      setDraft('')
      return
    }
    onChange([...value, name])
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-xs">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-xs">
          {value.map((tool) => (
            <button
              key={tool}
              type="button"
              onClick={() => onChange(value.filter((x) => x !== tool))}
              className="rounded-md bg-surface-2 px-sm text-[11px] text-fg transition-colors hover:bg-red/20 hover:text-red"
            >
              {tool} ×
            </button>
          ))}
        </div>
      ) : null}
      <input
        className={INPUT_CLASS}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            addTool()
          }
        }}
        placeholder="Read, Grep, Bash…"
      />
    </div>
  )
}

export type SubmitResult = { ok: true } | { ok: false; message: string }

export interface SubagentFormModalProps {
  mode: 'new' | 'edit'
  initial?: Subagent
  onCancel: () => void
  onSubmit: (payload: SubagentInput) => Promise<SubmitResult>
}

export function SubagentFormModal({
  mode,
  initial,
  onCancel,
  onSubmit,
}: Readonly<SubagentFormModalProps>): ReactElement {
  const [values, setValues] = useState<SubagentFormValues>(() => valuesFromSubagent(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const hideModel = hidesModelFields(values.provider)
  const canSubmit = canSubmitSubagentForm(values) && !saving

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    const result = await onSubmit(buildSubagentPayload(values))
    setSaving(false)
    if (!result.ok) setError(result.message)
  }

  const toolsHintId: SubagentsCopyId =
    values.toolsMode === 'unrestricted'
      ? 'subagentsForm.hint.tools.unrestricted'
      : values.toolsMode === 'none'
        ? 'subagentsForm.hint.tools.none'
        : 'subagentsForm.hint.tools.allowlist'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-lg"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'new' ? t('subagentsForm.title.new') : t('subagentsForm.title.edit')}
        className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-lg text-left shadow-lg"
      >
        <h2 className="mb-md text-[17px] font-semibold text-fg">
          {mode === 'new' ? t('subagentsForm.title.new') : t('subagentsForm.title.edit')}
        </h2>
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
          className="flex flex-col gap-md"
        >
          <Field label={t('subagentsForm.label.name')} hint={t('subagentsForm.hint.name')} htmlFor="subagent-name">
            <input
              id="subagent-name"
              className={INPUT_CLASS}
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              placeholder={t('subagentsForm.placeholder.name')}
            />
          </Field>

          <Field
            label={t('subagentsForm.label.description')}
            hint={t('subagentsForm.hint.description')}
            htmlFor="subagent-description"
          >
            <textarea
              id="subagent-description"
              rows={2}
              className={INPUT_CLASS}
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              placeholder={t('subagentsForm.placeholder.description')}
            />
          </Field>

          <Field
            label={t('subagentsForm.label.category')}
            hint={t('subagentsForm.hint.category')}
            htmlFor="subagent-category"
          >
            <input
              id="subagent-category"
              className={INPUT_CLASS}
              value={values.category}
              onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
              placeholder={t('subagentsForm.placeholder.category')}
            />
          </Field>

          <Field
            label={t('subagentsForm.label.provider')}
            hint={values.provider === 'inherit' ? t('subagentsForm.hint.inherit') : undefined}
            htmlFor="subagent-provider"
          >
            <select
              id="subagent-provider"
              className={INPUT_CLASS}
              value={values.provider}
              onChange={(e) => setValues((v) => ({ ...v, provider: e.target.value as SubagentProvider }))}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {t(p.labelId)}
                </option>
              ))}
            </select>
          </Field>

          {!hideModel ? (
            <Field label={t('subagentsForm.label.model')} hint={t('subagentsForm.hint.model')} htmlFor="subagent-model">
              <input
                id="subagent-model"
                className={INPUT_CLASS}
                value={values.model}
                onChange={(e) => setValues((v) => ({ ...v, model: e.target.value }))}
                placeholder={t('subagentsForm.option.model.default')}
              />
            </Field>
          ) : null}

          {!hideModel ? (
            <Field
              label={t('subagentsForm.label.reasoning')}
              hint={t('subagentsForm.hint.reasoning')}
              htmlFor="subagent-reasoning"
            >
              <select
                id="subagent-reasoning"
                className={INPUT_CLASS}
                value={values.reasoningLevel}
                onChange={(e) => setValues((v) => ({ ...v, reasoningLevel: e.target.value }))}
              >
                <option value="">{t('subagentsForm.option.reasoning.default')}</option>
                {REASONING_LEVELS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(r.labelId)}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field label={t('subagentsForm.label.tools')} hint={t(toolsHintId)}>
            <div className="flex flex-wrap gap-xs">
              <ToolsModeButton
                active={values.toolsMode === 'unrestricted'}
                onClick={() => setValues((v) => ({ ...v, toolsMode: 'unrestricted' }))}
              >
                {t('subagentsForm.tools.unrestricted')}
              </ToolsModeButton>
              <ToolsModeButton
                active={values.toolsMode === 'none'}
                onClick={() => setValues((v) => ({ ...v, toolsMode: 'none' }))}
              >
                {t('subagentsForm.tools.none')}
              </ToolsModeButton>
              <ToolsModeButton
                active={values.toolsMode === 'allowlist' && sameSet(values.toolsAllowlist, READONLY_TOOLS)}
                onClick={() =>
                  setValues((v) => ({ ...v, toolsMode: 'allowlist', toolsAllowlist: [...READONLY_TOOLS] }))
                }
              >
                {t('subagentsForm.tools.readonly')}
              </ToolsModeButton>
            </div>
            {values.toolsMode === 'allowlist' ? (
              <ToolsAllowlistEditor
                value={values.toolsAllowlist}
                onChange={(tools) => setValues((v) => ({ ...v, toolsAllowlist: tools }))}
              />
            ) : null}
          </Field>

          <Field label={t('subagentsForm.label.prompt')} htmlFor="subagent-prompt">
            <textarea
              id="subagent-prompt"
              rows={6}
              className={TEXTAREA_MONO_CLASS}
              value={values.prompt}
              onChange={(e) => setValues((v) => ({ ...v, prompt: e.target.value }))}
              placeholder={t('subagentsForm.placeholder.prompt')}
            />
          </Field>

          <Field
            label={t('subagentsForm.label.idleTimeout')}
            hint={t('subagentsForm.hint.idleTimeout')}
            htmlFor="subagent-idle"
          >
            <input
              id="subagent-idle"
              type="number"
              min={1}
              max={480}
              className={INPUT_CLASS}
              value={values.idleTimeoutMinutes}
              onChange={(e) => setValues((v) => ({ ...v, idleTimeoutMinutes: e.target.value }))}
              placeholder={t('subagentsForm.placeholder.idleTimeout')}
            />
          </Field>

          <label className="flex items-center gap-sm text-sm text-fg">
            <input
              type="checkbox"
              checked={values.enabled}
              onChange={(e) => setValues((v) => ({ ...v, enabled: e.target.checked }))}
            />
            {t('subagentsForm.toggle.enabled')}
          </label>

          {error !== null ? <InlineFeedback variant="error" message={error} /> : null}

          <div className="mt-sm flex items-center justify-end gap-sm">
            <ButtonSecondary type="button" onClick={onCancel} disabled={saving}>
              {t('subagentsForm.cta.cancel')}
            </ButtonSecondary>
            <ButtonPrimary type="submit" loading={saving} loadingLabel={t('subagentsForm.cta.loading')} disabled={!canSubmit}>
              {mode === 'new' ? t('subagentsForm.cta.create') : t('subagentsForm.cta.save')}
            </ButtonPrimary>
          </div>
        </form>
      </div>
    </div>
  )
}

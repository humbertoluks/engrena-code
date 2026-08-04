import { useCallback, useState } from 'react'
import type { ReactElement } from 'react'
import { ButtonPrimary } from '../ButtonPrimary'
import { ButtonSecondary } from '../ButtonSecondary'
import type { Rule } from '../../services/rules-service'
import {
  canSubmitRuleForm,
  formatContentSize,
  isContentOverHardCap,
  isContentOverSoftWarn,
  isNameInvalid,
} from './ruleForm.logic'

const COPY = {
  titleNew: 'Nova rule',
  titleEdit: 'Editar rule',
  labelName: 'Nome',
  hintName: 'Único global, sem quebras de linha (entra no delimitador do bloco — o servidor rejeita).',
  placeholderName: 'ex.: responder-em-ptbr',
  errorNameInvalid: 'O nome não pode conter quebras de linha ou caracteres de controle.',
  labelDescription: 'Descrição',
  hintDescription: 'Opcional — só para você se lembrar do porquê.',
  placeholderDescription: 'Convenção de idioma das respostas.',
  labelCategory: 'Categoria',
  hintCategory: 'Opcional — agrupa no menu.',
  placeholderCategory: 'ex.: convenções',
  labelContent: 'Conteúdo',
  hintContent: 'Markdown. Entra inline em TODO turno dos projetos onde a rule vale — quanto menor, melhor.',
  placeholderContent: 'Responda sempre em português brasileiro.',
  warnContentLarge: (size: string) => `${size} — acima de 8 KB; rules grandes encarecem TODO turno (não bloqueia).`,
  toggleIsGlobal: 'Global (vale para todos os projetos)',
  hintIsGlobal: 'Entra em todo turno de todo projeto por padrão; dá para suprimir projeto a projeto no painel do projeto.',
  toggleEnabled: 'Habilitada (toggle global)',
  ctaCancel: 'Cancelar',
  ctaCreate: 'Criar',
  ctaSave: 'Salvar',
  ctaLoading: 'Salvando...',
  errorNetwork: 'Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução.',
  errorGeneric: 'Não foi possível salvar a rule. Tente novamente.',
  errorNameConflict: 'Já existe uma rule com este nome. Escolha outro.',
  errorContentOver: 'Conteúdo acima de 1 MiB. Reduza o tamanho para salvar.',
} as const

export interface RuleFormValues {
  name: string
  description: string | null
  category: string | null
  content: string
  isGlobal: boolean
  enabled: boolean
}

export type RuleFormSubmitResult = { ok: true } | { ok: false; code: string }

interface RuleFormModalProps {
  mode: 'new' | 'edit'
  initial: Rule | null
  onCancel: () => void
  onSubmit: (values: RuleFormValues) => Promise<RuleFormSubmitResult>
}

const LABEL_CLASS = 'text-[12px] font-semibold uppercase tracking-[0.04em] text-muted'
const INPUT_CLASS =
  'w-full rounded-sm border border-border bg-surface-2 px-md py-sm text-sm text-fg transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'
const TEXTAREA_CLASS = `${INPUT_CLASS} font-mono leading-relaxed resize-y`
const HINT_CLASS = 'text-[11.5px] text-muted'

function errorMessage(code: string): string {
  if (code === 'rule_name_conflict') return COPY.errorNameConflict
  if (code === 'too_long') return COPY.errorContentOver
  if (code === 'network') return COPY.errorNetwork
  return COPY.errorGeneric
}

export function RuleFormModal({ mode, initial, onCancel, onSubmit }: Readonly<RuleFormModalProps>): ReactElement {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [isGlobal, setIsGlobal] = useState(initial?.isGlobal ?? false)
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameInvalid = name !== '' && isNameInvalid(name)
  const contentSoftWarn = content !== '' && isContentOverSoftWarn(content) && !isContentOverHardCap(content)
  const canSubmit = canSubmitRuleForm(name, content, saving) && !isContentOverHardCap(content)

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const result = await onSubmit({
        name,
        description: description.trim() === '' ? null : description,
        category: category.trim() === '' ? null : category,
        content,
        isGlobal,
        enabled,
      })
      if (!result.ok) {
        setError(errorMessage(result.code))
        setSaving(false)
      }
    } catch {
      setError(COPY.errorNetwork)
      setSaving(false)
    }
  }, [canSubmit, onSubmit, name, description, category, content, isGlobal, enabled])

  return (
    <div className="fixed inset-0 z-50 flex place-items-center justify-center bg-black/50 p-lg">
      <div className="flex max-h-[88vh] w-full max-w-[640px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-lg shadow-lg">
        <h2 className="mb-md font-display text-[17px] font-semibold text-fg">
          {mode === 'new' ? COPY.titleNew : COPY.titleEdit}
        </h2>

        <div className="flex flex-col gap-md text-left">
          <div className="flex flex-col gap-xs">
            <label htmlFor="rule-name" className={LABEL_CLASS}>{COPY.labelName}</label>
            <input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={COPY.placeholderName}
              aria-invalid={nameInvalid || undefined}
              className={`${INPUT_CLASS} ${nameInvalid ? 'border-red focus:border-red focus:ring-red/30' : ''}`}
              disabled={saving}
            />
            {nameInvalid ? (
              <p role="alert" className="text-[11.5px] text-red">{COPY.errorNameInvalid}</p>
            ) : (
              <p className={HINT_CLASS}>{COPY.hintName}</p>
            )}
          </div>

          <div className="flex flex-col gap-xs">
            <label htmlFor="rule-description" className={LABEL_CLASS}>{COPY.labelDescription}</label>
            <input
              id="rule-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={COPY.placeholderDescription}
              className={INPUT_CLASS}
              disabled={saving}
            />
            <p className={HINT_CLASS}>{COPY.hintDescription}</p>
          </div>

          <div className="flex flex-col gap-xs">
            <label htmlFor="rule-category" className={LABEL_CLASS}>{COPY.labelCategory}</label>
            <input
              id="rule-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={COPY.placeholderCategory}
              className={INPUT_CLASS}
              disabled={saving}
            />
            <p className={HINT_CLASS}>{COPY.hintCategory}</p>
          </div>

          <div className="flex flex-col gap-xs">
            <label htmlFor="rule-content" className={LABEL_CLASS}>{COPY.labelContent}</label>
            <textarea
              id="rule-content"
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={COPY.placeholderContent}
              className={TEXTAREA_CLASS}
              disabled={saving}
            />
            {contentSoftWarn ? (
              <p className="text-[11.5px] text-amber">{COPY.warnContentLarge(formatContentSize(content))}</p>
            ) : (
              <p className={HINT_CLASS}>{COPY.hintContent}</p>
            )}
          </div>

          <label className="flex items-start gap-sm text-[13px] text-fg">
            <input
              type="checkbox"
              checked={isGlobal}
              onChange={(e) => setIsGlobal(e.target.checked)}
              disabled={saving}
              className="mt-[2px]"
            />
            <span>
              {COPY.toggleIsGlobal}
              {isGlobal ? <p className={HINT_CLASS}>{COPY.hintIsGlobal}</p> : null}
            </span>
          </label>

          <label className="flex items-center gap-sm text-[13px] text-fg">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={saving}
            />
            {COPY.toggleEnabled}
          </label>

          {error !== null ? <p role="alert" className="text-[12.5px] text-red">{error}</p> : null}

          <div className="mt-sm flex items-center justify-end gap-sm">
            <ButtonSecondary onClick={onCancel} disabled={saving}>{COPY.ctaCancel}</ButtonSecondary>
            <ButtonPrimary
              loading={saving}
              loadingLabel={COPY.ctaLoading}
              disabled={!canSubmit}
              onClick={() => { void handleSubmit() }}
            >
              {mode === 'new' ? COPY.ctaCreate : COPY.ctaSave}
            </ButtonPrimary>
          </div>
        </div>
      </div>
    </div>
  )
}

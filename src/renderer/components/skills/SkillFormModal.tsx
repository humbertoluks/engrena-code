import { useCallback, useState } from 'react'
import type { ReactElement } from 'react'
import { ButtonPrimary } from '../ButtonPrimary'
import { ButtonSecondary } from '../ButtonSecondary'
import type { Skill } from '../../services/skills-service'
import {
  canSubmitSkillForm,
  formatContentSize,
  isContentOverLimit,
  isDescriptionLong,
} from './skillForm.logic'

const COPY = {
  titleNew: 'Nova skill',
  titleEdit: 'Editar skill',
  labelName: 'Nome',
  hintName: 'Chave de invocação, única global.',
  placeholderName: 'ex.: convencoes-de-commit',
  labelDescription: 'Descrição',
  hintDescription:
    'O "quando usar" — é o que o modelo lê para decidir carregar a skill. Curta e específica (sugestão: até ~200 caracteres).',
  placeholderDescription: 'Use ao escrever mensagens de commit neste repositório.',
  warnDescriptionLong: (n: number) =>
    `${n} caracteres — descrições longas encarecem o catálogo em todo turno (não bloqueia).`,
  labelCategory: 'Categoria',
  hintCategory: 'Opcional — agrupa no menu.',
  placeholderCategory: 'ex.: convenções',
  labelContent: 'Conteúdo',
  hintContent:
    'Markdown. O conteúdo inteiro entra no contexto quando o agente carrega a skill. Teto prático: ~1 MiB.',
  placeholderContent: '# Minha skill\n\nInstruções, convenções ou conhecimento de domínio...',
  metaContentOver: (size: string) => `${size} — acima do teto de ~1 MiB do servidor.`,
  toggleEnabled: 'Habilitada (toggle global)',
  ctaCancel: 'Cancelar',
  ctaCreate: 'Criar',
  ctaSave: 'Salvar',
  ctaLoading: 'Salvando...',
} as const

const LABEL_CLASS = 'text-[12px] font-semibold uppercase tracking-[0.04em] text-muted'
const INPUT_CLASS =
  'w-full rounded-sm border border-border bg-surface-2 px-md py-sm text-sm text-fg transition-colors placeholder:text-muted focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent'
const TEXTAREA_CLASS = `${INPUT_CLASS} font-mono leading-relaxed resize-y`
const HINT_CLASS = 'text-[11.5px] text-muted'

export interface SkillFormSubmitInput {
  name: string
  description: string
  category: string | null
  content: string
  enabled: boolean
}

interface SkillFormModalProps {
  skill: Skill | null
  saving: boolean
  errorMessage: string | null
  onSubmit: (input: SkillFormSubmitInput) => void
  onCancel: () => void
}

export function SkillFormModal({
  skill,
  saving,
  errorMessage,
  onSubmit,
  onCancel,
}: Readonly<SkillFormModalProps>): ReactElement {
  const isEdit = skill !== null
  const [name, setName] = useState(skill?.name ?? '')
  const [description, setDescription] = useState(skill?.description ?? '')
  const [category, setCategory] = useState(skill?.category ?? '')
  const [content, setContent] = useState(skill?.content ?? '')
  const [enabled, setEnabled] = useState(skill?.enabled ?? true)

  const contentOver = isContentOverLimit(content)
  const descriptionLong = isDescriptionLong(description)
  const canSubmit = canSubmitSkillForm({ name, description, content }, saving)

  const handleSubmit = useCallback((): void => {
    if (!canSubmit) return
    onSubmit({
      name,
      description,
      category: category.trim() === '' ? null : category,
      content,
      enabled,
    })
  }, [canSubmit, name, description, category, content, enabled, onSubmit])

  return (
    <div className="fixed inset-0 z-50 flex place-items-center justify-center bg-black/50 px-md">
      <div className="flex max-h-[88vh] w-full max-w-[640px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-lg shadow-lg">
        <h2 className="mb-md text-[17px] font-semibold text-fg">
          {isEdit ? COPY.titleEdit : COPY.titleNew}
        </h2>

        <div className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label htmlFor="skill-name" className={LABEL_CLASS}>{COPY.labelName}</label>
            <input
              id="skill-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={COPY.placeholderName}
              disabled={saving}
              className={INPUT_CLASS}
              autoComplete="off"
            />
            <span className={HINT_CLASS}>{COPY.hintName}</span>
          </div>

          <div className="flex flex-col gap-xs">
            <label htmlFor="skill-description" className={LABEL_CLASS}>{COPY.labelDescription}</label>
            <textarea
              id="skill-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={COPY.placeholderDescription}
              disabled={saving}
              className={TEXTAREA_CLASS}
            />
            <span className={HINT_CLASS}>{COPY.hintDescription}</span>
            {descriptionLong ? (
              <span className="text-[11.5px] text-amber">
                {COPY.warnDescriptionLong(description.length)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-xs">
            <label htmlFor="skill-category" className={LABEL_CLASS}>{COPY.labelCategory}</label>
            <input
              id="skill-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={COPY.placeholderCategory}
              disabled={saving}
              className={INPUT_CLASS}
              autoComplete="off"
            />
            <span className={HINT_CLASS}>{COPY.hintCategory}</span>
          </div>

          <div className="flex flex-col gap-xs">
            <label htmlFor="skill-content" className={LABEL_CLASS}>{COPY.labelContent}</label>
            <textarea
              id="skill-content"
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={COPY.placeholderContent}
              disabled={saving}
              className={TEXTAREA_CLASS}
            />
            <span className={HINT_CLASS}>{COPY.hintContent}</span>
            <span className={`font-mono text-[11.5px] ${contentOver ? 'text-red' : 'text-muted'}`}>
              {contentOver ? COPY.metaContentOver(formatContentSize(content)) : formatContentSize(content)}
            </span>
          </div>

          <label className="flex items-center gap-sm text-[13px] text-fg">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={saving}
            />
            {COPY.toggleEnabled}
          </label>

          {errorMessage !== null ? (
            <p role="alert" className="text-[12.5px] text-red">{errorMessage}</p>
          ) : null}
        </div>

        <div className="mt-lg flex items-center justify-end gap-sm">
          <ButtonSecondary disabled={saving} onClick={onCancel}>
            {COPY.ctaCancel}
          </ButtonSecondary>
          <ButtonPrimary
            loading={saving}
            loadingLabel={COPY.ctaLoading}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {isEdit ? COPY.ctaSave : COPY.ctaCreate}
          </ButtonPrimary>
        </div>
      </div>
    </div>
  )
}

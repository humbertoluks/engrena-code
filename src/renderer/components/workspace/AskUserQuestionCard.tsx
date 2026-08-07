import { useState, type ReactElement } from 'react'
import { validateAnswer } from './askUserQuestion.logic'

/**
 * Card inline `ask_user_question` (F21) — só o contrato de props desta spec.tsx.
 * Anatomia final, tokens e copy ficam pendentes de `docs/F21-askuserquestion/ui.md`/`copy.md`
 * (spec F21 §4/§3.3); este componente cobre o comportamento (seleção, texto livre, bloqueio de
 * envio) sem inventar o visual definitivo.
 */
export interface AskUserQuestionCardProps {
  prompt: string
  options: string[]
  multiSelect: boolean
  busy?: boolean
  onAnswer: (input: { selectedOptions: string[]; freeText: string | null }) => void
}

export function AskUserQuestionCard({
  prompt,
  options,
  multiSelect,
  busy = false,
  onAnswer,
}: Readonly<AskUserQuestionCardProps>): ReactElement {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [freeText, setFreeText] = useState('')

  function toggleOption(option: string): void {
    setSelectedOptions((prev) => {
      if (!multiSelect) return prev.includes(option) ? [] : [option]
      return prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    })
  }

  function submit(): void {
    if (!validateAnswer(selectedOptions, freeText) || busy) return
    onAnswer({ selectedOptions, freeText: freeText.trim() || null })
  }

  const canSubmit = validateAnswer(selectedOptions, freeText) && !busy

  return (
    <div className="self-start w-full max-w-[42rem] rounded-lg border border-border bg-surface-2 p-sm text-[13px]">
      <p className="mb-xs text-fg">{prompt}</p>

      {options.length > 0 ? (
        <div className="mb-xs flex flex-wrap gap-xs">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={busy}
              onClick={() => toggleOption(option)}
              aria-pressed={selectedOptions.includes(option)}
              className={`rounded-md border px-sm py-[3px] text-[12px] ${
                selectedOptions.includes(option)
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border text-muted hover:text-fg'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}

      <textarea
        value={freeText}
        disabled={busy}
        onChange={(e) => setFreeText(e.target.value)}
        placeholder="Outra…"
        rows={2}
        className="mb-xs w-full resize-none rounded-md border border-border bg-surface px-sm py-xs text-[12px] text-fg"
      />

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="rounded-md bg-accent px-sm py-xs text-[12px] font-medium text-white disabled:opacity-50"
      >
        Enviar
      </button>
    </div>
  )
}

import { useState, type ReactElement } from 'react'
import { submitsOnOptionClick, validateAnswer } from './askUserQuestion.logic'

const COPY = {
  header: 'O agente precisa da sua resposta',
  hintSingle: 'Escolha uma opção',
  hintSingleOneClick: 'Escolha uma opção — o clique já envia',
  hintMulti: 'Escolha uma ou mais opções',
  freeTextPlaceholder: 'Outra…',
  blocked: 'Marque uma opção ou escreva uma resposta.',
  ctaSend: 'Enviar',
  ctaSending: 'Enviando…',
} as const

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/**
 * Card inline `ask_user_question` (F21) — anatomia, tokens e copy conforme
 * `docs/F21-askuserquestion/ui.md` e `copy.md`. Card inline (não modal como a fonte)
 * porque `waiting_user` deixa o resto do app usável.
 */
export interface AskUserQuestionCardProps {
  prompt: string
  options: string[]
  multiSelect: boolean
  busy?: boolean
  /** Mensagem de falha do `POST /answer`; seleções são preservadas para nova tentativa. */
  error?: string | null
  onAnswer: (input: { selectedOptions: string[]; freeText: string | null }) => void
}

export function AskUserQuestionCard({
  prompt,
  options,
  multiSelect,
  busy = false,
  error = null,
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

  const answerable = validateAnswer(selectedOptions, freeText)
  const canSubmit = answerable && !busy
  const oneClick = submitsOnOptionClick(multiSelect, freeText)

  function submit(): void {
    if (!canSubmit) return
    onAnswer({ selectedOptions, freeText: freeText.trim() || null })
  }

  /** Escolha única sem texto livre: o clique é a resposta. Marca antes de enviar para o botão
   *  ficar aceso enquanto o `busy` do envio chega. */
  function pickOption(option: string): void {
    if (busy) return
    if (!oneClick) {
      toggleOption(option)
      return
    }
    setSelectedOptions([option])
    onAnswer({ selectedOptions: [option], freeText: null })
  }

  return (
    <div className="self-start w-full max-w-[42rem] rounded-lg border border-border bg-surface-2 p-sm text-[13px]">
      <p className="mb-[2px] text-[10px] uppercase tracking-wide text-muted">{COPY.header}</p>
      <p className="text-fg">{prompt}</p>

      {options.length > 0 ? (
        <>
          <p className="mt-xs text-[11px] text-muted">
            {multiSelect ? COPY.hintMulti : oneClick ? COPY.hintSingleOneClick : COPY.hintSingle}
          </p>
          <div className="mt-xs mb-xs flex flex-wrap gap-xs">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={busy}
                onClick={() => pickOption(option)}
                aria-pressed={selectedOptions.includes(option)}
                className={`rounded-md border px-sm py-[3px] text-[12px] disabled:opacity-50 ${FOCUS_RING} ${
                  selectedOptions.includes(option)
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border text-muted hover:text-fg'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <textarea
        value={freeText}
        disabled={busy}
        onChange={(e) => setFreeText(e.target.value)}
        placeholder={COPY.freeTextPlaceholder}
        rows={2}
        className={`mt-xs mb-xs w-full resize-none rounded-md border border-border bg-surface px-sm py-xs text-[12px] text-fg disabled:opacity-50 ${FOCUS_RING}`}
      />

      <div className="flex items-center justify-between gap-sm">
        <span className="text-[11px] text-muted">{answerable ? '' : COPY.blocked}</span>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className={`rounded-md bg-accent px-sm py-xs text-[12px] font-medium text-white disabled:opacity-50 ${FOCUS_RING}`}
        >
          {busy ? COPY.ctaSending : COPY.ctaSend}
        </button>
      </div>

      {error !== null ? (
        <p role="alert" className="mt-xs text-[11.5px] text-red">
          {error}
        </p>
      ) : null}
    </div>
  )
}

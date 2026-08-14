import { useState, type ReactElement } from 'react'
import { questionFromGate, type ThreadGate } from '../../hooks/threadGate.logic'

const COPY = {
  header: 'O agente precisa da sua resposta',
  hint: 'Escolher aqui preenche o composer — digite a resposta ou envie a opção com Enviar.',
  hintMulti: 'Escolha uma ou mais opções — a seleção vai para o composer; envie com Enviar.',
} as const

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const CHIP = `rounded-md border px-sm py-[3px] text-[12px] disabled:opacity-50 ${FOCUS_RING}`

/**
 * Card inline `ask_user_question` (F21) — só pergunta + chips na timeline.
 *
 * Sem textarea nem Enviar no card: o contrato é o mesmo do PermissionPrompt (opção → composer
 * principal → Enviar). Um segundo campo no prompt fazia o usuário achar que o clique já respondia,
 * e o texto ia parar no composer sem o CTA certo.
 */
export interface AskUserQuestionCardProps {
  /**
   * O gate que este card representa. É o `gateId` dele que vai no `POST /gate/:gateId/resolve` —
   * o que está em tela é o que o Enviar responde, e não mais "a pergunta aberta mais recente".
   */
  gate: ThreadGate
  busy?: boolean
  /** Mensagem de falha da resolução (quando o Enviar do composer falha). */
  error?: string | null
  /** Clique numa opção: preenche o composer principal (envio via Enviar). */
  onPickOption: (option: string) => void
}

export function AskUserQuestionCard({
  gate,
  busy = false,
  error = null,
  onPickOption,
}: Readonly<AskUserQuestionCardProps>): ReactElement {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const { prompt, options, multiSelect } = questionFromGate(gate) ?? {
    prompt: '',
    options: [],
    multiSelect: false,
  }

  function pickOption(option: string): void {
    if (busy) return
    if (!multiSelect) {
      onPickOption(option)
      return
    }
    setSelectedOptions((prev) => {
      const next = prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
      onPickOption(next.join(', '))
      return next
    })
  }

  return (
    <div className="mb-md w-full max-w-[42rem] self-start rounded-lg border border-border bg-surface-2 p-sm text-[13px]">
      <p className="mb-[2px] text-[10px] uppercase tracking-wide text-muted">{COPY.header}</p>
      <p className="text-fg">{prompt}</p>

      {options.length > 0 ? (
        <>
          <p className="mt-xs text-[11px] text-muted">{multiSelect ? COPY.hintMulti : COPY.hint}</p>
          <div className="mt-xs flex flex-wrap gap-xs">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={busy}
                onClick={() => pickOption(option)}
                aria-pressed={multiSelect ? selectedOptions.includes(option) : undefined}
                className={`${CHIP} ${
                  multiSelect && selectedOptions.includes(option)
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border text-muted hover:text-fg'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-xs text-[11px] text-muted">{COPY.hint}</p>
      )}

      {error !== null ? (
        <p role="alert" className="mt-xs text-[11.5px] text-red">
          {error}
        </p>
      ) : null}
    </div>
  )
}

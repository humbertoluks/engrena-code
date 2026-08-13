import type { ReactElement } from 'react'
import {
  PERMISSION_COMPOSER_ALLOW,
  PERMISSION_COMPOSER_ALLOW_ALL,
  PERMISSION_COMPOSER_ALLOW_PROJECT,
  PERMISSION_COMPOSER_DENY,
} from './permissionComposer.logic'

const COPY = {
  header: 'O agente precisa de permissão',
  title: (toolName: string) => `Permitir a ferramenta ${toolName}?`,
  queue: (n: number) => `+${n} na fila`,
  labelParams: 'Parâmetros',
  hint: 'Escolher aqui preenche o composer — envie (ou digite sim/não/permitir todos) para conceder.',
  allowAllHint: 'Não perguntar de novo por esta ferramenta nesta thread (padrão Claude Code).',
  allowProjectTitle: 'Não perguntar mais por esta ferramenta neste projeto, mesmo depois de reiniciar',
} as const

const CHIP = 'rounded-md border px-sm py-[3px] text-[12px] transition-colors'
const CHIP_QUIET = `${CHIP} border-border text-muted hover:text-fg`
const CHIP_PRIMARY = `${CHIP} border-accent/60 bg-accent/10 text-fg hover:bg-accent/20`

export interface PermissionPromptProps {
  toolName: string
  params: unknown
  queuedCount: number
  /** Preenche o composer com a decisão — a concessão real é o Enviar (ou o texto digitado). */
  onDecide: (text: string) => void
}

/**
 * Pedido de permissão como card inline da timeline (não modal): o pedido nasce no meio do turno e
 * pertence à conversa. Como modal fora do chat ele tapava a resposta em andamento e passava a ideia
 * de que só o botão concedia — o contrato é opção → composer → Enviar, igual ao `AskUserQuestionCard`.
 */
export function PermissionPrompt({
  toolName,
  params,
  queuedCount,
  onDecide,
}: Readonly<PermissionPromptProps>): ReactElement {
  return (
    <div className="mb-md w-full max-w-[42rem] self-start rounded-lg border border-accent/40 bg-surface-2 p-sm text-[13px]">
      <div className="mb-[2px] flex items-center justify-between gap-sm">
        <p className="text-[10px] uppercase tracking-wide text-muted">{COPY.header}</p>
        {queuedCount > 0 ? <span className="text-[10.5px] text-muted">{COPY.queue(queuedCount)}</span> : null}
      </div>

      <p className="text-fg">{COPY.title(toolName)}</p>

      <details className="mt-xs">
        <summary className="cursor-pointer list-none text-[11px] text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
          {COPY.labelParams}
        </summary>
        <pre className="mt-xs max-h-[12rem] overflow-auto rounded-md bg-surface p-sm text-[11px] leading-relaxed text-fg">
          {JSON.stringify(params, null, 2)}
        </pre>
      </details>

      <p className="mt-xs text-[11px] text-muted">{COPY.hint}</p>

      <div className="mt-xs flex flex-wrap gap-xs">
        <button type="button" onClick={() => onDecide(PERMISSION_COMPOSER_ALLOW)} className={CHIP_PRIMARY}>
          {PERMISSION_COMPOSER_ALLOW}
        </button>
        <button
          type="button"
          title={COPY.allowAllHint}
          onClick={() => onDecide(PERMISSION_COMPOSER_ALLOW_ALL)}
          className={CHIP_QUIET}
        >
          {PERMISSION_COMPOSER_ALLOW_ALL}
        </button>
        <button
          type="button"
          title={COPY.allowProjectTitle}
          onClick={() => onDecide(PERMISSION_COMPOSER_ALLOW_PROJECT)}
          className={CHIP_QUIET}
        >
          {PERMISSION_COMPOSER_ALLOW_PROJECT}
        </button>
        <button type="button" onClick={() => onDecide(PERMISSION_COMPOSER_DENY)} className={CHIP_QUIET}>
          {PERMISSION_COMPOSER_DENY}
        </button>
      </div>
    </div>
  )
}

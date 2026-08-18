import type { ReactElement } from 'react'
import { permissionFromGate, type ThreadGate } from '../../hooks/threadGate.logic'
import { PERMISSION_CHIPS, type PermissionDecisionKind } from './permissionComposer.logic'

const COPY = {
  header: 'O agente precisa de permissão',
  title: (toolName: string) => `Permitir a ferramenta ${toolName}?`,
  queue: (n: number) => `+${n} na fila`,
  labelParams: 'Parâmetros',
  hint: 'Escolher aqui concede na hora — ou digite sim/não/permitir todos e envie.',
  allowAllHint: 'Não perguntar de novo por esta ferramenta nesta thread (padrão Claude Code).',
  allowProjectTitle: 'Não perguntar mais por esta ferramenta neste projeto, mesmo depois de reiniciar',
} as const

/** Ajuda por chip — só os dois que persistem escolha além deste pedido a têm. */
const CHIP_TITLE: Partial<Record<PermissionDecisionKind, string>> = {
  allow_always: COPY.allowAllHint,
  allow_project: COPY.allowProjectTitle,
}

const CHIP =
  'rounded-md border px-sm py-[3px] text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-50'
const CHIP_QUIET = `${CHIP} border-border text-muted hover:text-fg`
const CHIP_PRIMARY = `${CHIP} border-accent/60 bg-accent/10 text-fg hover:bg-accent/20`

export interface PermissionPromptProps {
  /**
   * O gate que este card representa. O card carrega o `gateId` porque é ele quem vai no
   * `POST /gate/:gateId/resolve`: o que está em tela é exatamente o que o clique resolve — nunca
   * "o pedido mais recente da thread".
   */
  gate: ThreadGate
  queuedCount: number
  /** Concede/nega **na hora**, sem passar pelo composer. Não toca no rascunho digitado. */
  onResolve: (kind: PermissionDecisionKind) => void
  /** Resolução em voo (`gateApi.busy`): trava o duplo clique nos chips. */
  busy?: boolean
  /** Falha da resolução: o card continua enquanto o POST não sucede. */
  error?: string | null
}

/**
 * Pedido de permissão como card inline da timeline (não modal): o pedido nasce no meio do turno e
 * pertence à conversa. Como modal fora do chat ele tapava a resposta em andamento.
 *
 * O chip decide direto, sem escala pelo composer — é o gesto do Claude Code e do Cursor, e um
 * clique a menos num ponto onde o turno está parado esperando. Quem prefere digitar continua
 * atendido: `sim` / `não` / `permitir todos` no composer chegam ao mesmo `PermissionDecisionKind`
 * (`interpretPermissionChatReply`) e à mesma resolução. Clicar aqui **não** mexe no rascunho — a
 * mensagem que estava sendo escrita para a fila continua onde estava.
 */
export function PermissionPrompt({
  gate,
  queuedCount,
  onResolve,
  busy = false,
  error = null,
}: Readonly<PermissionPromptProps>): ReactElement {
  const { toolName, params } = permissionFromGate(gate) ?? { toolName: 'unknown', params: gate.payload }
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
        {PERMISSION_CHIPS.map((chip) => (
          <button
            key={chip.kind}
            type="button"
            title={CHIP_TITLE[chip.kind]}
            disabled={busy}
            onClick={() => onResolve(chip.kind)}
            className={chip.kind === 'allow' ? CHIP_PRIMARY : CHIP_QUIET}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {error !== null ? (
        <p role="alert" className="mt-xs text-[11.5px] text-red">
          {error}
        </p>
      ) : null}
    </div>
  )
}

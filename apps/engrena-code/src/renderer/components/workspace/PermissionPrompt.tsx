import type { ReactElement } from 'react'
import { permissionFromGate, type ThreadGate } from '../../hooks/threadGate.logic'
import { commandScope } from '../../../services/runner/bash-command-scope'
import { PERMISSION_CHIPS, type PermissionDecisionKind } from './permissionComposer.logic'

const COPY = {
  header: 'O agente precisa de permissão',
  title: (toolName: string) => `Permitir a ferramenta ${toolName}?`,
  queue: (n: number) => `+${n} na fila`,
  labelParams: 'Parâmetros',
  hint: 'Escolher aqui concede na hora — ou digite sim/não/permitir todos e envie.',
  allowAllHint: (target: string) => `Não perguntar de novo por ${target} nesta thread.`,
  allowProjectTitle: (target: string) =>
    `Não perguntar mais por ${target} neste projeto, mesmo depois de reiniciar.`,
  /** Rodapé só quando a concessão é mais estreita que "a ferramenta inteira". */
  scopeNote: (verbs: string) => `"Permitir todos" libera ${verbs} — os demais comandos seguem perguntando.`,
} as const

/**
 * O que os dois chips persistentes concedem, em português.
 *
 * Não é enfeite: a allowlist grava por verbo do comando quando dá (`Bash(git *)`), e prometer "esta
 * ferramenta" quando o que se libera é `git` — ou o contrário — é o tipo de mentira que faz o
 * usuário conceder mais do que pretendia.
 */
function grantTarget(toolName: string, verbs: readonly string[]): string {
  if (verbs.length === 0) return `a ferramenta ${toolName}`
  if (verbs.length === 1) return `\`${verbs[0]}\``
  return verbs.map((v) => `\`${v}\``).join(', ')
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
  // Mesma função que o broker usa para gravar a allowlist — o card promete exatamente o que o
  // clique vai conceder, nem mais nem menos.
  const { verbs } = commandScope(toolName, params)
  const target = grantTarget(toolName, verbs)
  const chipTitle: Partial<Record<PermissionDecisionKind, string>> = {
    allow_always: COPY.allowAllHint(target),
    allow_project: COPY.allowProjectTitle(target),
  }
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
            title={chipTitle[chip.kind]}
            disabled={busy}
            onClick={() => onResolve(chip.kind)}
            className={chip.kind === 'allow' ? CHIP_PRIMARY : CHIP_QUIET}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {verbs.length > 0 ? (
        <p className="mt-xs text-[11px] text-muted">{COPY.scopeNote(target)}</p>
      ) : null}

      {error !== null ? (
        <p role="alert" className="mt-xs text-[11.5px] text-red">
          {error}
        </p>
      ) : null}
    </div>
  )
}

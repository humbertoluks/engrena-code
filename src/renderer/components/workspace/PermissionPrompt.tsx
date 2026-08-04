import type { ReactElement } from 'react'

const COPY = {
  title: (toolName: string) => `Permitir a ferramenta ${toolName}?`,
  queue: (n: number) => `+${n} na fila`,
  labelTool: 'Ferramenta',
  labelParams: 'Parâmetros',
  deny: 'Negar',
  allow: 'Permitir',
} as const

export interface PermissionPromptProps {
  toolName: string
  params: unknown
  queuedCount: number
  onAllow: () => void
  onDeny: () => void
}

export function PermissionPrompt({ toolName, params, queuedCount, onAllow, onDeny }: Readonly<PermissionPromptProps>): ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-lg"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDeny()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDeny()
      }}
      role="presentation"
    >
      <div className="w-full max-w-[26rem] rounded-lg border border-border bg-surface p-lg shadow-lg">
        <div className="mb-sm flex items-center justify-between">
          <h2 className="font-display text-[15px] font-semibold">{COPY.title(toolName)}</h2>
          {queuedCount > 0 ? <span className="text-[11px] text-muted">{COPY.queue(queuedCount)}</span> : null}
        </div>

        <p className="mb-[2px] text-[11px] font-medium uppercase tracking-wide text-muted">{COPY.labelTool}</p>
        <p className="mb-sm font-mono text-[13px] text-fg">{toolName}</p>

        <p className="mb-[2px] text-[11px] font-medium uppercase tracking-wide text-muted">{COPY.labelParams}</p>
        <pre className="mb-lg max-h-[12rem] overflow-auto rounded-md bg-surface-2 p-sm text-[11px] text-fg">
          {JSON.stringify(params, null, 2)}
        </pre>

        <div className="flex justify-end gap-xs">
          <button
            type="button"
            onClick={onDeny}
            className="rounded-md border border-border bg-surface-2 px-md py-xs text-[13px] hover:bg-surface"
          >
            {COPY.deny}
          </button>
          <button type="button" onClick={onAllow} className="rounded-md bg-accent px-md py-xs text-[13px] font-medium text-white">
            {COPY.allow}
          </button>
        </div>
      </div>
    </div>
  )
}

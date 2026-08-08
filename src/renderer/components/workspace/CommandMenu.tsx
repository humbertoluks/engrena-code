import type { ReactElement } from 'react'
import type { SlashCommandName } from '../../../services/runner/slash-commands.js'
import { matchSlashCommands } from './commandTrigger.js'

const COPY = {
  aria: 'Comandos',
  empty: 'Nenhum comando',
  spec: '/spec',
  specDesc: 'Gera spec.md + plan.md como texto estruturado na thread (não grava ficheiro).',
  featdevelop: '/featdevelop',
  featdevelopDesc: 'Orquestra planner → implementer → reviewer → tester com checkpoint antes de aplicar diffs.',
  featbuild: '/featbuild',
  featbuildDesc: 'Executa um plano já aprovado (markdown) sem replanejar; checkpoints de diff F03.',
} as const

const COMMAND_LABEL: Record<SlashCommandName, string> = {
  spec: COPY.spec,
  featdevelop: COPY.featdevelop,
  featbuild: COPY.featbuild,
}

const COMMAND_DESC: Record<SlashCommandName, string> = {
  spec: COPY.specDesc,
  featdevelop: COPY.featdevelopDesc,
  featbuild: COPY.featbuildDesc,
}

export interface CommandMenuProps {
  query: string
  onSelect: (name: SlashCommandName) => void
}

export function CommandMenu({ query, onSelect }: Readonly<CommandMenuProps>): ReactElement {
  const matches = matchSlashCommands(query)

  return (
    <div
      role="listbox"
      aria-label={COPY.aria}
      className="absolute bottom-[calc(100%+6px)] left-0 z-50 max-h-[260px] w-[min(420px,92vw)] overflow-y-auto rounded-lg border border-border bg-surface p-xs shadow-lg"
    >
      {matches.length === 0 ? (
        <p className="px-sm py-[10px] text-[12px] text-muted">{COPY.empty}</p>
      ) : (
        matches.map((name) => (
          <button
            key={name}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(name)
            }}
            className="flex w-full items-center gap-xs rounded-md px-sm py-[6px] text-left text-[12.5px] hover:bg-accent/15 focus-visible:bg-accent/15 focus-visible:outline-none"
          >
            <span className="font-mono font-medium text-fg">{COMMAND_LABEL[name]}</span>
            <span className="truncate text-muted"> — {COMMAND_DESC[name]}</span>
          </button>
        ))
      )}
    </div>
  )
}

import type { ReactElement } from 'react'
import type { SlashCommandName } from '../../../services/runner/slash-commands.js'
import type { SavedPromptItem } from '../../services/prompt-library-service'
import { matchSavedPromptNames, matchSlashCommands } from './commandTrigger.js'

const COPY = {
  aria: 'Comandos',
  empty: 'Nenhum comando',
  commandsGroup: 'Comandos',
  promptsGroup: 'Prompts salvos',
  fromRepo: 'do repositório',
  removePrompt: 'Remover prompt salvo',
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
  /** Prompts salvos do projeto (F28 §3.4) — dividem o mesmo menu `/` com os comandos. */
  prompts?: readonly SavedPromptItem[]
  onSelectPrompt?: (prompt: SavedPromptItem) => void
  onDeletePrompt?: (id: string) => void
}

export function CommandMenu({
  query,
  onSelect,
  prompts = [],
  onSelectPrompt,
  onDeletePrompt,
}: Readonly<CommandMenuProps>): ReactElement {
  const matches = matchSlashCommands(query)
  const promptNames = matchSavedPromptNames(
    query,
    prompts.map((p) => p.name)
  )
  const matchedPrompts = prompts.filter((p) => promptNames.includes(p.name))

  return (
    <div
      role="listbox"
      aria-label={COPY.aria}
      className="absolute bottom-[calc(100%+6px)] left-0 z-50 max-h-[260px] w-[min(420px,92vw)] overflow-y-auto rounded-lg border border-border bg-surface p-xs shadow-lg"
    >
      {matches.length === 0 && matchedPrompts.length === 0 ? (
        <p className="px-sm py-[10px] text-[12px] text-muted">{COPY.empty}</p>
      ) : null}

      {matches.length > 0 ? (
        <>
          <p className="px-sm py-[2px] text-[10px] uppercase tracking-wide text-muted">{COPY.commandsGroup}</p>
          {matches.map((name) => (
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
          ))}
        </>
      ) : null}

      {matchedPrompts.length > 0 ? (
        <>
          <p className="mt-xs px-sm py-[2px] text-[10px] uppercase tracking-wide text-muted">{COPY.promptsGroup}</p>
          {matchedPrompts.map((prompt) => (
            <div
              key={prompt.file ?? prompt.id}
              className="group/prompt flex w-full items-center gap-xs rounded-md hover:bg-accent/15"
            >
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelectPrompt?.(prompt)
                }}
                className="flex min-w-0 flex-1 items-center gap-xs px-sm py-[6px] text-left text-[12.5px] focus-visible:outline-none"
              >
                <span className="font-mono font-medium text-fg">/{prompt.name}</span>
                <span className="truncate text-muted">
                  {prompt.description !== '' ? ` — ${prompt.description}` : ''}
                  {prompt.source === 'file' ? ` (${COPY.fromRepo})` : ''}
                </span>
              </button>
              {prompt.source === 'db' && prompt.id !== null && onDeletePrompt ? (
                <button
                  type="button"
                  aria-label={`${COPY.removePrompt}: ${prompt.name}`}
                  title={COPY.removePrompt}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onDeletePrompt(prompt.id as string)
                  }}
                  className="mr-xs shrink-0 rounded-md px-xs py-[2px] text-[12px] text-muted opacity-0 hover:text-red group-focus-within/prompt:opacity-100 group-hover/prompt:opacity-100"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </>
      ) : null}
    </div>
  )
}

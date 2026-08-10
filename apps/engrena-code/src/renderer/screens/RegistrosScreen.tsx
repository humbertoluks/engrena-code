import type { ReactElement } from 'react'
import { LogTable } from '../components/LogTable'

const COPY = {
  title: 'Registros',
  subtitle: 'Histórico persistido localmente (better-sqlite3) de tasks, tool calls e eventos de git flow por thread.',
} as const

export function RegistrosScreen(): ReactElement {
  return (
    <main className="mx-auto w-full max-w-[1080px] px-lg py-xl">
      <h1 className="font-display text-[21px] font-semibold tracking-tight text-fg">{COPY.title}</h1>
      <p className="mt-xs text-[13.5px] text-muted">{COPY.subtitle}</p>

      <div className="mt-md">
        <LogTable />
      </div>
    </main>
  )
}

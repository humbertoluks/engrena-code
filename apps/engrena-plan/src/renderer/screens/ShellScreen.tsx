/**
 * Shell vazio pós-unlock — domínio Plan ainda fora de escopo (S4).
 */
import type { ReactElement } from 'react'
import { ThemeControl } from '@engrena/ui'
import { BrandMark, BrandWordmark } from '../components/BrandMark'

export function ShellScreen(): ReactElement {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="flex items-center justify-between border-b border-border bg-surface px-lg py-sm">
        <div className="flex items-center gap-sm">
          <BrandMark size={22} />
          <BrandWordmark className="font-display text-[15px] font-semibold tracking-tight" />
        </div>
        <ThemeControl />
      </header>
      <main className="grid flex-1 place-items-center p-lg">
        <div className="max-w-[28rem] text-center">
          <h1 className="mb-sm font-display text-xl font-semibold tracking-tight">Shell vazio</h1>
          <p className="text-sm leading-relaxed text-muted">
            EngrenaPlan está no ar com vault, HTTP loopback e SQLite. Discovery, PRD, Spec e Plano
            entram em ondas futuras — sem domínio aqui neste scaffold.
          </p>
        </div>
      </main>
    </div>
  )
}

import { existsSync } from 'fs'
import { join } from 'path'

/** Resolve o shell padrão do SO (F26 spec §3.2). Windows: `COMSPEC`/`cmd.exe`; POSIX: `SHELL`/`/bin/bash`. */
export interface ShellResolution {
  shell: string
}

export class ShellNotFoundError extends Error {
  code = 'shell_not_found' as const

  constructor() {
    super('Nenhum shell padrão encontrado no sistema.')
  }
}

function windowsCmdFallback(): string {
  return join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cmd.exe')
}

export function resolveShell(platform: NodeJS.Platform = process.platform): ShellResolution {
  if (platform === 'win32') {
    const comspec = process.env.COMSPEC
    if (comspec && existsSync(comspec)) return { shell: comspec }

    const fallback = windowsCmdFallback()
    if (existsSync(fallback)) return { shell: fallback }

    throw new ShellNotFoundError()
  }

  const shellEnv = process.env.SHELL
  if (shellEnv && existsSync(shellEnv)) return { shell: shellEnv }

  if (existsSync('/bin/bash')) return { shell: '/bin/bash' }

  throw new ShellNotFoundError()
}

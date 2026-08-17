/**
 * Kill a process tree by PID — never by process name.
 *
 * Windows: `taskkill /PID <pid> /T /F` (tree + force).
 * POSIX detached: `kill(-pid, SIGKILL)` (process group).
 * POSIX non-detached: walk children via `pgrep -P`, SIGKILL leaves then root.
 *
 * CLAUDE.md: never `Stop-Process -Name node` / `pkill node` — orphans and kills Engrena itself.
 */

import { execFileSync } from 'node:child_process'

export type ExecFileSyncFn = (
  file: string,
  args: readonly string[],
  options?: {
    windowsHide?: boolean
    stdio?: 'ignore' | 'pipe'
    timeout?: number
    encoding?: BufferEncoding
  }
) => Buffer | string

export type ProcessKillFn = (pid: number, signal?: NodeJS.Signals | number) => void

export interface KillProcessTreeOptions {
  pid: number
  platform?: NodeJS.Platform
  /** True when the root was spawned with `detached: true` (own process group). */
  detached?: boolean
  execFileSync?: ExecFileSyncFn
  processKill?: ProcessKillFn
}

function parsePids(stdout: string): number[] {
  return stdout
    .split(/\s+/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0)
}

function listDirectChildren(pid: number, execSync: ExecFileSyncFn): number[] {
  try {
    const out = execSync('pgrep', ['-P', String(pid)], {
      stdio: 'pipe',
      timeout: 5_000,
      encoding: 'utf8',
    })
    const text = typeof out === 'string' ? out : out.toString('utf8')
    return parsePids(text)
  } catch {
    return []
  }
}

/** Depth-first: deepest descendants first, then closer children (safe kill order). */
function collectDescendants(pid: number, execSync: ExecFileSyncFn): number[] {
  const children = listDirectChildren(pid, execSync)
  const ordered: number[] = []
  for (const child of children) {
    ordered.push(...collectDescendants(child, execSync))
    ordered.push(child)
  }
  return ordered
}

function safeKill(processKill: ProcessKillFn, pid: number, signal: NodeJS.Signals | number): void {
  try {
    processKill(pid, signal)
  } catch {
    // ESRCH / already exited
  }
}

function killProcessTreeImpl(options: KillProcessTreeOptions): void {
  const pid = options.pid
  if (!Number.isInteger(pid) || pid <= 0) return

  const platform = options.platform ?? process.platform
  const execSync = options.execFileSync ?? execFileSync
  const processKill = options.processKill ?? ((target, signal) => {
    process.kill(target, signal)
  })

  if (platform === 'win32') {
    try {
      execSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 15_000,
      })
    } catch {
      // taskkill exits non-zero when the PID is already gone (128) — expected on race.
    }
    return
  }

  if (options.detached) {
    // Negative PID = process group (requires detached spawn + setsid).
    safeKill(processKill, -pid, 'SIGKILL')
    return
  }

  for (const childPid of collectDescendants(pid, execSync)) {
    safeKill(processKill, childPid, 'SIGKILL')
  }
  safeKill(processKill, pid, 'SIGKILL')
}

type KillFn = (options: KillProcessTreeOptions) => void

let killImpl: KillFn = killProcessTreeImpl

/** Terminate the full process tree rooted at `pid`. Sync so abort handlers finish before returning. */
export function killProcessTree(options: KillProcessTreeOptions): void {
  killImpl(options)
}

export function setKillProcessTreeForTesting(fn: KillFn): void {
  killImpl = fn
}

export function resetKillProcessTreeForTesting(): void {
  killImpl = killProcessTreeImpl
}

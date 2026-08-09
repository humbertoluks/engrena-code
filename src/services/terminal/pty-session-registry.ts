import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import { spawn as ptySpawn, type IPty } from 'node-pty'
import { getProject } from '../db/repositories/projects.js'
import { getThread } from '../db/repositories/threads.js'
import { resolveThreadCwd } from '../runner/thread-cwd.js'
import { resolveShell, ShellNotFoundError } from './shell-resolver.js'
import { buildPtyEnv } from './pty-env.js'

export interface CreateSessionInput {
  projectId: string
  threadId: string | null
  cols: number
  rows: number
}

export interface CreateSessionSuccess {
  sessionId: string
  shell: string
  cwd: string
}

export interface SessionError {
  error: { code: string; message: string }
}

export type CreateSessionResult = CreateSessionSuccess | SessionError

export interface PtyDataEvent {
  sessionId: string
  chunk: string
}

export interface PtyExitEvent {
  sessionId: string
  exitCode: number
  signal: number | null
  /** `true` quando o encerramento veio de `kill()` pedido pelo usuário; `false` quando o processo morreu sozinho (spec F26 §5). */
  expected: boolean
}

interface PtySession {
  sessionId: string
  pty: IPty
  projectId: string
  threadId: string | null
  cwd: string
  shell: string
  cols: number
  rows: number
  createdAt: number
  killRequested: boolean
}

export type PtySpawnFn = typeof ptySpawn
let spawnImpl: PtySpawnFn = ptySpawn
export function setPtySpawnForTesting(fn: PtySpawnFn): void {
  spawnImpl = fn
}
export function resetPtySpawnForTesting(): void {
  spawnImpl = ptySpawn
}

/**
 * Registro em memória de sessões PTY no processo main (spec F26 §4/§6) — nunca persiste em
 * SQLite/vault (3.2 "Persistência de sessão"). `EventEmitter` para `data`/`exit`: o main process
 * assina uma vez e repassa via `webContents.send`, sem acoplar este módulo a Electron/IPC.
 */
class PtySessionRegistry extends EventEmitter {
  private sessions = new Map<string, PtySession>()

  create(input: CreateSessionInput): CreateSessionResult {
    const project = getProject(input.projectId)
    if (project === null) {
      return { error: { code: 'project_not_found', message: 'Projeto não encontrado.' } }
    }

    let thread = null
    if (input.threadId !== null) {
      thread = getThread(input.threadId)
      if (thread === null || thread.projectId !== input.projectId) {
        return { error: { code: 'thread_not_found', message: 'Thread não encontrada neste projeto.' } }
      }
    }

    const cwd = thread !== null ? resolveThreadCwd(thread, project) : project.path

    let shell: string
    try {
      shell = resolveShell().shell
    } catch (err) {
      if (err instanceof ShellNotFoundError) {
        return { error: { code: err.code, message: err.message } }
      }
      throw err
    }

    const sessionId = randomUUID()
    const ptyProcess = spawnImpl(shell, [], {
      name: 'xterm-color',
      cols: input.cols,
      rows: input.rows,
      cwd,
      env: buildPtyEnv(process.env),
    })

    const session: PtySession = {
      sessionId,
      pty: ptyProcess,
      projectId: input.projectId,
      threadId: input.threadId,
      cwd,
      shell,
      cols: input.cols,
      rows: input.rows,
      createdAt: Date.now(),
      killRequested: false,
    }
    this.sessions.set(sessionId, session)

    ptyProcess.onData((chunk) => {
      this.emit('data', { sessionId, chunk } satisfies PtyDataEvent)
    })

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.sessions.delete(sessionId)
      this.emit('exit', {
        sessionId,
        exitCode,
        signal: signal ?? null,
        expected: session.killRequested,
      } satisfies PtyExitEvent)
    })

    return { sessionId, shell, cwd }
  }

  /** `sessionId` desconhecido: descarta silenciosamente (spec F26 §5 — a aba já teria recebido `exit` antes). */
  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.pty.write(data)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.pty.resize(cols, rows)
    session.cols = cols
    session.rows = rows
  }

  kill(sessionId: string): { ok: true } | SessionError {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return { error: { code: 'session_not_found', message: 'Sessão já não existe.' } }
    }
    session.killRequested = true
    session.pty.kill()
    return { ok: true }
  }

  /** Apenas para testes: reseta o estado in-memory entre specs. */
  clearAllForTesting(): void {
    this.sessions.clear()
  }
}

export const ptySessionRegistry = new PtySessionRegistry()

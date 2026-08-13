import { afterEach, describe, expect, it } from 'vitest'
import {
  killProcessTree,
  resetKillProcessTreeForTesting,
  type ExecFileSyncFn,
} from './process-kill.js'

afterEach(() => {
  resetKillProcessTreeForTesting()
})

describe('killProcessTree — Windows', () => {
  it('runs taskkill /PID /T /F for the given pid', () => {
    const calls: Array<{ file: string; args: readonly string[] }> = []
    const execFileSync: ExecFileSyncFn = (file, args) => {
      calls.push({ file, args })
      return Buffer.alloc(0)
    }

    killProcessTree({ pid: 4242, platform: 'win32', execFileSync })

    expect(calls).toEqual([{ file: 'taskkill', args: ['/PID', '4242', '/T', '/F'] }])
  })

  it('swallows taskkill failure when the process is already gone', () => {
    const execFileSync: ExecFileSyncFn = () => {
      throw Object.assign(new Error('not found'), { status: 128 })
    }
    expect(() => killProcessTree({ pid: 1, platform: 'win32', execFileSync })).not.toThrow()
  })

  it('never invokes a process-name kill (Stop-Process / taskkill /IM)', () => {
    const calls: Array<{ file: string; args: readonly string[] }> = []
    const execFileSync: ExecFileSyncFn = (file, args) => {
      calls.push({ file, args })
      return Buffer.alloc(0)
    }

    killProcessTree({ pid: 99, platform: 'win32', execFileSync })

    for (const call of calls) {
      expect(call.file.toLowerCase()).not.toBe('powershell')
      expect(call.file.toLowerCase()).not.toBe('powershell.exe')
      expect(call.args.join(' ').toLowerCase()).not.toContain('/im')
      expect(call.args.join(' ').toLowerCase()).not.toContain('stop-process')
      expect(call.args.join(' ').toLowerCase()).not.toContain('-name')
    }
  })
})

describe('killProcessTree — POSIX detached', () => {
  it('sends SIGKILL to the process group (-pid)', () => {
    const killed: Array<{ pid: number; signal: NodeJS.Signals | number | undefined }> = []
    killProcessTree({
      pid: 777,
      platform: 'linux',
      detached: true,
      processKill: (pid, signal) => {
        killed.push({ pid, signal })
      },
    })
    expect(killed).toEqual([{ pid: -777, signal: 'SIGKILL' }])
  })
})

describe('killProcessTree — POSIX non-detached', () => {
  it('walks children via pgrep -P then SIGKILLs leaves before root', () => {
    const killed: number[] = []
    const execFileSync: ExecFileSyncFn = (file, args) => {
      expect(file).toBe('pgrep')
      expect(args[0]).toBe('-P')
      const parent = args[1]
      if (parent === '100') return '200\n300\n'
      if (parent === '200') return '201\n'
      return ''
    }

    killProcessTree({
      pid: 100,
      platform: 'darwin',
      detached: false,
      execFileSync,
      processKill: (pid) => {
        killed.push(pid)
      },
    })

    // Deepest first: 201, then 200, then 300, then root 100
    expect(killed).toEqual([201, 200, 300, 100])
  })

  it('still kills the root when pgrep finds no children', () => {
    const killed: number[] = []
    killProcessTree({
      pid: 55,
      platform: 'linux',
      execFileSync: () => {
        throw Object.assign(new Error('no children'), { status: 1 })
      },
      processKill: (pid) => {
        killed.push(pid)
      },
    })
    expect(killed).toEqual([55])
  })
})

describe('killProcessTree — guards', () => {
  it('no-ops for non-positive or non-integer pids', () => {
    const execFileSync: ExecFileSyncFn = () => {
      throw new Error('should not run')
    }
    expect(() => killProcessTree({ pid: 0, platform: 'win32', execFileSync })).not.toThrow()
    expect(() => killProcessTree({ pid: -1, platform: 'win32', execFileSync })).not.toThrow()
    expect(() => killProcessTree({ pid: 1.5, platform: 'win32', execFileSync })).not.toThrow()
  })
})

describe('killProcessTree — real process tree', () => {
  it(
    'kills a spawned child by pid (platform-native tree kill)',
    async () => {
      const { spawn } = await import('node:child_process')
      // Long-lived child: node -e "setInterval(()=>{}, 1000)"
      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
        stdio: 'ignore',
        windowsHide: true,
      })
      expect(child.pid).toBeTypeOf('number')
      const pid = child.pid as number

      killProcessTree({ pid })

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`pid ${pid} still alive`)), 10_000)
        child.on('exit', () => {
          clearTimeout(timer)
          resolve()
        })
        // Already exited between kill and listener.
        if (child.exitCode !== null) {
          clearTimeout(timer)
          resolve()
        }
      })

      // Confirm gone: a second kill attempt must not throw in our helper.
      expect(() => killProcessTree({ pid })).not.toThrow()
    },
    30_000
  )
})

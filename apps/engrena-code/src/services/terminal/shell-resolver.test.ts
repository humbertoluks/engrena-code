import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const existsState = { paths: new Set<string>() }

vi.mock('fs', () => ({
  existsSync: (path: string) => existsState.paths.has(path),
}))

const { resolveShell, ShellNotFoundError } = await import('./shell-resolver.js')

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  existsState.paths = new Set()
  process.env = { ...ORIGINAL_ENV }
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('resolveShell — win32', () => {
  it('test_windows_uses_comspec_or_cmd_fallback — returns COMSPEC when set and present on disk', () => {
    process.env.COMSPEC = 'C:\\Windows\\System32\\wsl-shell.exe'
    existsState.paths.add('C:\\Windows\\System32\\wsl-shell.exe')

    expect(resolveShell('win32')).toEqual({ shell: 'C:\\Windows\\System32\\wsl-shell.exe' })
  })

  it('falls back to cmd.exe when COMSPEC is unset', () => {
    delete process.env.COMSPEC
    process.env.SystemRoot = 'C:\\Windows'
    existsState.paths.add('C:\\Windows\\System32\\cmd.exe')

    expect(resolveShell('win32')).toEqual({ shell: 'C:\\Windows\\System32\\cmd.exe' })
  })

  it('falls back to cmd.exe when COMSPEC points to a file that does not exist', () => {
    process.env.COMSPEC = 'C:\\nao-existe\\shell.exe'
    process.env.SystemRoot = 'C:\\Windows'
    existsState.paths.add('C:\\Windows\\System32\\cmd.exe')

    expect(resolveShell('win32')).toEqual({ shell: 'C:\\Windows\\System32\\cmd.exe' })
  })

  it('throws ShellNotFoundError when neither COMSPEC nor cmd.exe exist', () => {
    delete process.env.COMSPEC
    process.env.SystemRoot = 'C:\\Windows'

    expect(() => resolveShell('win32')).toThrow(ShellNotFoundError)
  })
})

describe('resolveShell — posix', () => {
  it('test_posix_uses_shell_env_or_bash_fallback — returns SHELL when set and present on disk', () => {
    process.env.SHELL = '/usr/bin/zsh'
    existsState.paths.add('/usr/bin/zsh')

    expect(resolveShell('linux')).toEqual({ shell: '/usr/bin/zsh' })
    expect(resolveShell('darwin')).toEqual({ shell: '/usr/bin/zsh' })
  })

  it('falls back to /bin/bash when SHELL is unset', () => {
    delete process.env.SHELL
    existsState.paths.add('/bin/bash')

    expect(resolveShell('linux')).toEqual({ shell: '/bin/bash' })
  })

  it('throws ShellNotFoundError when neither SHELL nor /bin/bash exist', () => {
    delete process.env.SHELL

    expect(() => resolveShell('linux')).toThrow(ShellNotFoundError)
  })
})

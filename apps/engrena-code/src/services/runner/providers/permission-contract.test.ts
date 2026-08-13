import { describe, expect, it } from 'vitest'
import {
  BASH_PERMISSION_MATRIX,
  HOOK_COMMAND_TIMEOUT_SEC,
  INCLUDE_HOOK_EVENTS_FLAG,
  SUPERVISED_PERMISSION_MODE,
  checkSupervisedPermissionArgs,
  nativeDenialDiagnosis,
  shouldIncludeHookEvents,
  validatePermissionSettingsShape,
} from './permission-contract.js'

describe('permission-contract — supervised CLI compliance', () => {
  it('requires auto + settings + include-hook-events + stream-json', () => {
    const ok = checkSupervisedPermissionArgs([
      '-p',
      'hi',
      '--output-format',
      'stream-json',
      '--permission-mode',
      SUPERVISED_PERMISSION_MODE,
      '--settings',
      '/tmp/settings.json',
      INCLUDE_HOOK_EVENTS_FLAG,
    ])
    expect(ok).toEqual({ ok: true })
  })

  it('reports missing include-hook-events (Sprint 1 gate)', () => {
    const check = checkSupervisedPermissionArgs([
      '--output-format',
      'stream-json',
      '--permission-mode',
      'auto',
      '--settings',
      'x.json',
    ])
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.missing).toContain(INCLUDE_HOOK_EVENTS_FLAG)
  })

  it('rejects non-auto permission mode for supervised settings attach', () => {
    const check = checkSupervisedPermissionArgs([
      '--output-format',
      'stream-json',
      '--permission-mode',
      'manual',
      '--settings',
      'x.json',
      INCLUDE_HOOK_EVENTS_FLAG,
    ])
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.missing.some((m) => m.includes('auto'))).toBe(true)
  })

  it('only enables include-hook-events when permission settings are attached', () => {
    expect(shouldIncludeHookEvents(true)).toBe(true)
    expect(shouldIncludeHookEvents(false)).toBe(false)
  })

  it('validates PreToolUse + PermissionRequest with ELECTRON_RUN_AS_NODE or .cmd launcher', () => {
    const command =
      'cmd /c set ELECTRON_RUN_AS_NODE=1&& "C:\\\\App\\\\electron.exe" "hook.mjs" --port 1 --token t'
    const entry = {
      matcher: '*',
      hooks: [{ type: 'command', command, timeout: HOOK_COMMAND_TIMEOUT_SEC }],
    }
    const result = validatePermissionSettingsShape({
      hooks: { PreToolUse: [entry], PermissionRequest: [entry] },
    })
    expect(result.ok).toBe(true)

    const win = validatePermissionSettingsShape({
      hooks: {
        PreToolUse: [
          {
            matcher: '*',
            hooks: [
              {
                type: 'command',
                command: '"C:\\\\ud\\\\permission-hook.cmd" --port 1 --token t',
                timeout: HOOK_COMMAND_TIMEOUT_SEC,
              },
            ],
          },
        ],
        PermissionRequest: [
          {
            matcher: '*',
            hooks: [
              {
                type: 'command',
                command: '"C:\\\\ud\\\\permission-hook.cmd" --port 1 --token t',
                timeout: HOOK_COMMAND_TIMEOUT_SEC,
              },
            ],
          },
        ],
      },
    })
    expect(win.ok).toBe(true)
  })

  it('rejects settings without ELECTRON_RUN_AS_NODE / .cmd or without PermissionRequest', () => {
    const result = validatePermissionSettingsShape({
      hooks: {
        PreToolUse: [
          {
            matcher: '*',
            hooks: [{ type: 'command', command: 'node hook.mjs', timeout: HOOK_COMMAND_TIMEOUT_SEC }],
          },
        ],
      },
    })
    expect(result.ok).toBe(false)
  })

  it('covers all Bash matrix cases and requires native-denial recovery event', () => {
    const cases = BASH_PERMISSION_MATRIX.map((row) => row.case)
    expect(cases).toEqual(['simple', 'compound', 'foreground-server', 'run-in-background'])
    for (const row of BASH_PERMISSION_MATRIX) {
      expect(row.requiresNativeDenialEventIfUngated).toBe(true)
    }
  })

  it('builds Portuguese diagnosis without embedding command bodies', () => {
    const msg = nativeDenialDiagnosis('Bash', 'mode')
    expect(msg).toContain('Bash')
    expect(msg).toContain('mode')
    expect(msg).toContain('EngrenaCode')
    expect(msg).not.toContain('sleep')
    expect(msg).not.toContain('command')
  })
})

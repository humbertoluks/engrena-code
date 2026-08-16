import { describe, expect, it } from 'vitest'
import {
  BASH_PERMISSION_MATRIX,
  HOOK_COMMAND_TIMEOUT_SEC,
  INCLUDE_HOOK_EVENTS_FLAG,
  SUPERVISED_PERMISSION_MODE,
  assertPermissionContract,
  checkSupervisedPermissionArgs,
  nativeDenialCase,
  nativeDenialDiagnosis,
  shouldIncludeHookEvents,
  validatePermissionSettingsShape,
  type PermissionContractSpawnPlan,
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
    const msg = nativeDenialDiagnosis({ toolName: 'Bash', decisionReasonType: 'mode', brokerGranted: false })
    expect(msg).toContain('Bash')
    expect(msg).toContain('mode')
    expect(msg).toContain('EngrenaCode')
    expect(msg).not.toContain('sleep')
    expect(msg).not.toContain('command')
  })

  // R08: a mesma frase para os dois casos afirmava que nenhum card apareceu inclusive quando o
  // usuário tinha acabado de conceder no card.
  it('separates "broker never saw the tool" from "denied after the broker granted"', () => {
    expect(nativeDenialCase(false)).toBe('never-brokered')
    expect(nativeDenialCase(true)).toBe('after-broker-grant')

    const ungated = nativeDenialDiagnosis({ toolName: 'Bash', decisionReasonType: 'mode', brokerGranted: false })
    expect(ungated).toContain('sem consultar o broker do EngrenaCode')

    const afterGrant = nativeDenialDiagnosis({
      toolName: 'Bash',
      decisionReasonType: 'hook',
      brokerGranted: true,
    })
    expect(afterGrant).toContain('concedeu a ferramenta Bash')
    expect(afterGrant).toContain('outro hook PreToolUse')
    expect(afterGrant).not.toContain('sem consultar')
  })

  it('carries the CLI explanation when it comes, and stays quiet when it does not', () => {
    const withReason = nativeDenialDiagnosis({
      toolName: 'Bash',
      decisionReasonType: 'hook',
      decisionReason: 'git log precisa de -n',
      brokerGranted: true,
    })
    expect(withReason).toContain('Detalhe do CLI: git log precisa de -n')

    const bare = nativeDenialDiagnosis({ toolName: 'Write', brokerGranted: false })
    expect(bare).not.toContain('Motivo:')
    expect(bare).not.toContain('Detalhe do CLI')
    expect(bare).not.toContain('  ')
  })

  it('does not leave the sentence without a subject when the tool name is blank', () => {
    expect(nativeDenialDiagnosis({ toolName: '   ', brokerGranted: false })).toContain(
      'ferramenta desconhecida'
    )
  })
})

describe('assertPermissionContract — gate de produção', () => {
  const hookCommand =
    process.platform === 'win32'
      ? '"C:\\ud\\permission-hook.cmd" --port 1 --token t'
      : 'ELECTRON_RUN_AS_NODE=1 "/app/electron" "/ud/permission-hook.mjs" --port 1 --token t'

  function hookEntry() {
    return {
      matcher: '*',
      hooks: [{ type: 'command', command: hookCommand, timeout: HOOK_COMMAND_TIMEOUT_SEC }],
    }
  }

  function plan(overrides: Partial<PermissionContractSpawnPlan> = {}): PermissionContractSpawnPlan {
    const path = '/ud/tmp/settings.json'
    return {
      provider: 'claude',
      accessLevel: 'supervised',
      permissionSettingsPath: path,
      permissionSettings: { hooks: { PreToolUse: [hookEntry()], PermissionRequest: [hookEntry()] } },
      args: [
        '-p',
        'oi',
        '--output-format',
        'stream-json',
        '--permission-mode',
        SUPERVISED_PERMISSION_MODE,
        '--settings',
        path,
        INCLUDE_HOOK_EVENTS_FLAG,
      ],
      env: { ELECTRON_RUN_AS_NODE: '1' },
      platform: process.platform,
      ...overrides,
    }
  }

  it('accepts a supervised turn with the broker fully mounted', () => {
    expect(assertPermissionContract(plan())).toEqual({ ok: true })
  })

  it('does not apply when the broker was not mounted', () => {
    expect(
      assertPermissionContract({
        provider: 'codex',
        accessLevel: 'full-access',
        permissionSettingsPath: undefined,
        permissionSettings: undefined,
        args: ['-p', 'oi'],
        env: {},
        platform: process.platform,
      })
    ).toEqual({ ok: true })
  })

  it('reports the missing flags when the args drift out of contract', () => {
    const result = assertPermissionContract(
      plan({ args: ['-p', 'oi', '--permission-mode', 'manual', '--settings', '/ud/tmp/settings.json'] })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('--permission-mode auto')
      expect(result.message).toContain(INCLUDE_HOOK_EVENTS_FLAG)
    }
  })

  it('rejects settings without the PermissionRequest group', () => {
    const result = assertPermissionContract(
      plan({ permissionSettings: { hooks: { PreToolUse: [hookEntry()] } } })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('PermissionRequest')
  })

  it('rejects a --settings value that points elsewhere than the file written this turn', () => {
    const result = assertPermissionContract({
      ...plan(),
      permissionSettingsPath: '/ud/tmp/outro.json',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('--settings')
  })

  it('requires ELECTRON_RUN_AS_NODE in the spawn env whenever settings are attached', () => {
    const result = assertPermissionContract(plan({ env: {} }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('ELECTRON_RUN_AS_NODE')
  })

  it('accepts the .cmd launcher on Windows and the env prefix elsewhere', () => {
    const winEntry = {
      matcher: '*',
      hooks: [
        {
          type: 'command',
          command: '"C:\\ud\\permission-hook.cmd" --port 1 --token t',
          timeout: HOOK_COMMAND_TIMEOUT_SEC,
        },
      ],
    }
    const unixEntry = {
      matcher: '*',
      hooks: [
        {
          type: 'command',
          command: 'ELECTRON_RUN_AS_NODE=1 "/app/electron" "/ud/permission-hook.mjs" --port 1 --token t',
          timeout: HOOK_COMMAND_TIMEOUT_SEC,
        },
      ],
    }
    expect(
      assertPermissionContract(
        plan({
          platform: 'win32',
          permissionSettings: { hooks: { PreToolUse: [winEntry], PermissionRequest: [winEntry] } },
        })
      )
    ).toEqual({ ok: true })
    expect(
      assertPermissionContract(
        plan({
          platform: 'linux',
          permissionSettings: { hooks: { PreToolUse: [unixEntry], PermissionRequest: [unixEntry] } },
        })
      )
    ).toEqual({ ok: true })
    // Forma do outro SO não vale: no Windows o .cmd é o que preserva o stdin do hook.
    const crossed = assertPermissionContract(
      plan({
        platform: 'win32',
        permissionSettings: { hooks: { PreToolUse: [unixEntry], PermissionRequest: [unixEntry] } },
      })
    )
    expect(crossed.ok).toBe(false)
    if (!crossed.ok) expect(crossed.message).toContain('permission-hook.cmd')
  })

  it('refuses a broker mounted for a provider without PreToolUse, or in full-access', () => {
    const wrongProvider = assertPermissionContract(plan({ provider: 'codex' }))
    expect(wrongProvider.ok).toBe(false)
    const fullAccess = assertPermissionContract(plan({ accessLevel: 'full-access' }))
    expect(fullAccess.ok).toBe(false)
  })

  it('never embeds the hook command (which carries the broker token) in the message', () => {
    const result = assertPermissionContract(plan({ env: {} }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).not.toContain('--token')
      expect(result.message).not.toContain('permission-hook.mjs')
    }
  })
})

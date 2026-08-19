import { describe, expect, it } from 'vitest'
import {
  BASH_PERMISSION_MATRIX,
  HOOK_COMMAND_TIMEOUT_SEC,
  PERMISSION_HOOK_MARGIN_SEC,
  permissionGateTimeoutMs,
  INCLUDE_HOOK_EVENTS_FLAG,
  OBSERVED_CLI_VERSION_MAX_CHARS,
  PERMISSION_CONTRACT_MAX_VALIDATED_VERSION,
  PERMISSION_CONTRACT_MIN_VALIDATED_VERSION,
  PERMISSION_CONTRACT_VALIDATED_VERSIONS,
  SUPERVISED_PERMISSION_MODE,
  assertPermissionContract,
  checkClaudeCliVersion,
  checkSupervisedPermissionArgs,
  claudeCliVersionLogLine,
  claudeCliVersionWarrantsNotice,
  compareCliVersions,
  formatCliVersion,
  nativeDenialCase,
  nativeDenialDiagnosis,
  parseCliVersion,
  shouldIncludeHookEvents,
  validatePermissionSettingsShape,
  type ClaudeCliVersionStatus,
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
    const msg = nativeDenialDiagnosis({
      toolName: 'Bash',
      decisionReasonType: 'mode',
      brokerOutcome: 'never-requested',
    })
    expect(msg).toContain('Bash')
    expect(msg).toContain('mode')
    expect(msg).toContain('EngrenaCode')
    expect(msg).not.toContain('sleep')
    expect(msg).not.toContain('command')
  })

  // R08: a mesma frase para os dois casos afirmava que nenhum card apareceu inclusive quando o
  // usuário tinha acabado de conceder no card. R09: e também quando ele tinha acabado de negar.
  it('maps every broker outcome to its own denial case', () => {
    expect(nativeDenialCase('never-requested')).toBe('never-brokered')
    expect(nativeDenialCase('granted')).toBe('after-broker-grant')
    expect(nativeDenialCase('denied')).toBe('after-user-denial')
    expect(nativeDenialCase('expired')).toBe('after-gate-expiry')
    expect(nativeDenialCase('cancelled')).toBe('after-turn-cancel')
    expect(nativeDenialCase('unavailable')).toBe('broker-unavailable')
    expect(nativeDenialCase('ambiguous')).toBe('conflicting-decisions')

    // Um caso por outcome: colapsar dois é literalmente como o R08 e o R09 nasceram.
    const outcomes = [
      'never-requested',
      'granted',
      'denied',
      'expired',
      'cancelled',
      'unavailable',
      'ambiguous',
    ] as const
    const cases = outcomes.map(nativeDenialCase)
    expect(new Set(cases).size).toBe(cases.length)
  })

  // O Parar do usuário fechava o gate e caía na copy de timeout, que mandava responder ao card
  // "enquanto ele estiver na tela" — conselho para o problema errado.
  it('separates a cancelled turn from a request nobody answered', () => {
    const cancelled = nativeDenialDiagnosis({ toolName: 'Bash', brokerOutcome: 'cancelled' })
    expect(cancelled).toContain('turno foi cancelado')
    expect(cancelled).not.toContain('ficou sem resposta')

    const expired = nativeDenialDiagnosis({ toolName: 'Bash', brokerOutcome: 'expired' })
    expect(expired).toContain('ficou sem resposta')
    expect(expired).not.toContain('cancelado')
  })

  // A chave é o toolName, não a chamada: quando as duas discordam, afirmar uma delas é trocar
  // uma mentira por outra.
  it('admits it cannot tell which call a denial belongs to when decisions conflict', () => {
    const ambiguous = nativeDenialDiagnosis({ toolName: 'Bash', brokerOutcome: 'ambiguous' })
    expect(ambiguous).toContain('decisões opostas')
    expect(ambiguous).toContain('não informa a qual chamada')
    expect(ambiguous).not.toContain('usuário negou a ferramenta')
    expect(ambiguous).not.toContain('sem consultar o broker')
  })

  // O 413 responde antes de existir toolName, então a tool fica indistinguível de "nunca vista".
  it('qualifies the never-brokered claim when a request was rejected for size in the turn', () => {
    const withDoubt = nativeDenialDiagnosis({
      toolName: 'Bash',
      brokerOutcome: 'never-requested',
      oversizedRequestInTurn: true,
    })
    expect(withDoubt).toContain('sem consultar o broker')
    expect(withDoubt).toContain('excede')

    // A ressalva não contamina os casos em que o broker sabe o que fez.
    const denied = nativeDenialDiagnosis({
      toolName: 'Bash',
      brokerOutcome: 'denied',
      oversizedRequestInTurn: true,
    })
    expect(denied).not.toContain('excede')
  })

  it('separates "broker never saw the tool" from "denied after the broker granted"', () => {
    const ungated = nativeDenialDiagnosis({
      toolName: 'Bash',
      decisionReasonType: 'mode',
      brokerOutcome: 'never-requested',
    })
    expect(ungated).toContain('sem consultar o broker do EngrenaCode')

    const afterGrant = nativeDenialDiagnosis({
      toolName: 'Bash',
      decisionReasonType: 'hook',
      brokerOutcome: 'granted',
    })
    expect(afterGrant).toContain('concedeu a ferramenta Bash')
    expect(afterGrant).toContain('outro hook PreToolUse')
    expect(afterGrant).not.toContain('sem consultar')
  })

  // R09 (smoke ao vivo de 2026-08-16): o usuário negou `Read` no card e o log dizia que o CLI
  // tinha negado sozinho, sem consultar o broker.
  it('names the user as the author of the denial instead of the CLI', () => {
    const denied = nativeDenialDiagnosis({
      toolName: 'Read',
      decisionReasonType: 'hook',
      brokerOutcome: 'denied',
    })
    expect(denied).toContain('usuário negou a ferramenta Read')
    expect(denied).toContain('card de permissão do EngrenaCode')
    expect(denied).not.toContain('sem consultar o broker')
    expect(denied).not.toContain('por conta própria')
  })

  it('tells a timed-out request apart from a user denial', () => {
    const expired = nativeDenialDiagnosis({ toolName: 'Bash', brokerOutcome: 'expired' })
    expect(expired).toContain('ficou sem resposta')
    expect(expired).toContain('fail-closed')
    expect(expired).not.toContain('usuário negou')
    expect(expired).not.toContain('sem consultar o broker')
  })

  it('blames the EngrenaCode itself when the request could not even be opened', () => {
    const unavailable = nativeDenialDiagnosis({ toolName: 'Write', brokerOutcome: 'unavailable' })
    expect(unavailable).toContain('não conseguiu abrir o pedido de permissão')
    expect(unavailable).toContain('falha interna')
    expect(unavailable).not.toContain('usuário negou')
    expect(unavailable).not.toContain('sem consultar o broker')
  })

  it('carries the CLI explanation when it comes, and stays quiet when it does not', () => {
    const withReason = nativeDenialDiagnosis({
      toolName: 'Bash',
      decisionReasonType: 'hook',
      decisionReason: 'git log precisa de -n',
      brokerOutcome: 'granted',
    })
    expect(withReason).toContain('Detalhe do CLI: git log precisa de -n')

    const bare = nativeDenialDiagnosis({ toolName: 'Write', brokerOutcome: 'never-requested' })
    expect(bare).not.toContain('Motivo:')
    expect(bare).not.toContain('Detalhe do CLI')
    expect(bare).not.toContain('  ')
  })

  it('does not leave the sentence without a subject when the tool name is blank', () => {
    expect(nativeDenialDiagnosis({ toolName: '   ', brokerOutcome: 'never-requested' })).toContain(
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

describe('parseCliVersion / formatCliVersion / compareCliVersions (D3)', () => {
  it('extracts the first x.y.z triple from real `claude --version` output', () => {
    expect(parseCliVersion('2.1.233 (Claude Code)')).toEqual({ major: 2, minor: 1, patch: 233 })
  })

  it('returns null when the output carries no numeric triple', () => {
    expect(parseCliVersion('command not found: claude')).toBeNull()
    expect(parseCliVersion('')).toBeNull()
  })

  it('formats back to the canonical x.y.z string', () => {
    expect(formatCliVersion({ major: 2, minor: 1, patch: 9 })).toBe('2.1.9')
  })

  it('compares field by field, not as strings (2.1.9 < 2.1.10, which string comparison gets wrong)', () => {
    const a = { major: 2, minor: 1, patch: 9 }
    const b = { major: 2, minor: 1, patch: 10 }
    expect(compareCliVersions(a, b)).toBeLessThan(0)
    expect(compareCliVersions(b, a)).toBeGreaterThan(0)
    expect('2.1.9' < '2.1.10').toBe(false) // a comparação de string erraria este caso

    expect(compareCliVersions({ major: 2, minor: 1, patch: 1 }, { major: 3, minor: 0, patch: 0 })).toBeLessThan(0)
    expect(compareCliVersions({ major: 2, minor: 2, patch: 0 }, { major: 2, minor: 1, patch: 9 })).toBeGreaterThan(
      0
    )
    expect(compareCliVersions({ major: 2, minor: 1, patch: 5 }, { major: 2, minor: 1, patch: 5 })).toBe(0)
  })
})

describe('checkClaudeCliVersion (D3)', () => {
  it('reports in-range for the two closed-interval endpoints', () => {
    expect(checkClaudeCliVersion(PERMISSION_CONTRACT_MIN_VALIDATED_VERSION).status).toBe('in-range')
    expect(checkClaudeCliVersion(PERMISSION_CONTRACT_MAX_VALIDATED_VERSION).status).toBe('in-range')
  })

  it('reports in-range for an intermediate version that is not itself in the validated list', () => {
    const check = checkClaudeCliVersion('2.1.229 (Claude Code)')
    expect(check.status).toBe('in-range')
    expect(PERMISSION_CONTRACT_VALIDATED_VERSIONS.some((v) => v.version === '2.1.229')).toBe(false)
  })

  it('reports below-min for a version older than the oldest validated one', () => {
    expect(checkClaudeCliVersion('2.1.225').status).toBe('below-min')
    expect(checkClaudeCliVersion('2.0.999').status).toBe('below-min')
  })

  it('reports above-max for a version newer than the last validated one', () => {
    expect(checkClaudeCliVersion('2.1.233 (Claude Code)').status).toBe('above-max')
  })

  it('reports unparseable for output with no numeric triple, including empty output', () => {
    expect(checkClaudeCliVersion('command not found: claude').status).toBe('unparseable')
    expect(checkClaudeCliVersion('').status).toBe('unparseable')
  })

  it('normalizes `observed` to formatCliVersion(parsed) when the output parses', () => {
    const check = checkClaudeCliVersion('2.1.233 (Claude Code)')
    expect(check.parsed).toEqual({ major: 2, minor: 1, patch: 233 })
    expect(check.observed).toBe(formatCliVersion(check.parsed as NonNullable<typeof check.parsed>))
    expect(check.observed).toBe('2.1.233')
  })

  it('normalizes `observed` to the trimmed first non-empty line, capped at OBSERVED_CLI_VERSION_MAX_CHARS, when it does not parse', () => {
    const longLine = 'x'.repeat(OBSERVED_CLI_VERSION_MAX_CHARS + 20)
    const check = checkClaudeCliVersion(`\n  \n  ${longLine}  \nsegunda linha ignorada`)
    expect(check.status).toBe('unparseable')
    expect(check.observed).toBe(longLine.slice(0, OBSERVED_CLI_VERSION_MAX_CHARS))
    expect(check.observed).toHaveLength(OBSERVED_CLI_VERSION_MAX_CHARS)
  })

  it('normalizes `observed` to an empty string when the output is empty', () => {
    expect(checkClaudeCliVersion('').observed).toBe('')
  })
})

// Guarda de coerência: sem este teste, os limites (MIN/MAX_VALIDATED_VERSION) e a lista
// (PERMISSION_CONTRACT_VALIDATED_VERSIONS) podem se desencontrar silenciosamente ao editar só um dos dois.
describe('coerência entre a lista de versões validadas e os limites (D3)', () => {
  it('MIN_VALIDATED_VERSION é a menor e MAX_VALIDATED_VERSION é a maior da lista', () => {
    const parsedVersions = PERMISSION_CONTRACT_VALIDATED_VERSIONS.map((v) => {
      const parsed = parseCliVersion(v.version)
      expect(parsed).not.toBeNull()
      return parsed as NonNullable<typeof parsed>
    })

    const min = parseCliVersion(PERMISSION_CONTRACT_MIN_VALIDATED_VERSION)
    const max = parseCliVersion(PERMISSION_CONTRACT_MAX_VALIDATED_VERSION)
    expect(min).not.toBeNull()
    expect(max).not.toBeNull()

    for (const parsed of parsedVersions) {
      expect(compareCliVersions(min as NonNullable<typeof min>, parsed)).toBeLessThanOrEqual(0)
      expect(compareCliVersions(max as NonNullable<typeof max>, parsed)).toBeGreaterThanOrEqual(0)
    }

    // Só "min ≤ todos ≤ max" deixaria passar um limite inventado (MIN '1.0.0' satisfaz a
    // desigualdade e alargaria a faixa em silêncio): os limites têm que sair da própria lista.
    const versions = PERMISSION_CONTRACT_VALIDATED_VERSIONS.map((v) => v.version)
    expect(versions).toContain(PERMISSION_CONTRACT_MIN_VALIDATED_VERSION)
    expect(versions).toContain(PERMISSION_CONTRACT_MAX_VALIDATED_VERSION)
  })

  it('toda entrada da lista parseia e cai in-range', () => {
    for (const entry of PERMISSION_CONTRACT_VALIDATED_VERSIONS) {
      const check = checkClaudeCliVersion(entry.version)
      expect(check.parsed).not.toBeNull()
      expect(check.status).toBe('in-range')
    }
  })

  it('toda entrada tem evidence não vazia', () => {
    for (const entry of PERMISSION_CONTRACT_VALIDATED_VERSIONS) {
      expect(entry.evidence.trim()).not.toBe('')
    }
  })
})

describe('claudeCliVersionWarrantsNotice (D3)', () => {
  it('é false só para in-range', () => {
    expect(claudeCliVersionWarrantsNotice('in-range')).toBe(false)
  })

  it('é true para os três casos de alerta', () => {
    const warnings: ClaudeCliVersionStatus[] = ['below-min', 'above-max', 'unparseable']
    for (const status of warnings) {
      expect(claudeCliVersionWarrantsNotice(status)).toBe(true)
    }
  })
})

describe('claudeCliVersionLogLine (D3)', () => {
  it('cita a versão observada e a faixa min→max no caso below-min', () => {
    const check = checkClaudeCliVersion('2.1.225')
    const line = claudeCliVersionLogLine(check)
    expect(line).toContain('2.1.225')
    expect(line).toContain(PERMISSION_CONTRACT_MIN_VALIDATED_VERSION)
    expect(line).toContain(PERMISSION_CONTRACT_MAX_VALIDATED_VERSION)
    expect(line).toContain('turno não foi bloqueado')
  })

  it('cita a versão observada e a faixa min→max no caso above-max', () => {
    const check = checkClaudeCliVersion('2.1.233 (Claude Code)')
    const line = claudeCliVersionLogLine(check)
    expect(line).toContain('2.1.233')
    expect(line).toContain(PERMISSION_CONTRACT_MIN_VALIDATED_VERSION)
    expect(line).toContain(PERMISSION_CONTRACT_MAX_VALIDATED_VERSION)
    expect(line).toContain('turno não foi bloqueado')
  })

  it('no caso unparseable com saída presente, cita a saída e a faixa', () => {
    const check = checkClaudeCliVersion('lixo sem versão')
    const line = claudeCliVersionLogLine(check)
    expect(line).toContain('lixo sem versão')
    expect(line).toContain(PERMISSION_CONTRACT_MIN_VALIDATED_VERSION)
    expect(line).toContain(PERMISSION_CONTRACT_MAX_VALIDATED_VERSION)
    expect(line).toContain('turno não foi bloqueado')
  })

  it('no caso unparseable com saída vazia, distingue de saída presente', () => {
    const check = checkClaudeCliVersion('')
    const line = claudeCliVersionLogLine(check)
    expect(line).toContain('saída vazia')
    expect(line).not.toContain('saída ""')
  })
})

/**
 * F32 — o prazo do card de permissão. Estes testes não conferem um número bonito: conferem que o
 * prazo continua **derivado** do teto do hook. O defeito que a feature corrige era exatamente um
 * literal solto, cinco vezes mais apertado que a restrição, sem nada ligando os dois.
 */
describe('prazo do gate de permissão (F32)', () => {
  it('a margem é positiva e o prazo cabe no teto do hook', () => {
    expect(PERMISSION_HOOK_MARGIN_SEC).toBeGreaterThan(0)
    expect(permissionGateTimeoutMs() / 1000 + PERMISSION_HOOK_MARGIN_SEC).toBeLessThanOrEqual(
      HOOK_COMMAND_TIMEOUT_SEC
    )
  })

  it('a margem não come o prazo inteiro', () => {
    // Margem >= teto deixaria o prazo em zero ou negativo: todo card nasceria vencido.
    expect(PERMISSION_HOOK_MARGIN_SEC).toBeLessThan(HOOK_COMMAND_TIMEOUT_SEC)
    expect(permissionGateTimeoutMs()).toBeGreaterThan(0)
  })

  it('com a margem atual o prazo é 8 minutos', () => {
    // Trava o valor observável: mexer na margem tem que passar por aqui, não por acidente.
    expect(permissionGateTimeoutMs()).toBe(480_000)
  })

  it('o prazo é maior que o literal de 2 min que existia antes', () => {
    // O ponto da feature. Se alguém reintroduzir o literal, este teste cai.
    expect(permissionGateTimeoutMs()).toBeGreaterThan(2 * 60 * 1000)
  })
})

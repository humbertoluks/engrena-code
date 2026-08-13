import { afterAll, describe, expect, it } from 'vitest'
import { spawn } from 'child_process'
import { createServer } from 'http'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_permission_hook_'))

const { ensurePermissionHookScript } = await import('./permission-hook.js')

afterAll(() => {
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

function startFakePermissionServer(
  handler: (body: { toolName?: string; toolInput?: unknown }) => { allow: boolean }
): Promise<{ port: number; token: string; close: () => void }> {
  const token = 'test-permission-token-123'
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()))
    req.on('end', () => {
      const result = handler(JSON.parse(raw || '{}'))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({ port, token, close: () => server.close() })
    })
  })
}

function runHook(
  port: number,
  token: string,
  stdin: unknown
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const scriptPath = ensurePermissionHookScript()
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, '--port', String(port), '--token', token])
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => (stdout += c.toString()))
    child.stderr.on('data', (c: Buffer) => (stderr += c.toString()))
    child.on('close', (code) => resolve({ code, stdout, stderr }))
    child.stdin.write(JSON.stringify(stdin))
    child.stdin.end()
  })
}

describe('permission-hook (PreToolUse, spawnado via --settings)', () => {
  it('exits 0 with hookSpecificOutput.permissionDecision=allow when the broker allows', async () => {
    const server = await startFakePermissionServer(() => ({ allow: true }))
    const { code, stdout } = await runHook(server.port, server.token, {
      tool_name: 'Write',
      tool_input: { file_path: 'x.txt' },
    })
    expect(code).toBe(0)
    const parsed = JSON.parse(stdout) as {
      hookSpecificOutput: { hookEventName: string; permissionDecision: string }
    }
    expect(parsed.hookSpecificOutput.permissionDecision).toBe('allow')
    // Sem hookEventName o CLI ignora a decisão e nega toda escrita em headless.
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PreToolUse')
    server.close()
  })

  it('exits 0 with hookSpecificOutput.permissionDecision=deny when the broker denies', async () => {
    const server = await startFakePermissionServer(() => ({ allow: false }))
    const { code, stdout } = await runHook(server.port, server.token, {
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
    })
    expect(code).toBe(0)
    const parsed = JSON.parse(stdout) as {
      hookSpecificOutput: { hookEventName: string; permissionDecision: string }
    }
    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny')
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PreToolUse')
    server.close()
  })

  it('forwards tool_name/tool_input from stdin as toolName/toolInput, with the token header', async () => {
    let captured: { toolName?: string; toolInput?: unknown } | undefined
    const server = await startFakePermissionServer((body) => {
      captured = body
      return { allow: true }
    })
    await runHook(server.port, server.token, {
      tool_name: 'Edit',
      tool_input: { file_path: 'a.ts', old_string: '1', new_string: '2' },
    })
    expect(captured?.toolName).toBe('Edit')
    expect(captured?.toolInput).toEqual({ file_path: 'a.ts', old_string: '1', new_string: '2' })
    server.close()
  })

  it(
    'fails closed (deny) with the status in the reason when the broker answers non-2xx',
    async () => {
      // 403 (token errado) / 404 / 413 devolvem corpo vazio: sem checar res.ok o res.json() lança
      // e o motivo do deny some no catch genérico.
      const server = await new Promise<{ port: number; close: () => void }>((resolve) => {
        const s = createServer((_req, res) => {
          res.writeHead(403)
          res.end()
        })
        s.listen(0, '127.0.0.1', () => {
          const address = s.address()
          const port = typeof address === 'object' && address ? address.port : 0
          resolve({ port, close: () => s.close() })
        })
      })

      const { code, stdout } = await runHook(server.port, 'token-errado', {
        tool_name: 'Write',
        tool_input: { file_path: 'x.txt' },
      })
      expect(code).toBe(0)
      const parsed = JSON.parse(stdout) as {
        hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string }
      }
      expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny')
      expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain('403')
      server.close()
    },
    15_000
  )

  it('fails closed (deny) when the broker is unreachable', async () => {
    const { code, stdout } = await runHook(1, 'wrong-token', { tool_name: 'Write', tool_input: {} })
    expect(code).toBe(0)
    expect(
      (JSON.parse(stdout) as { hookSpecificOutput: { permissionDecision: string } }).hookSpecificOutput.permissionDecision
    ).toBe('deny')
  })

  it('fails closed (deny) on invalid stdin JSON', async () => {
    const scriptPath = ensurePermissionHookScript()
    const result = await new Promise<{ code: number | null; stdout: string }>((resolve) => {
      const child = spawn(process.execPath, [scriptPath, '--port', '1', '--token', 'x'])
      let stdout = ''
      child.stdout.on('data', (c: Buffer) => (stdout += c.toString()))
      child.on('close', (code) => resolve({ code, stdout }))
      child.stdin.write('not json')
      child.stdin.end()
    })
    expect(result.code).toBe(0)
    expect(
      (JSON.parse(result.stdout) as { hookSpecificOutput: { permissionDecision: string } }).hookSpecificOutput
        .permissionDecision
    ).toBe('deny')
  })

  it('PermissionRequest: responde com decision.behavior (não permissionDecision)', async () => {
    const server = await startFakePermissionServer(() => ({ allow: true }))
    const { code, stdout } = await runHook(server.port, server.token, {
      hook_event_name: 'PermissionRequest',
      tool_name: 'Write',
      tool_input: { file_path: 'x.txt', content: 'hi' },
    })
    expect(code).toBe(0)
    const parsed = JSON.parse(stdout) as {
      hookSpecificOutput: {
        hookEventName: string
        decision?: { behavior: string }
        permissionDecision?: string
      }
    }
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PermissionRequest')
    expect(parsed.hookSpecificOutput.decision?.behavior).toBe('allow')
    expect(parsed.hookSpecificOutput.permissionDecision).toBeUndefined()
    server.close()
  })

  it('infere Write a partir de tool_input.file_path quando tool_name falta', async () => {
    let captured: { toolName?: string } | undefined
    const server = await startFakePermissionServer((body) => {
      captured = body
      return { allow: true }
    })
    await runHook(server.port, server.token, {
      tool_input: { file_path: 'D:\\\\temp\\\\TodoV1\\\\package.json', content: '{}' },
    })
    expect(captured?.toolName).toBe('Write')
    server.close()
  })
})

describe('ensurePermissionHookScript', () => {
  it('is idempotent — repeated calls return the same path with the same content', () => {
    const first = ensurePermissionHookScript()
    const firstContent = readFileSync(first, 'utf-8')
    const second = ensurePermissionHookScript()
    expect(second).toBe(first)
    expect(readFileSync(second, 'utf-8')).toBe(firstContent)
  })
})

describe('ensurePermissionHookLauncher', () => {
  it('no Windows devolve .cmd que aponta para o .mjs; no Unix devolve o .mjs', async () => {
    const { ensurePermissionHookLauncher, ensurePermissionHookScript } = await import('./permission-hook.js')
    const launcher = ensurePermissionHookLauncher()
    const script = ensurePermissionHookScript()
    if (process.platform === 'win32') {
      expect(launcher.endsWith('permission-hook.cmd')).toBe(true)
      expect(readFileSync(launcher, 'utf-8')).toContain('ELECTRON_RUN_AS_NODE=1')
      expect(readFileSync(launcher, 'utf-8')).toContain('permission-hook.mjs')
    } else {
      expect(launcher).toBe(script)
    }
  })
})

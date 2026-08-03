/**
 * F02 API smoke against loopback unlock/config server.
 * Usage (with Electron/dev already running, or after starting this alone is NOT enough —
 * vault needs Electron app):
 *
 *   $env:ENGRENACODE_USER_DATA = "$env:TEMP\engrena-smoke-f02"
 *   pnpm dev   # separate terminal
 *   node scripts/smoke-f02.mjs
 */
const BASE = 'http://127.0.0.1:5174'
const PASSWORD = process.env.SMOKE_VAULT_PASSWORD || 'smoke-f02-pass'
const WORKSPACE = process.env.SMOKE_WORKSPACE || '~/smoke-f02'

const results = []

function record(id, ok, detail) {
  results.push({ id, ok, detail })
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${id}: ${detail}`)
}

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['x-engrenacode-session'] = token
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { status: res.status, json }
}

async function main() {
  // A2 first: unauthorized without session
  {
    const r = await req('GET', '/api/config/status')
    record('A2', r.status === 401, `status=${r.status}`)
  }

  // Unlock
  const unlock = await req('POST', '/api/vault/unlock', {
    body: { workspace: WORKSPACE, password: PASSWORD },
  })
  if (!unlock.json?.unlocked || !unlock.json?.sessionToken) {
    record('UNLOCK', false, JSON.stringify(unlock))
    printSummaryAndExit(1)
    return
  }
  record('UNLOCK', true, 'unlocked + sessionToken')
  const token = unlock.json.sessionToken

  {
    const r = await req('GET', '/api/config/status', { token })
    const ok =
      r.status === 200 &&
      r.json?.claude &&
      r.json?.clis &&
      r.json?.prompt &&
      r.json?.github
    record('A1', ok, `status=${r.status} keys=${Object.keys(r.json || {}).join(',')}`)
  }

  {
    const a = await req('POST', '/api/config/claude/mode', {
      token,
      body: { mode: 'subscription' },
    })
    const b = await req('POST', '/api/config/claude/mode', {
      token,
      body: { mode: 'api-key' },
    })
    // restore subscription for further tests
    await req('POST', '/api/config/claude/mode', {
      token,
      body: { mode: 'subscription' },
    })
    record(
      'A3',
      a.status === 200 &&
        a.json?.mode === 'subscription' &&
        b.status === 200 &&
        b.json?.mode === 'api-key',
      `sub=${a.status}/${a.json?.mode} api=${b.status}/${b.json?.mode}`,
    )
  }

  {
    const r = await req('POST', '/api/config/claude/test', { token })
    record(
      'A4',
      (r.status === 200 || r.status === 429) && typeof r.json?.detail === 'string',
      `status=${r.status} success=${r.json?.success}`,
    )
  }

  {
    const r = await req('POST', '/api/config/clis/test', { token })
    record(
      'A5',
      r.status === 200 && r.json?.results && typeof r.json?.summary === 'string',
      `status=${r.status} summary=${r.json?.summary}`,
    )
  }

  {
    const save = await req('POST', '/api/config/prompt/save', {
      token,
      body: { prompt: 'Smoke prompt F02' },
    })
    const restore = await req('POST', '/api/config/prompt/restore', { token })
    record(
      'A6',
      save.status === 200 &&
        save.json?.isDefault === false &&
        restore.status === 200 &&
        restore.json?.isDefault === true,
      `save=${save.status} restore=${restore.status}`,
    )
  }

  {
    const spaces = await req('POST', '/api/config/github/token', {
      token,
      body: { token: 'ghp_ ab' },
    })
    const short = await req('POST', '/api/config/github/token', {
      token,
      body: { token: 'ghp_12' },
    })
    const badPrefix = await req('POST', '/api/config/github/token', {
      token,
      body: { token: 'not_a_github_token' },
    })
    record(
      'A7',
      spaces.status === 400 && short.status === 400 && badPrefix.status === 400,
      `spaces=${spaces.status} short=${short.status} prefix=${badPrefix.status}`,
    )
  }

  {
    const r = await req('POST', '/api/config/github/token', {
      token,
      body: { token: 'ghp_12345678' },
    })
    record('A8', r.status === 200 && r.json?.saved === true, `status=${r.status}`)
  }

  {
    const r = await req('POST', '/api/config/github/token', {
      token,
      body: { token: '' },
    })
    record('A9', r.status === 200 && r.json?.saved === true, `status=${r.status}`)
  }

  const failed = results.filter((r) => !r.ok).length
  printSummaryAndExit(failed === 0 ? 0 : 1)
}

function printSummaryAndExit(code) {
  console.log('\n--- summary ---')
  for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.id}`)
  }
  process.exit(code)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

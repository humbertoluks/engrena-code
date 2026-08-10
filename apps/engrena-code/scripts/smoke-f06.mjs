/**
 * F06 Rules API smoke against loopback unlock/rules server.
 *
 *   $env:ENGRENACODE_USER_DATA = "$env:TEMP\engrena-smoke-f06"
 *   pnpm dev   # separate terminal
 *   node scripts/smoke-f06.mjs
 */
const BASE = 'http://127.0.0.1:5174'
const PASSWORD = process.env.SMOKE_VAULT_PASSWORD || 'smoke-onda2-pass'
const WORKSPACE = process.env.SMOKE_WORKSPACE || '~/smoke-onda2'
const PROJECT = 'smoke-proj-f06'

const results = []

function record(id, ok, detail) {
  results.push({ id, ok, detail })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}: ${detail}`)
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
  {
    const r = await req('GET', '/api/rules')
    record('A0_unauth', r.status === 401 || r.status === 423, `status=${r.status}`)
  }

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

  // cleanup leftover smoke names if re-run
  {
    const list = await req('GET', '/api/rules', { token })
    for (const rule of list.json?.rules ?? []) {
      if (typeof rule.name === 'string' && rule.name.startsWith('smoke-f06-')) {
        await req('DELETE', `/api/rules/${rule.id}`, { token })
      }
    }
  }

  {
    const r = await req('POST', '/api/rules', {
      token,
      body: { name: 'smoke-f06-basic', content: 'Sempre use TypeScript.', isGlobal: false },
    })
    record(
      'A1_create',
      r.status === 201 && r.json?.rule?.id && r.json.rule.name === 'smoke-f06-basic',
      `status=${r.status} id=${r.json?.rule?.id}`,
    )
  }

  {
    const r = await req('POST', '/api/rules', {
      token,
      body: { name: 'quebra\nlinha', content: 'x' },
    })
    record(
      'A2_crlf',
      r.status === 400 && (r.json?.error?.code === 'invalid_request' || r.json?.error?.code === 'validation_error'),
      `status=${r.status} code=${r.json?.error?.code}`,
    )
  }

  {
    const huge = 'a'.repeat(1024 * 1024 + 1)
    const r = await req('POST', '/api/rules', {
      token,
      body: { name: 'smoke-f06-huge', content: huge },
    })
    record('A3_too_long', r.status === 400 && r.json?.error?.code === 'too_long', `status=${r.status}`)
  }

  {
    const r = await req('POST', '/api/rules', {
      token,
      body: { name: 'smoke-f06-basic', content: 'dup' },
    })
    record('A4_conflict', r.status === 409 && r.json?.error?.code === 'rule_name_conflict', `status=${r.status}`)
  }

  {
    const soft = 'b'.repeat(9 * 1024)
    const r = await req('POST', '/api/rules', {
      token,
      body: { name: 'smoke-f06-soft', content: soft, isGlobal: false },
    })
    record('A5_soft_ok', r.status === 201 && r.json?.rule?.id, `status=${r.status}`)
  }

  let globalId = null
  {
    const r = await req('POST', '/api/rules', {
      token,
      body: {
        name: 'smoke-f06-global',
        content: 'Rule global smoke.',
        isGlobal: true,
      },
    })
    globalId = r.json?.rule?.id ?? null
    record('A6_global', r.status === 201 && globalId, `status=${r.status} id=${globalId}`)
  }

  {
    const suppress = await req('PUT', `/api/projects/${PROJECT}/rules/${globalId}`, {
      token,
      body: { enabled: false },
    })
    const list = await req('GET', `/api/projects/${PROJECT}/rules`, { token })
    const row = (list.json?.rules ?? []).find((x) => x.id === globalId)
    record(
      'A7_suppress',
      suppress.status === 200 &&
        row?.suppressedHere === true &&
        row?.activeInProject === false,
      `status=${suppress.status} suppressed=${row?.suppressedHere} active=${row?.activeInProject}`,
    )
  }

  let localId = null
  {
    const create = await req('POST', '/api/rules', {
      token,
      body: { name: 'smoke-f06-local', content: 'Rule local smoke.', isGlobal: false },
    })
    localId = create.json?.rule?.id ?? null
    const link = await req('PUT', `/api/projects/${PROJECT}/rules/${localId}`, {
      token,
      body: { enabled: true },
    })
    const list = await req('GET', `/api/projects/${PROJECT}/rules`, { token })
    const row = (list.json?.rules ?? []).find((x) => x.id === localId)
    record(
      'A8_link_local',
      create.status === 201 &&
        link.status === 200 &&
        row?.linked === true &&
        row?.activeInProject === true,
      `linked=${row?.linked} active=${row?.activeInProject}`,
    )
  }

  {
    const r = await req('GET', '/api/rules/counts', { token })
    record(
      'A9_counts',
      r.status === 200 && typeof r.json?.global === 'number',
      `status=${r.status} global=${r.json?.global} active=${JSON.stringify(r.json?.activeByProject ?? {})}`,
    )
  }

  {
    const list = await req('GET', '/api/rules', { token })
    record(
      'A10_list',
      list.status === 200 && Array.isArray(list.json?.rules) && list.json.rules.length >= 1,
      `status=${list.status} n=${list.json?.rules?.length}`,
    )
  }

  const failed = results.filter((r) => !r.ok).length
  printSummaryAndExit(failed === 0 ? 0 : 1)
}

function printSummaryAndExit(code) {
  console.log('\n--- summary ---')
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.id}`)
  process.exit(code)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * F07 SubAgents API smoke against loopback unlock/subagents server.
 *
 *   $env:ENGRENACODE_USER_DATA = "$env:TEMP\engrena-smoke-f07"
 *   pnpm dev   # separate terminal
 *   node scripts/smoke-f07.mjs
 */
const BASE = 'http://127.0.0.1:5174'
const PASSWORD = process.env.SMOKE_VAULT_PASSWORD || 'smoke-onda2-pass'
const WORKSPACE = process.env.SMOKE_WORKSPACE || '~/smoke-onda2'
const PROJECT = 'smoke-proj-f07'

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

function baseInput(overrides = {}) {
  return {
    name: 'smoke-f07-revisor',
    description: 'Revisa diffs em busca de vulnerabilidades.',
    prompt: 'Você é um revisor de segurança.',
    provider: 'claude',
    ...overrides,
  }
}

async function main() {
  {
    const r = await req('GET', '/api/subagents')
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

  {
    const list = await req('GET', '/api/subagents', { token })
    for (const s of list.json?.subagents ?? []) {
      if (typeof s.name === 'string' && s.name.startsWith('smoke-f07-')) {
        await req('DELETE', `/api/subagents/${s.id}`, { token })
      }
    }
  }

  let idA = null
  {
    const r = await req('POST', '/api/subagents', { token, body: baseInput() })
    idA = r.json?.subagent?.id ?? null
    record(
      'A1_create',
      r.status === 201 && idA && r.json.subagent.provider === 'claude',
      `status=${r.status} id=${idA}`,
    )
  }

  {
    const providers = ['codex', 'kimi', 'inherit']
    const oks = []
    for (const provider of providers) {
      const r = await req('POST', '/api/subagents', {
        token,
        body: baseInput({ name: `smoke-f07-${provider}`, provider }),
      })
      oks.push(r.status === 201)
      if (r.json?.subagent?.id) {
        // keep for link test if needed; cleanup later via prefix
      }
    }
    record('A2_providers', oks.every(Boolean), `ok=${oks.join(',')}`)
  }

  {
    const r = await req('POST', '/api/subagents', {
      token,
      body: baseInput({ name: 'smoke-f07-grok', provider: 'grok' }),
    })
    record(
      'A3_reject_grok',
      r.status === 400 && r.json?.error?.code === 'validation_error',
      `status=${r.status} code=${r.json?.error?.code}`,
    )
  }

  {
    const r = await req('POST', '/api/subagents', { token, body: baseInput() })
    record(
      'A4_conflict',
      r.status === 409 && r.json?.error?.code === 'subagent_name_conflict',
      `status=${r.status}`,
    )
  }

  {
    const r = await req('POST', '/api/subagents', {
      token,
      body: baseInput({ name: 'smoke-f07-huge', prompt: 'a'.repeat(1_048_577) }),
    })
    record('A5_too_long', r.status === 400 && r.json?.error?.code === 'too_long', `status=${r.status}`)
  }

  let idB = null
  {
    const b = await req('POST', '/api/subagents', {
      token,
      body: baseInput({ name: 'smoke-f07-segundo', provider: 'codex' }),
    })
    idB = b.json?.subagent?.id ?? null
    const linkA = await req('PUT', `/api/projects/${PROJECT}/subagents/${idA}`, {
      token,
      body: { enabled: true },
    })
    const linkB = await req('PUT', `/api/projects/${PROJECT}/subagents/${idB}`, {
      token,
      body: { enabled: true },
    })
    const order = await req('PUT', `/api/projects/${PROJECT}/catalog-order`, {
      token,
      body: {
        kind: 'subagents',
        items: [
          { id: idA, enabled: true, sortOrder: 1 },
          { id: idB, enabled: true, sortOrder: 0 },
        ],
      },
    })
    const sorted = order.json?.subagents ?? []
    const first = sorted.find((s) => s.id === idB)
    record(
      'A6_link_reorder',
      linkA.status === 200 &&
        linkB.status === 200 &&
        order.status === 200 &&
        first?.sortOrder === 0,
      `linkA=${linkA.status} linkB=${linkB.status} order=${order.status} bSort=${first?.sortOrder}`,
    )
  }

  {
    const r = await req('GET', '/api/subagents/counts', { token })
    record(
      'A7_counts',
      r.status === 200 &&
        typeof r.json?.global === 'number' &&
        r.json.global >= 1 &&
        (r.json.linkedByProject?.[PROJECT] ?? 0) >= 1,
      `global=${r.json?.global} linked=${JSON.stringify(r.json?.linkedByProject ?? {})}`,
    )
  }

  {
    const list = await req('GET', '/api/subagents', { token })
    const providers = new Set((list.json?.subagents ?? []).map((s) => s.provider))
    const forbidden = ['glm', 'minimax', 'grok'].some((p) => providers.has(p))
    record(
      'A8_provider_set',
      list.status === 200 && !forbidden,
      `providers=${[...providers].join(',')}`,
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

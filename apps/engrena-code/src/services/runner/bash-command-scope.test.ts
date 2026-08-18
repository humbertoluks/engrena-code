import { describe, expect, it } from 'vitest'
import {
  allowlistKeyForVerb,
  commandFromParams,
  commandScope,
  commandVerb,
  isCoveredByAllowlist,
  keysToGrant,
  splitCommandSegments,
} from './bash-command-scope.js'

describe('commandFromParams', () => {
  it('lê `command` do payload do PreToolUse', () => {
    expect(commandFromParams({ command: '  git status  ' })).toBe('git status')
  })

  it('recusa payload sem comando, vazio ou gigante', () => {
    expect(commandFromParams(null)).toBeNull()
    expect(commandFromParams({})).toBeNull()
    expect(commandFromParams({ command: 42 })).toBeNull()
    expect(commandFromParams({ command: '   ' })).toBeNull()
    expect(commandFromParams({ command: 'a'.repeat(4097) })).toBeNull()
  })
})

describe('splitCommandSegments', () => {
  it('quebra por &&, ||, ; e |', () => {
    expect(splitCommandSegments('cd /tmp && printf x > a.txt')).toEqual(['cd /tmp', 'printf x > a.txt'])
    expect(splitCommandSegments('make || echo falhou')).toEqual(['make', 'echo falhou'])
    expect(splitCommandSegments('ls; pwd')).toEqual(['ls', 'pwd'])
    expect(splitCommandSegments('cat a | grep b')).toEqual(['cat a', 'grep b'])
  })

  it('não quebra dentro de aspas', () => {
    expect(splitCommandSegments(`echo "a; b" && ls`)).toEqual([`echo "a; b"`, 'ls'])
    expect(splitCommandSegments(`echo 'x && y'`)).toEqual([`echo 'x && y'`])
  })
})

describe('commandVerb', () => {
  it('pega o primeiro token', () => {
    expect(commandVerb('git status')).toBe('git')
    expect(commandVerb('  pnpm   test ')).toBe('pnpm')
    expect(commandVerb('ls')).toBe('ls')
  })

  it('pula atribuição de env', () => {
    expect(commandVerb('CI=1 pnpm test')).toBe('pnpm')
    expect(commandVerb('FOO=a BAR=b node x.js')).toBe('node')
  })

  it('recusa o que não é verbo simples', () => {
    expect(commandVerb('./script.sh')).toBeNull()
    expect(commandVerb('$(echo git) status')).toBeNull()
    expect(commandVerb('(cd /tmp)')).toBeNull()
    expect(commandVerb('> arquivo')).toBeNull()
    expect(commandVerb('/usr/bin/git status')).toBeNull()
    expect(commandVerb('')).toBeNull()
  })
})

describe('commandScope', () => {
  it('deriva o verbo de um comando simples', () => {
    const scope = commandScope('Bash', { command: 'git status' })
    expect(scope.verbs).toEqual(['git'])
    expect(scope.verbKeys).toEqual(['Bash(git *)'])
    expect(keysToGrant(scope)).toEqual(['Bash(git *)'])
  })

  /**
   * O caso que motivou tudo: `cd … && printf … > arquivo`. Derivar só do começo da linha daria
   * `Bash(cd *)`, e a partir daí **qualquer** comando encadeado depois de um `cd` passaria sem
   * card — muito além do que o usuário autorizou ao clicar em "Permitir todos".
   */
  it('cobre todos os segmentos de um comando encadeado', () => {
    const scope = commandScope('Bash', {
      command: `cd "C:/Users/Me/dev/HomologacaoEngrena" && printf 'teste\\n' > teste.txt`,
    })
    expect(scope.verbs).toEqual(['cd', 'printf'])
    expect(scope.verbKeys).toEqual(['Bash(cd *)', 'Bash(printf *)'])
  })

  it('não repete verbo', () => {
    expect(commandScope('Bash', { command: 'git add -A && git commit -m x' }).verbs).toEqual(['git'])
  })

  it('cai na chave larga quando algum segmento é ilegível', () => {
    const scope = commandScope('Bash', { command: 'cd /tmp && ./deploy.sh' })
    expect(scope.verbKeys).toEqual([])
    expect(keysToGrant(scope)).toEqual(['Bash'])
  })

  it('cai na chave larga acima do teto de segmentos', () => {
    const command = Array.from({ length: 9 }, (_, i) => `cmd${i}`).join(' && ')
    expect(commandScope('Bash', { command }).verbKeys).toEqual([])
  })

  it('tool que não é shell nunca ganha escopo por comando', () => {
    const scope = commandScope('Write', { command: 'git status', file_path: 'a.txt' })
    expect(scope.verbKeys).toEqual([])
    expect(keysToGrant(scope)).toEqual(['Write'])
  })
})

describe('isCoveredByAllowlist', () => {
  const allowed = (set: Set<string>) => (key: string) => set.has(key)

  it('a chave larga cobre qualquer comando (compatibilidade com o modelo antigo)', () => {
    const scope = commandScope('Bash', { command: 'rm -rf build' })
    expect(isCoveredByAllowlist(scope, allowed(new Set(['Bash'])))).toBe(true)
  })

  it('verbo concedido cobre outra chamada do mesmo verbo', () => {
    const granted = commandScope('Bash', { command: 'git status' })
    const next = commandScope('Bash', { command: 'git log --oneline -1' })
    const set = new Set(keysToGrant(granted))
    expect(isCoveredByAllowlist(next, allowed(set))).toBe(true)
  })

  /** O ganho real sobre o modelo antigo: conceder um comando não concede o resto do shell. */
  it('verbo concedido NÃO cobre outro verbo', () => {
    const granted = commandScope('Bash', { command: 'git status' })
    const other = commandScope('Bash', { command: 'rm -rf build' })
    const set = new Set(keysToGrant(granted))
    expect(isCoveredByAllowlist(other, allowed(set))).toBe(false)
  })

  it('comando encadeado exige todos os verbos concedidos', () => {
    const chained = commandScope('Bash', { command: 'cd /tmp && printf x > a.txt' })
    expect(isCoveredByAllowlist(chained, allowed(new Set(['Bash(cd *)'])))).toBe(false)
    expect(isCoveredByAllowlist(chained, allowed(new Set(['Bash(cd *)', 'Bash(printf *)'])))).toBe(true)
  })

  it('sem escopo derivável e sem chave larga, não cobre', () => {
    const scope = commandScope('Bash', { command: './deploy.sh' })
    expect(isCoveredByAllowlist(scope, allowed(new Set(['Bash(git *)'])))).toBe(false)
  })

  it('allowlistKeyForVerb é o formato gravado', () => {
    expect(allowlistKeyForVerb('Bash', 'pnpm')).toBe('Bash(pnpm *)')
  })
})

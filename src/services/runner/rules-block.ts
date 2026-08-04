import type { Rule } from '../db/repositories/rules.js'

const PREAMBLE = `## Regras do dono (EngrenaCode Rules)

As regras abaixo sao PERMANENTES e devem ser seguidas em todo turno.
Precedencia em conflito: regra de PROJETO > regra GLOBAL > instrucoes de
arquivos do repo (CLAUDE.md/AGENTS.md) > convencoes gerais.`

const FOOTER = '--- fim das regras ---'

const DELIMITER_LINE_RE = /^---/

function sanitizeContent(content: string): string {
  return content
    .split('\n')
    .map((line) => (DELIMITER_LINE_RE.test(line) ? ` ${line}` : line))
    .join('\n')
}

export function composeRulesBlock(rules: readonly Rule[]): string {
  if (rules.length === 0) return ''

  const sections = rules.map((rule) => {
    const scope = rule.isGlobal ? 'global' : 'projeto'
    return `--- rule: ${rule.name} [${scope}] ---\n${sanitizeContent(rule.content)}`
  })

  return [PREAMBLE, '', ...sections, '', FOOTER].join('\n')
}

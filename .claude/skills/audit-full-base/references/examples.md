# Exemplos — audit-full-base

## Relato ao usuário (fim da passagem)

```
Auditoria full-base — docs/AUDIT-CODE-REVIEW.md
Veredito: bloqueado
Abertos: 1 🔴 / 9 🟡 · Corrigidos (tipos): 32
Top: D07 smoke ausente em features com UI Feito
Coding Experts atualizadas: coding-nodejs/project.md, coding-react/project.md, coding-vitest/project.md
src/ não alterado.
```

## Linha na tabela de abertos

| ID | Stack | Sev | Frente | Local | Problema | Regra |
|----|--------|-----|--------|-------|----------|-------|
| R04 | `Node.js` | 🟡 | rob | `ws-upgrade.ts:18` | Token de sessão aceito via query string | [R-ws-query-token-legacy](#r-ws-query-token-legacy) |

## Linha na tabela de corrigidos

| ID | Stack | Tipo | Evidência | Regra |
|----|--------|------|-----------|-------|
| C31 | `Node.js` | `incomplete-vcs-url-redaction` | `055807d` + `process-error.test.ts` | [RC-vcs-url-redaction](#rc-vcs-url-redaction) |

## Prompt de subagente (frente 1, escopo full-base)

```
Leia integralmente .claude/skills/review-architecture/SKILL.md e execute a checklist
COMPLETA com escopo `src/` (base inteira — ignore o default "diff do branch" e a regra
"diff vazio → pare"). Modo leitura absoluto: não edite, não commite, não rode
biome --write / tsc -b / pnpm build. Rode os comandos rg da checklist de verdade e cite
arquivo:linha em todo achado. Retorne no formato de saída da skill.
```

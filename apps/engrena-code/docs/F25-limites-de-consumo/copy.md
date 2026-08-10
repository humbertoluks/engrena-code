# Catálogo de copy: F25-limites-de-consumo

**Produto:** EngrenaCode  
**Fonte:** LionCodeLabs `UsageLimits.tsx` (cotas) + PRD §6 F25 (USD)  
**Mapa de rename:** `LionCode → EngrenaCode`  
**Última atualização:** 2026-08-08

## Convenção de ids

`limits.{{slot}}`

## Telas

### limits.fonte (sidebar — referência, fora do contrato Engrena F25)

| Id | Texto | Notas |
|----|-------|-------|
| `limits.fonte.summary` | Limites | summary do `<details>` |
| `limits.fonte.loading` | Consultando… | |
| `limits.fonte.errorRetry` | Falha ao consultar os limites — tentar de novo | botão |
| `limits.fonte.unavailable` | Limites indisponíveis. | fallback `reason` |
| `limits.fonte.pctSuffix` | usado | ao lado do % |
| `limits.fonte.renewSameDay` | renova {time} | |
| `limits.fonte.renewOtherDay` | renova {day}, {time} | |

### limits.dest (`#consumo` — contrato F25)

| Id | Texto | Notas |
|----|-------|-------|
| `limits.dest.title` | Limites de consumo | PRD Experiência |
| `limits.dest.hint` | TODO | Explicar período mensal / vazio = sem limite |
| `limits.dest.label.scope` | Escopo | fixture / proposta |
| `limits.dest.scope.global` | Global | |
| `limits.dest.scope.project` | Este projeto | |
| `limits.dest.label.usd` | Limite (USD) | |
| `limits.dest.mode.warn` | Avisar | PRD |
| `limits.dest.mode.block` | Bloquear | PRD |
| `limits.dest.progress.label` | Gasto do período | fixture |
| `limits.dest.progress.value` | ${spent} / ${limit} · {pct}% | proposta |
| `limits.dest.banner80` | TODO | PRD: aviso 80% |
| `limits.dest.banner100` | TODO | PRD: aviso/bloqueio 100% |
| `limits.dest.link.adjust` | Ajustar limite | fixture |
| `limits.dest.blockedTurn` | TODO | Recusa de novo turno + apontar ajuste |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{time}` | HH:mm local |
| `{day}` | dd/MM |
| `{spent}` / `{limit}` | USD formatado |
| `{pct}` | percentual inteiro |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| Textos `limits.dest.banner*` / `blockedTurn` / `hint` | PRD descreve comportamento sem string literal fechada | TODO design |
| Decisão sobre portar `limits.fonte.*` | Produto diferente (cotas provider) | perguntar |

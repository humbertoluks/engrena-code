# Catálogo de copy: avisos de runtime e permissão

**Feature:** F30-avisos-de-runtime-e-permissao  
**Destino:** EngrenaCode  
**Última atualização:** 2026-08-18

Fonte de verdade das strings **novas ou reescritas** por esta feature. Anatomia do card de permissão e chips continuam em `docs/F03-workspace/copy.md`. Não inventar frase que cite `PreToolUse`, faixa `2.1.x`, “contrato de permissão” ou “o turno não foi bloqueado” na tarja do chat.

Marca: só EngrenaCode.

## Configuração — row Claude em CLIs de assinatura

| Id | Texto | Onde |
|----|-------|------|
| `cli.version.line` | {version} | Caption `text-muted` `text-[11.5px]` `font-mono` na row Claude, depois de instalado/logado. Só a versão parseada (`2.1.234`). Sem faixa, sem “validado”. |
| `cli.version.unverified` | Ainda não conferida nesta versão. | Segunda caption, só quando `status` é `above-max` ou `below-min`. Tom muted, nunca amber de alarme. |
| `cli.version.unparseable` | Versão do Claude CLI ilegível. | Segunda caption quando `--version` não parseia. Sem colar a saída crua. |
| `cli.version.unavailable` | *(vazio)* | Binário ausente: a row já diz “não instalado”. Não acrescentar linha. |

## Card de permissão (delta sobre F03)

| Id | Texto | Onde |
|----|-------|------|
| `permission.countdown` | {mm}:{ss} | Meta à direita do header, `text-muted` `text-[10.5px]` `font-mono tabular-nums`. Derivado de `gate.expiresAt`. Some quando restam ≥ 2 min em display estável (primeiro tick já mostra). |
| `permission.countdown.warn` | {mm}:{ss} | Mesmo slot, `text-amber`, quando restam ≤ 15 s. |

Chips, título e hint do card **não mudam** (`permission.*` de F03).

## Tarja âmbar do workspace (negação)

A tarja continua existindo para MCP e para negação nativa. Copy de produto, uma ou duas frases, sem aula de runtime.

| Id | Texto | Caso (`nativeDenialCase`) |
|----|-------|---------------------------|
| `denial.expiry.lead` | A permissão de {tool} expirou. | `after-gate-expiry` |
| `denial.expiry.advice` | Peça de novo ao agente. | `after-gate-expiry` |
| `denial.userDeny.lead` | Você negou {tool}. | `after-user-denial` |
| `denial.userDeny.advice` | Peça de novo e conceda no card, ou use “Permitir todos”. | `after-user-denial` |
| `denial.cancel.lead` | O turno parou com a permissão de {tool} ainda aberta. | `after-turn-cancel` |
| `denial.cancel.advice` | Peça de novo quando quiser retomar. | `after-turn-cancel` |
| `denial.unavailable.lead` | Não deu para pedir permissão de {tool}. | `broker-unavailable` |
| `denial.unavailable.advice` | Peça de novo ao agente. | `broker-unavailable` |
| `denial.never.lead` | {tool} foi recusada sem aparecer um card. | `never-brokered` |
| `denial.never.advice` | Peça de novo. Se repetir, revise o nível de acesso da thread. | `never-brokered` |
| `denial.never.cliCause` | A versão do Claude CLI nesta máquina ainda não foi conferida. | `never-brokered` **e** versão `above-max` / `below-min` / `unparseable`. Uma frase. Sem números de faixa. |
| `denial.afterGrant.lead` | {tool} foi liberada aqui, mas um hook do Claude CLI negou em seguida. | `after-broker-grant` |
| `denial.afterGrant.advice` | Ajuste esse hook nos settings do Claude CLI, ou peça outro caminho ao agente. | `after-broker-grant` |
| `denial.conflict.lead` | {tool} teve decisões diferentes neste turno. | `conflicting-decisions` |
| `denial.conflict.advice` | Peça de novo e responda ao card que aparecer. | `conflicting-decisions` |

`decisionReasonType` / `decisionReason` do CLI **não entram na tarja**. Continuam no `log_entries` (já composto no runner).

## Log (não é UI)

A linha técnica de versão (`claudeCliVersionLogLine`) permanece em `log_entries` kind `task`. Não reescrever para “produto”: Registros (F08) e o work log são o lugar certo para faixa min/max e “turno não bloqueado”.

## Placeholders

| Token | Significado |
|-------|-------------|
| `{version}` | Trio `x.y.z` parseado |
| `{tool}` | Nome da ferramenta (`Bash`, `Write`, …); fallback `desconhecida` |
| `{mm}:{ss}` | Minutos e segundos restantes, zero-padded |

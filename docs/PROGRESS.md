# EngrenaCode — Progresso do MVP

Fonte de verdade operacional do que está **feito neste repo** (`main`), versus o PRD e o plano Reversa (`_reversa_forward`). Atualizar ao fechar cada feature (spec + smoke + merge).

**Atualizado:** 2026-08-03  
**HEAD de referência:** `eaa9a0c` (feat F02) + commits F01 / F01.1

---

## Resumo por feature

| # | Feature | Status | Evidência neste repo | Próximo passo |
|---|---------|--------|----------------------|---------------|
| F01 | Vault e Sessão Local | **Feito** | Branch `f01-vault-e-sessao-local` → merge; `LoginScreen`, vault, session middleware, IPC `engrenacode` | Manter estável |
| F01.1 | Design System | **Feito** | Branch `f01.1-design-system` → merge; tokens CSS, `useTheme`, splash `#0a0a0b` | Consumido por telas novas |
| F02 | Configuração MVP | **Feito** | Commit `eaa9a0c`; `#configuracao`; `docs/F02-*/smoke-results.md` (2026-08-03) | Alimenta F03/F04 (deferred) |
| F03 | Workspace | **Spec pronta** | `docs/F03-workspace/{ui,spec,plan}.md` — código ainda não iniciado | Implementar após stubs F05 ou com stubs |
| F04 | Dashboard | **Não iniciado** | — | Após F03 + catálogo |
| F05 | Skills | **Spec pronta** | `docs/F05-skills/{ui,copy,spec,plan}.md` | Implementar (Onda 2); soft cap ≤30 |
| F06 | Rules | **Spec pronta** | `docs/F06-rules/{ui,copy,spec,plan}.md` | Implementar (Onda 2); soft cap ≤15; hard 1 MiB |
| F07 | SubAgents | **Spec pronta** | `docs/F07-subagents/{ui,copy,spec,plan}.md` | Implementar (Onda 2); soft cap ≤10; idle 20 min |
| F08 | Registros | **Não iniciado** | — | Release 1.0 / Onda 4 |
| F09 | MCPs | **Não iniciado** | — | Release 1.0 / Onda 4 |
| F10 | API Keys | **Não iniciado** | — | Pode paralelizar com F03; release 1.0 |
| F11 | Consumo | **Não iniciado** | — | Versão 1.1 |

---

## Ondas (PRD §8)

| Onda | Features | Estado |
|------|----------|--------|
| 1 | F01, F01.1 | **Completa** |
| 2 | F02, F05, F06, F07 | **Parcial** — F02 feita; F05+F06+F07 spec pronta; implementação catálogo pendente |
| 3 | F03, F10 | **Bloqueada** até F05–F07 (F03 depende deles no grafo) |
| 4 | F04, F08, F09, F11 | Pendente |

**Próxima frente de produto:** fechar Onda 2 (Skills / Rules / SubAgents), depois F03 Workspace.

---

## Esclarecimentos

### F03 não está feita

Workspace completo no `_reversa_sdd` descreve o **sistema legado**, não o greenfield EngrenaCode. Smoke F02 marca cross-feature F03/F04 como **deferred**. Não confundir análise Reversa com entrega neste `src/`.

### `_reversa_forward/001-mvp-nucleo-operacional`

Plano expresso parou em `legitimate_stop` (non-destructive: `packages/**` legado). Actions T001–T018 continuam `[ ]` e **não** refletem o progresso real via `docs/F0*`. Preferir esta página + critérios no `docs/PRD.md` §9.

---

## Critérios PRD §9

Checkboxes de aceitação vivem em [`PRD.md`](./PRD.md) §9. Ao fechar uma feature: marcar `[x]` lá **e** atualizar a tabela acima na mesma mudança.

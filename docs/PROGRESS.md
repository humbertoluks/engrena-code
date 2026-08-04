# EngrenaCode — Progresso do MVP

Fonte de verdade operacional do que está **feito neste repo** (`main`), versus o PRD e o plano Reversa (`_reversa_forward`). Atualizar ao fechar cada feature (spec + smoke + merge).

**Atualizado:** 2026-08-04  
**HEAD de referência:** `eaa9a0c` (feat F02) + F05 + smoke F06/F07 (2026-08-04)

---

## Resumo por feature

| # | Feature | Status | Evidência neste repo | Próximo passo |
|---|---------|--------|----------------------|---------------|
| F01 | Vault e Sessão Local | **Feito** | Branch `f01-vault-e-sessao-local` → merge; `LoginScreen`, vault, session middleware, IPC `engrenacode` | Manter estável |
| F01.1 | Design System | **Feito** | Branch `f01.1-design-system` → merge; tokens CSS, `useTheme`, splash `#0a0a0b` | Consumido por telas novas |
| F02 | Configuração MVP | **Feito** | Commit `eaa9a0c`; `#configuracao`; `docs/F02-*/smoke-results.md` (2026-08-03) | Alimenta F03/F04 |
| F03 | Workspace | **Spec pronta** | `docs/F03-workspace/{ui,copy,spec,plan}.md` regenerados 2026-08-04 (Central; F05–F07 reais; `node:sqlite`; WS; `#principal`); PNG em `ui/principal-referencia.png`; código ainda não iniciado | Implementar via `implement-feature` |
| F04 | Dashboard | **Não iniciado** | — | Após F03 + catálogo |
| F05 | Skills | **Feito** | CRUD `#skills` + vínculo + `skill-registry`; `ProjectSkillsModal`; unitários verdes | Montar no Repo Harness F03 |
| F06 | Rules | **Feito (catálogo)** | `#rules` + handlers + SQLite + registries; `docs/F06-rules/smoke-results.md` (2026-08-04); §9 override + CR/LF `[x]`; bloco no turno deferred F03 | Consumido por F03 no dispatch |
| F07 | SubAgents | **Feito (catálogo)** | `#subagents` + handlers + gate/idle unit; `docs/F07-subagents/smoke-results.md` (2026-08-04); §9 CRUD/providers + Codex gate `[x]`; call_subagent/idle UI deferred F03 | Consumido por F03 no dispatch |
| F08 | Registros | **Não iniciado** | — | Release 1.0 / Onda 4 |
| F09 | MCPs | **Não iniciado** | — | Release 1.0 / Onda 4 |
| F10 | API Keys | **Não iniciado** | — | Pode paralelizar com F03; release 1.0 |
| F11 | Consumo | **Não iniciado** | — | Versão 1.1 |

---

## Ondas (PRD §8)

| Onda | Features | Estado |
|------|----------|--------|
| 1 | F01, F01.1 | **Completa** |
| 2 | F02, F05, F06, F07 | **Completa (catálogo)** — F02+F05+F06+F07 smoke; integração no turno fica no F03 |
| 3 | F03, F10 | **Pronta para implementar F03** (spec + deps de catálogo); F10 paralelo |
| 4 | F04, F08, F09, F11 | Pendente |

**Próxima frente de produto:** implementar F03 Workspace (`#principal`).

---

## Esclarecimentos

### F03 não está feita

Workspace completo no `_reversa_sdd` descreve o **sistema legado**, não o greenfield EngrenaCode. Spec/plan/ui/copy em `docs/F03-workspace/` são o alvo EngrenaCode. Não confundir análise Reversa com entrega neste `src/`.

### F06 / F07 “Feito (catálogo)”

CRUD, vínculos, UI e smoke de catálogo fechados. Itens §9 que exigem turn-runner / activity no Workspace (`bloco no turno`, `call_subagent`, idle visível) ficam **deferred** até F03.

### `_reversa_forward/001-mvp-nucleo-operacional`

Plano expresso parou em `legitimate_stop` (non-destructive: `packages/**` legado). Actions T001–T018 continuam `[ ]` e **não** refletem o progresso real via `docs/F0*`. Preferir esta página + critérios no `docs/PRD.md` §9.

---

## Critérios PRD §9

Checkboxes de aceitação vivem em [`PRD.md`](./PRD.md) §9. Ao fechar uma feature: marcar `[x]` lá **e** atualizar a tabela acima na mesma mudança.

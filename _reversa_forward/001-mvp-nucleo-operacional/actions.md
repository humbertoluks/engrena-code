# Actions: 001-mvp-nucleo-operacional

> **Tracking EngrenaCode:** progresso real do MVP está em [`docs/PROGRESS.md`](../../docs/PROGRESS.md). Esta tabela Reversa ficou em parada non-destructive e **não** é a fonte de status do app novo.

> Total de ações: 18
> Paralelizáveis (`[//]`): 6
> Maior cadeia: T001 → T002 → T003 → T010 → T011 → T014 → T015 (7)

## Fase 1 — Preparação

| ID | Descrição | Dependências | Paralelismo | Arquivo alvo | Confiança | Status |
|----|-----------|--------------|-------------|--------------|-----------|--------|
| T001 | Scaffolding shell Electron + server loopback mínimo | — | — | `packages/shell/**` (novo) | 🟡 | [ ] |
| T002 | Implementar vault cifrado + unlock + sessão + backoff | T001 | — | `packages/vault/**` (novo) | 🟡 | [ ] |
| T003 | Design system tokens + tema + splash anti-flash | T001 | [//] | `packages/renderer/src/styles/**` (novo) | 🟡 | [ ] |
| T004 | Gate `#login` wired ao unlock | T002, T003 | — | `packages/renderer/**/Login*` (novo) | 🟡 | [ ] |

## Fase 2 — Testes

| ID | Descrição | Dependências | Paralelismo | Arquivo alvo | Confiança | Status |
|----|-----------|--------------|-------------|--------------|-----------|--------|
| T005 | Testes de unlock/falha/backoff/401-423 | T002 | [//] | `packages/vault/**/*.test.*` (novo) | 🟡 | [ ] |
| T006 | Testes de validação PAT e estados CLI | T007 | [//] | `packages/**/config*.test.*` (novo) | 🟡 | [ ] |

## Fase 3 — Núcleo

| ID | Descrição | Dependências | Paralelismo | Arquivo alvo | Confiança | Status |
|----|-----------|--------------|-------------|--------------|-----------|--------|
| T007 | Tela `#configuracao` Claude/CLIs/prompt/GitHub | T004 | — | `packages/renderer/**/Configuracao*` (novo) | 🟡 | [ ] |
| T008 | CRUD skills + vínculo + load_skill | T004 | [//] | `packages/**/skills/**` (novo) | 🟡 | [ ] |
| T009 | CRUD rules + override + injeção | T004 | [//] | `packages/**/rules/**` (novo) | 🟡 | [ ] |
| T010 | CRUD subagents + call_subagent + idle timeout | T004 | [//] | `packages/**/subagents/**` (novo) | 🟡 | [ ] |
| T011 | Workspace: projetos, threads, streaming, diffs, lease | T007, T008, T009, T010 | — | `packages/**/workspace/**` (novo) | 🟡 | [ ] |
| T012 | GitHub commit/push/PR bloqueado com running | T011 | — | `packages/**/git/**` (novo) | 🟡 | [ ] |

## Fase 4 — Integração

| ID | Descrição | Dependências | Paralelismo | Arquivo alvo | Confiança | Status |
|----|-----------|--------------|-------------|--------------|-----------|--------|
| T013 | Integrar harness turno (prompt global + rules + skills + subagents) | T011 | — | `packages/**/runner/**` (novo) | 🟡 | [ ] |
| T014 | Dashboard saúde + cards + inbox ≤20 + atalhos | T011, T007 | — | `packages/renderer/**/Dashboard*` (novo) | 🟡 | [ ] |
| T015 | Pós-unlock navega para `#dashboard` | T014 | — | `packages/renderer/**/routing*` (novo) | 🟡 | [ ] |

## Fase 5 — Polimento

| ID | Descrição | Dependências | Paralelismo | Arquivo alvo | Confiança | Status |
|----|-----------|--------------|-------------|--------------|-----------|--------|
| T016 | Mensagens de erro/empty states (login, config, dashboard, workspace) | T015 | — | `packages/renderer/**` (novo) | 🟡 | [ ] |
| T017 | Onboarding checklist documentada alinhada a `onboarding.md` | T015 | [//] | `_reversa_forward/001-mvp-nucleo-operacional/onboarding.md` | 🟡 | [ ] |
| T018 | Registrar legacy-impact / regression-watch greenfield | T016 | — | `_reversa_forward/001-mvp-nucleo-operacional/legacy-impact.md` | 🟡 | [ ] |

## Nota non-destructive

Se qualquer caminho em `Arquivo alvo` já existir no repositório antes desta execução, a ação correspondente **não** deve ser executada pelo `/reversa-coding` expresso. Parada legítima: risco de modificar arquivo pré-existente.

---
Gerado por reversa-to-do (expresso) em 2026-07-31T10:58:00Z

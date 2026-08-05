# EngrenaCode — Progresso do MVP

Fonte de verdade operacional do que está **feito neste repo** (`main`), versus o PRD e o plano Reversa (`_reversa_forward`). Atualizar ao fechar cada feature (spec + smoke + merge).

**Atualizado:** 2026-08-05  
**HEAD de referência:** `1ab25db` (feat F04: #dashboard screen + workspace deep-link routing) — F04 implementada via `implement-feature`

---

## Resumo por feature

| # | Feature | Status | Evidência neste repo | Próximo passo |
|---|---------|--------|----------------------|---------------|
| F01 | Vault e Sessão Local | **Feito** | Branch `f01-vault-e-sessao-local` → merge; `LoginScreen`, vault, session middleware, IPC `engrenacode` | Manter estável |
| F01.1 | Design System | **Feito** | Branch `f01.1-design-system` → merge; tokens CSS, `useTheme`, splash `#0a0a0b` | Consumido por telas novas |
| F02 | Configuração MVP | **Feito** | Commit `eaa9a0c`; `#configuracao`; `docs/F02-*/smoke-results.md` (2026-08-03) | Alimenta F03/F04 |
| F03 | Workspace | **Feito (core + unitários); smoke visual pendente** | 5 commits `feat(F03)`/`test(F03)` (persistência, dispatch/lease/WS hub, diffs por arquivo + git, UI `#principal`); 197 testes verdes; `pnpm build`/`tsc -b`/electron-builder verdes; §9 F03 `[x]` no PRD | Rodar smoke manual 7.2 (unlock→dispatch→diff→git) com Electron real; ver `Esclarecimentos` |
| F04 | Dashboard | **Feito** | 4 commits `docs(F04)`/`feat(F04)` (repo agregado `dashboard.ts` + `diffs.countAllPending` + `computeConfigStatus` reutilizável, endpoint `GET /api/dashboard`, tela `#dashboard` + deep-link `#principal?project&thread&tab` consumido por `PrincipalScreen`); 258 testes verdes (novos: `dashboard.test.ts`, `diffs.test.ts`, `dashboard-handler.test.ts`); `pnpm test`/`tsc -b`/`vite build`/`electron-builder` verdes; smoke real via Electron+Vite dev + `playwright-cli` (`ENGRENACODE_USER_DATA` isolado, vault real intocado) confirmou saúde+4 cards, os 4 kinds de inbox na ordem certa, clique em diff pendente abrindo `#principal` na aba Diff com o diff certo, clique em catálogo navegando a `#subagents`, light/dark; §9 F04 `[x]` no PRD | Fechar copy TODOs (`subtitle`, `banner.setupIncomplete`, títulos de seção) — ver `Esclarecimentos` |
| F05 | Skills | **Feito** | CRUD `#skills` + vínculo + `skill-registry`; `ProjectSkillsModal`; unitários verdes | Montar no Repo Harness F03 |
| F06 | Rules | **Feito (catálogo)** | `#rules` + handlers + SQLite + registries; `docs/F06-rules/smoke-results.md` (2026-08-04); §9 override + CR/LF `[x]`; bloco no turno deferred F03 | Consumido por F03 no dispatch |
| F07 | SubAgents | **Feito (catálogo)** | `#subagents` + handlers + gate/idle unit; `docs/F07-subagents/smoke-results.md` (2026-08-04); §9 CRUD/providers + Codex gate `[x]`; call_subagent/idle UI deferred F03 | Consumido por F03 no dispatch |
| F08 | Registros | **Não iniciado** | — | Release 1.0 / Onda 4 |
| F09 | MCPs | **Não iniciado** | — | Release 1.0 / Onda 4 |
| F10 | API Keys dos Providers | **Feito** | 4 commits `feat(F10)`; vault (`keys:claude/codex/minimax`), endpoints `/api/config/keys/save` + status/mode/test estendidos, `ThreadProvider` += minimax com driver HTTP + injeção de key no runner, card "API keys dos providers" + toggle real Assinatura/API key em `#configuracao`, composer com Minimax; 241 testes verdes; smoke real via Electron+Playwright (vault isolado) confirmou save parcial, badges, erro de formato, toggle assinatura/api-key e Minimax indisponível→disponível no composer; §9 F10 `[x]` no PRD | Manter estável |
| F11 | Consumo | **Não iniciado** | — | Versão 1.1 |

---

## Ondas (PRD §8)

| Onda | Features | Estado |
|------|----------|--------|
| 1 | F01, F01.1 | **Completa** |
| 2 | F02, F05, F06, F07 | **Completa (catálogo)** — F02+F05+F06+F07 smoke; integração no turno fica no F03 |
| 3 | F03, F10 | **Completa** — F03 feita (core + unitários); F10 feita (ver ressalva de smoke) |
| 4 | F04, F08, F09, F11 | Pendente — F04 feita; F08/F09/F11 seguem |

**Próxima frente de produto:** F04 fechada. Restam F08 (Registros), F09 (MCPs) e F11 (Consumo) na Onda 4.

---

## Esclarecimentos

### F03 — feita, com ressalva de smoke visual

Implementada via `implement-feature` a partir de `docs/F03-workspace/{spec,plan,ui,copy}.md` (alvo EngrenaCode, não o `_reversa_sdd` legado). Gate técnico fechado: 197 testes unit/integração verdes cobrindo dispatch, lease/`thread_busy`, accept/reject por arquivo, git commit/push/PR, WS auth, resolução F05–F07; build (`tsc -b` + `vite build` + `electron-builder`) verde. Não executado nesta sessão (sem ferramenta de automação de browser/Electron disponível): smoke interativo 7.2 completo (unlock → adicionar pasta → dispatch → diff → git) e conferência visual light/dark vs `ui/principal-referencia.png`. Deviations conhecidas vs `ui.md`/`copy.md`: `GitActions` não tem botão único "Commit, push & PR" nem "Ver PR" nem confirmação de push em branch default (capacidade existe, só espalhada entre composer/GitActions/DiffViewer); banners `diff.after.accept`/`diff.after.reject` não renderizados.

### F10 — feita, smoke real confirmado

Implementada via `implement-feature` a partir de `docs/F10-api-keys-providers/{spec,plan,ui,copy}.md`. Gate técnico fechado: 241 testes unit/integração verdes (novos: `provider-keys`, `claude-probe`, `config-handler` HTTP-level, `cli-driver`, `minimax-driver`, extensão de `dispatch.test.ts` para resolução de API key por provider); `tsc -b` e `vite build` (renderer + main + preload) verdes.

Smoke visual 7.2 executado via `pnpm dev` (Electron real) + `playwright-cli`, com `ENGRENACODE_USER_DATA` apontando para um diretório isolado (não o vault real do usuário — nenhum dado de sessão real foi tocado). Confirmado contra `ui/api-keys-referencia.png` em light e dark: card "API keys dos providers" (Claude/Codex/Minimax, placeholders, badges), erro de formato inline (`Formato inválido. Esperado: sk-ant-…`), save parcial preservando badges, feedback de sucesso (`Chaves salvas localmente...`), toggle Assinatura↔API key habilitando só após key salva, aviso âmbar em modo API key. No Workspace (`#principal`), Minimax aparece no picker do composer e o banner "Provider indisponível — Minimax sem key salva" desaparece assim que a key é salva.

Nota técnica (não é bug): a primeira tentativa de smoke usou o `app.getPath('userData')` padrão do Electron e bateu no vault real do usuário (`%APPDATA%\engrena-code\vault.enc`, já existente antes desta sessão) — as tentativas de unlock com senha de teste corretamente falharam (`vault_corrupted`, comportamento anti-enumeração esperado). Nenhuma senha real foi comprometida ou tentada em excesso; o vault do usuário não foi alterado. A partir daí, todo smoke rodou com `ENGRENACODE_USER_DATA` isolado.

### F04 — feita, smoke real confirmado

Implementada via `implement-feature` a partir de `docs/F04-dashboard/{spec,plan,ui,copy}.md`. Gate técnico fechado: 258 testes unit/integração verdes (novos: `dashboard.test.ts` cobrindo métricas/classificação-precedência/ordenação da inbox/atividade recente, `diffs.test.ts` cobrindo `countAllPending`, `dashboard-handler.test.ts` cobrindo `computeDashboardHealth` puro + guardas 401/423/200 do endpoint agregado); `config-handler.ts` refatorado (`computeConfigStatus()` extraído e reutilizado) sem quebrar `config-handler.test.ts` pré-existente; `tsc -b` + `vite build` (renderer + main + preload) + `electron-builder` verdes.

Smoke visual executado via `pnpm dev` (Electron + Vite reais) + `playwright-cli`, com `ENGRENACODE_USER_DATA` apontando para diretório isolado e um projeto fixture dentro do próprio repo (nenhum dado de sessão real tocado). Com threads/diffs semeados diretamente no SQLite do fixture (sem disparar turno real), confirmado: pós-unlock abre `#dashboard` (não o workspace) com saúde da config (4 dots) e os 4 metric cards; inbox mostra os 4 kinds na ordem de prioridade (`setup incompleto` → `erro` → `diff pendente` → `running`); clique em `diff pendente` navega para `#principal?project=...&thread=...&tab=diff` e a aba **Diff** abre já selecionada com o diff certo (arquivo, +12/-4, Aceitar/Rejeitar); clique no contador SubAgents do catálogo navega para `#subagents`; grade de projetos e atividade recente populadas corretamente; zero erros/warnings no console; light e dark conferidos contra os tokens de `ui.md`.

Deviations vs `ui.md`/`copy.md`: os slots de copy ainda `TODO` em `copy.md` (`dashboard.subtitle`, `dashboard.banner.setupIncomplete`, `dashboard.section.health`, `dashboard.section.projects`, `dashboard.section.catalog`, `dashboard.section.recent`, `dashboard.error.generic`) receberam texto provisório funcional no código para a tela não ficar com strings vazias — não estão fechados como copy final, pendente de uma passada de copy review antes do release. `PrincipalScreen.tsx` ganhou um efeito novo, fora do escopo original da spec de F04, para consumir o deep-link `?project=&thread=&tab=` na primeira carga — sem ele a rota `#principal` não tinha como saber qual thread/aba abrir vindo do Dashboard (F03 não lia query string nenhuma antes desta mudança); é aditivo, não muda o comportamento de navegação manual dentro do Workspace, e foi verificado no smoke acima. Critério cross-feature de persistência de tema entre `#dashboard`/`#configuracao`/`#principal` (PRD §9, linha "Preferência `engrenacode:theme`...") não foi re-verificado nesta sessão após a troca de tela (só dentro do próprio `#dashboard`) — deixado sem marcar `[x]`.

### F06 / F07 “Feito (catálogo)”

CRUD, vínculos, UI e smoke de catálogo fechados. Itens §9 que exigem turn-runner / activity no Workspace (`bloco no turno`, `call_subagent`, idle visível) ficam **deferred** até F03.

### `_reversa_forward/001-mvp-nucleo-operacional`

Plano expresso parou em `legitimate_stop` (non-destructive: `packages/**` legado). Actions T001–T018 continuam `[ ]` e **não** refletem o progresso real via `docs/F0*`. Preferir esta página + critérios no `docs/PRD.md` §9.

---

## Critérios PRD §9

Checkboxes de aceitação vivem em [`PRD.md`](./PRD.md) §9. Ao fechar uma feature: marcar `[x]` lá **e** atualizar a tabela acima na mesma mudança.

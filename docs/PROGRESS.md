# EngrenaCode — Progresso do MVP

Fonte de verdade operacional do que está **feito neste repo** (`main`), versus o PRD e o plano Reversa (`_reversa_forward`). Atualizar ao fechar cada feature (spec + smoke + merge).

**Atualizado:** 2026-08-05  
**HEAD de referência:** `069cd43` (fix F09: project-link MCPs bare array) — F09 implementada via `implement-feature`

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
| F08 | Registros | **Feito (core + unitários); smoke visual pendente** | 3 commits `feat(F08)` (schema `log_entries` + recovery de boot, endpoint `GET /api/logs` + wiring automático task/tool/git, tela `#registros` com `LogTable`); 47 testes novos/estendidos verdes (`log-entries.test.ts`, `threads.test.ts`, `logs-handler.test.ts`, `unlock-handler.test.ts`, extensões em `dispatch.test.ts`/`git-handler.test.ts`/`apply-diff.test.ts`); suite completa 323 testes verdes; `tsc -b`/`vite build` verdes; §9 primeiro AC `[x]` no PRD | Rodar smoke manual (unlock→turno→#registros→filtro/paginação→clique thread) com Electron real; ver `Esclarecimentos` |
| F09 | MCPs | **Feito; OAuth live não verificado** | 7 commits `feat(F09)`/`fix(F09)` (migração `mcps`/`project_mcps`, catálogo first-party de 14 presets, OAuth PKCE genérico via RFC 8414 + DCR, repositório + rotas CRUD/catálogo/secrets/OAuth/vínculo, `mcp-registry`/`prepareMcpsForDispatch` com wrapper loopback de segredo stdio + `--mcp-config` no `cli-driver`, tela `#mcps` + modais + harness + banner `mcp.notice`); 323 testes verdes; `tsc -b`/`vite build` verdes; smoke real via Electron+Playwright (vault isolado) confirmou instalar do catálogo, criar MCP custom com segredo, badge "requer credencial" e vínculo por projeto — achou e corrigiu 1 bug real (`GET /projects/:id/mcps` devolvia objeto, front esperava array); §9 3/4 itens `[x]` no PRD | Verificar OAuth Connect contra um vendor real; manter estável |
| F10 | API Keys dos Providers | **Feito** | 4 commits `feat(F10)`; vault (`keys:claude/codex/minimax`), endpoints `/api/config/keys/save` + status/mode/test estendidos, `ThreadProvider` += minimax com driver HTTP + injeção de key no runner, card "API keys dos providers" + toggle real Assinatura/API key em `#configuracao`, composer com Minimax; 241 testes verdes; smoke real via Electron+Playwright (vault isolado) confirmou save parcial, badges, erro de formato, toggle assinatura/api-key e Minimax indisponível→disponível no composer; §9 F10 `[x]` no PRD | Manter estável |
| F11 | Consumo | **Não iniciado** | — | Versão 1.1 |

---

## Ondas (PRD §8)

| Onda | Features | Estado |
|------|----------|--------|
| 1 | F01, F01.1 | **Completa** |
| 2 | F02, F05, F06, F07 | **Completa (catálogo)** — F02+F05+F06+F07 smoke; integração no turno fica no F03 |
| 3 | F03, F10 | **Completa** — F03 feita (core + unitários); F10 feita (ver ressalva de smoke) |
| 4 | F04, F08, F09, F11 | Quase completa — F04, F08 e F09 feitas; só F11 segue |

**Próxima frente de produto:** F04, F08 e F09 fechadas. Resta F11 (Consumo) na Onda 4; smoke visual manual de F08 e verificação de OAuth live de F09 ficam pendentes.

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

### F09 — feita, smoke real confirmado (OAuth live não verificado)

Implementada via `implement-feature` a partir de `docs/F09-mcps/{spec,plan,ui,copy}.md`. Gate técnico fechado: migração `mcps`/`project_mcps`; catálogo estático de 14 presets first-party (`secretEnv` mapeia env var → chave do vault; nenhum preset remoto carrega segredo em header, só OAuth); fluxo OAuth genérico via metadata RFC 8414 + Dynamic Client Registration (RFC 7591), com fallback `needs-client-id` e refresh-on-expiry; repositório + rotas HTTP para CRUD/catálogo/secrets/OAuth/vínculo por projeto (HTTPS obrigatório em remoto, HTTP só loopback, `vault:` rejeitado em headers); `mcp-registry`/`prepareMcpsForDispatch` resolvendo MCPs vinculados em `--mcp-config` (schema oficial da Claude Code CLI, confirmado via Context7) ou motivo de omissão, com wrapper loopback dedicado para nunca gravar segredo resolvido no arquivo de config em disco; `dispatch.ts` emite `mcp.notice` por MCP omitido sem abortar o turno; tela `#mcps` + `McpFormModal`/`McpCatalogModal`/`McpOauthControls`/`ProjectMcpsModal`, harness "MCPs" no `WorkspaceSidebar` e banner âmbar dispensável em `PrincipalScreen`. 323 testes verdes (repo, handler HTTP, `mcp-secrets`, `cli-driver` `--mcp-config`, integração em `dispatch.test.ts`); `tsc -b`/`vite build` (renderer+main+preload) verdes.

Smoke real via `pnpm dev` (Electron + Vite reais) + `playwright-cli`, com `ENGRENACODE_USER_DATA` isolado (vault real do usuário intocado): unlock → `#mcps` vazio → catálogo abre com os 14 presets e badges (OAuth/experimental/categoria) → instalar preset `filesystem` (sem segredo) aparece na lista → criar MCP custom `github-mcp` (stdio + `env` com `vault:github_token`) abre a seção "Segredos do cofre" dinamicamente e salva → grid com 2 cards, badges de transporte corretas → Workspace → adicionar projeto real → Repo Harness → "MCPs" abre `ProjectMcpsModal` mostrando `github-mcp` com badge âmbar "requer credencial" (secret não configurado) → linkar `filesystem` atualiza pill para "1 vinculado" e switch "on" em tempo real. O smoke achou e corrigiu 1 bug real: `GET /api/projects/:id/mcps` devolvia `{ mcps: [...] }`, mas `mcpsService.listForProject`/`ProjectMcpsModal` (espelhados do padrão de Skills) esperam o array puro — o overlay silenciosamente mostrava "Não foi possível carregar os MCPs do projeto" para todo projeto antes do fix.

Não verificado nesta sessão: conexão OAuth real contra um vendor (Linear/Notion/Sentry) — sem credenciais de app OAuth disponíveis neste ambiente; o mecanismo (discovery + DCR + PKCE + troca de código + refresh) está implementado e com testes de erro/estado, mas o caminho feliz completo (`Conectar` → autorizar no browser → `Conectado`) não foi exercitado ponta a ponta. Turno real via `--mcp-config` também não foi verificado contra um binário `claude`/`codex` real (nenhum instalado neste ambiente) — coberto só por teste unitário do `cli-driver` que injeta um spawn fake e confere o arquivo escrito. §9 do PRD: 3 dos 4 itens de F09 marcados `[x]`; o item que combina "secret ausente omite" + "OAuth Connect funciona" fica sem marcar porque só a metade "secret ausente" foi verificada de ponta a ponta.

Deviations vs `spec.md`/catálogo legado: presets do catálogo são um conjunto curado de 14 servers MCP públicos conhecidos (não uma cópia literal do catálogo LionCodeLabs, que não está disponível neste ambiente) — nenhum preset tem par key-mode/OAuth no mesmo nome, então o botão "Converter para OAuth" nunca aparece no catálogo padrão (API/mecanismo implementados e testados, sem cobertura de UI). Migração nomeada `003_mcps.ts` (F08 registrou a sua como `004` para não colidir, ver nota F08 acima).

### F08 — feita (core), com ressalva de smoke visual

Implementada via `implement-feature` a partir de `docs/F08-registros/{spec,plan,ui,copy}.md`. Gate técnico fechado: 47 testes novos/estendidos verdes cobrindo o repositório `log_entries` (create/list/filtro/paginação/ordenação DESC/cascade), `recoverRunningThreads` (reconciliação de boot), o endpoint `GET /api/logs` (guards 401/423, validação de `kind`/`limit`/`offset`, filtro, paginação), e os 4 pontos de escrita automática (`tool-result` em `dispatch.ts`, commit/push/PR — sucesso e falha de PR — em `git-handler.ts`, accept/reject em `apply-diff.ts`, recovery de boot em `unlock-handler.ts`); suite completa do repo (323 testes) e `tsc -b`/`vite build` verdes.

Não executado nesta sessão: smoke interativo real (Electron + Playwright) de `#registros` — havia uma instância do EngrenaCode já rodando localmente (porta `5174` ocupada) no momento da execução, e abrir uma segunda instância isolada exigiria derrubar a sessão ativa do usuário ou colidir na porta do unlock server (fixa, não reutilizável — ver `CLAUDE.md`). Não interrompida sem confirmação. Fica pendente: filtro/paginação/empty-states na UI real, clique no thread id abrindo `#principal` com a thread certa, e conferência visual light/dark vs `ui/registros-referencia.png`.

Decisão de escopo tomada nesta sessão (confirmada com o usuário): `kind='task'` só é gravado via reconciliação de boot (threads presas em `running` após restart do app viram `error` + 1 `log_entries`), espelhando fielmente o comportamento da fonte LionCodeLabs — EngrenaCode não tinha esse mecanismo antes de F08. Dispatch normal não grava `kind='task'`.

Deviations vs `spec.md`: migração nomeada `004_log_entries.ts` (não `003`, já ocupado por `003_mcps.ts` de F09 em progresso na mesma working tree); `gitCommit()` não retorna `branch`, então o evento de commit descreve só sha+subject; `LogEntry` ganhou `projectId` (JOIN com `threads`, não previsto na spec original) porque o deep-link do thread id para o Workspace precisa de `project` **e** `thread` no query string (`PrincipalScreen` não resolve o projeto a partir só da thread).

### F06 / F07 “Feito (catálogo)”

CRUD, vínculos, UI e smoke de catálogo fechados. Itens §9 que exigem turn-runner / activity no Workspace (`bloco no turno`, `call_subagent`, idle visível) ficam **deferred** até F03.

### `_reversa_forward/001-mvp-nucleo-operacional`

Plano expresso parou em `legitimate_stop` (non-destructive: `packages/**` legado). Actions T001–T018 continuam `[ ]` e **não** refletem o progresso real via `docs/F0*`. Preferir esta página + critérios no `docs/PRD.md` §9.

---

## Critérios PRD §9

Checkboxes de aceitação vivem em [`PRD.md`](./PRD.md) §9. Ao fechar uma feature: marcar `[x]` lá **e** atualizar a tabela acima na mesma mudança.

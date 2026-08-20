# Glossário — EngrenaCode

Termos técnicos e de produto usados na documentação, código e discussões.

**Atualizado:** 2026-08-20

---

## A–C

**Auto-accept-edits**  
Nível de acesso que aprova sem card a edição de arquivo pelas tools `Read`/`Write`/`Edit` (e correlatas) e, a partir de F31, uma lista fechada de comandos de shell de arquivo/leitura dentro da raiz do turno. Bash fora dessa lista, WebFetch e tools MCP externas continuam pedindo confirmação. Não é o `acceptEdits` do Claude Code (lá o modo também auto-aprova uma lista nativa de comandos de arquivo no shell). Ver F31 e [`CLAUDE.md`](../../../CLAUDE.md) Regras Aprendidas.

**Broker (permission)**  
Processo/hook que intercepta tool calls do CLI no turno e pede autorização ao usuário via card inline (`PermissionPrompt`) se o nível de acesso exigir. Script: `permission-hook.mjs`. No Windows o launcher é `permission-hook.cmd` (preserva stdin); no POSIX o settings prefixa `ELECTRON_RUN_AS_NODE=1` e chama o `.mjs` direto.

**CLI, Claude CLI**  
Binário `claude` — CLI oficial de Claude da Anthropic. Turnos Claude usam `claude -p` com `--output-format stream-json`. Outros providers (Codex, Kimi, Minimax, GLM, Grok) têm drivers próprios.

**CodeGraph**  
Índice local do repositório (F19): parser de símbolos, grafo de dependências, ferramentas `repo_graph_*` no MCP interno. Habilita navegação estrutural e autocomplete de código.

---

## D–F

**Delegate / Delegation**  
Ato de spawnar um subagent (filho) a partir de um turno (pai). O pai envia `call_subagent` e aguarda o resultado via WS. Ver F07, F15.

**Diff (pendente, aceito, rejeitado, conflito)**  
Mudança de arquivo detectada após um turno. Estados: `pending` (aguardando decisão do usuário), `accepted` (user concordou), `rejected` (user recusou), `conflict` (dois ou mais filhos em paralelo alteraram o mesmo arquivo — requer manual de qual ganhar). Ver F03, F18.

**Dispatch**  
Ato de criar um turno: coletar o contexto (regras, memória, catálogo), chamar o driver do provider, persistir em DB, emitir WS events. Função principal em `dispatch.ts`. Follow-up Claude passa `--resume <cli_session_id>` quando a thread já tem sessão; o primeiro turno não.

**Feature / Onda / Versão**

- **Feature:** Um produto entregável nomeado `Fxx`, ex. F03 Workspace. Em geral tem spec e plan; ui.md, copy.md e smoke quando há superfície ou evidência de tela.
- **Onda (Sprint):** Conjunto de features parallelizáveis. Ex.: Onda 3 = F03, F10, F17 (sem dependência 1:1).
- **Versão:** Release numerada. Ex.: v1.2 (F12–F17), v1.3 (F18–F27), v1.4 (F28–F31), v1.5 (F32–F35).

**Full-access**  
Nível de acesso (permission mode) que aprova todas as tools sem confirmação interativa. Oposto de `supervised`.

---

## G–L

**Gate / Gating**

- **Permission gate (F03):** Decisão em tempo de turno se a tool pode rodar (via broker).
- **Worktree git gate (F13):** Criação de worktree recusa com `worktree_git_required` se o repo não tem `.git` ou não tem HEAD (ex.: `git init` sem commit). Não bloqueia turno em modo `main`.
- **Vault gate:** Bloqueio 423 `vault_locked` se usuário não destravar o cofre.
- **Usage limit gate (F25):** Bloqueio se consumo de mês já passou o limite configurado.

**HTTP loopback**  
Servidor HTTP/WS em `127.0.0.1:5174` que o Electron sobe para o backend do app (vault, threads, diffs, git, MCPs). O renderer e o CLI do turno falam com essa porta. O Vite (5173) só serve o UI; não é proxy do backend.

**IPC (Inter-Process Communication)**  
Passagem de mensagens entre main process e renderer (Electron window). Canais nomeados no preload: `engrenacode:vault:*`, `engrenacode:dialog:open-folder`, `engrenacode:shell:open-external`, `engrenacode:terminal:*`. Não há canal genérico `engrenacode`.

**Lease**  
Lock in-memory que garante no máximo uma execução longa por projeto (dispatch, follow-up, accept de diff, git mutável). Adquirido via `acquireLease` em `project-execution.ts`; `LeaseBusyError` vira 409 `thread_busy`. Liberado quando a execução assenta.

---

## M–P

**MCP (Model Context Protocol)**  
Protocolo de ferramentas que o modelo pode chamar durante um turno. EngrenaCode tem MCP interno (`engrenacode` — skills, memória, codegraph, perguntas) e MCPs externos (integração com Linear, Slack, etc.).

**Permissão (permission mode, access level)**  
Controle de quais tools rodam sem confirmação: `full-access`, `auto-accept-edits`, `supervised`. Configurado por thread e aplicado pelo broker.

**PROGRESS.md**  
Fonte de verdade operacional. Tabela de F01–F35 com status (Feito/Pendente), evidência (path a spec/smoke), próximos passos. Atualizada a cada merge de feature. Não confundir com PRD.md (design/requisitos).

**PRD.md**  
Documento de Requisitos de Produto. Visão, personas, objetivos, roadmap, critérios de aceitação (§9). v1.3 fechou em 2026-08-08; o PRD recebeu F32–F35 (versão 1.5) em 2026-08-19. Extensões novas via `/prd-writer`.

---

## R–S

**Reasoning Level**  
Profundidade de raciocínio do modelo, do catálogo F16: `low` \| `medium` \| `high` \| `extra-high` \| `max` (ou `null` = default do provider). Claude e Codex expõem o conjunto completo; Kimi só `low`/`medium`/`high`; Minimax/GLM/Grok não têm. No driver Claude, `extra-high` vira `--effort xhigh`. Configurável por turno via composer.

**Rule / Regras**  
Instruções persistentes do usuário que aplicam a todo turno (sistema prompt). Criadas em `#rules`, persistidas no SQLite (`rules` / `project_rules`), aplicadas via `RuleRegistry` ao chamar `buildSystemPrompt`. Ver F06.

**Skill (MCP skill, load_skill)**  
Procedimento reutilizável (arquivo `.md` com frontmatter YAML + conteúdo). Carregado sob demanda via tool `load_skill` durante um turno (não como sistema prompt). Catálogo em `#skills`. Ver F05, F12.

**Smoke / Smoke test**  
Validação manual ou E2E de uma feature na máquina real (Electron + Playwright), descrita em `docs/F*-*/smoke-results.md`. Muitos smokes de feature sobem `pnpm dev` com `ENGRENACODE_USER_DATA` isolado. Validação do **build empacotado** é o [`RUNBOOK-HOMOLOGACAO.md`](./RUNBOOK-HOMOLOGACAO.md), não o smoke da pasta F\*.

**Subagent / SubAgents**  
Agente IA delegado a partir de um turno (pai). Pode rodar sozinho ou em paralelo com irmãos. Outputs (diffs, logs) agregados na timeline do pai. Ver F07, F15, F18.

**Supervised**  
Nível de acesso que pede confirmação (card inline) para TODA tool chamada (exceto tools internas sempre permitidas). Oposto de `full-access`.

---

## T–W

**Thread**  
Conversação IA + histórico + estado. Criada em projeto, persiste em DB (threads + messages + tool_calls + diffs). Follow-up Claude pode `--resume` a sessão do CLI.

**Thread state**  
Estado de execução: `idle` (pronto para turno novo), `running` (agente trabalhando), `waiting_permission` (card de permissão aberto), `waiting_user` (AskUserQuestion em espera), `stopping` (Parar pedido, ainda não assentou), `error` (falhou), `cancelled` (usuário parou), `committed` (terminado, diffs a decidir), `interrupted` (F35: app fechou com o turno vivo; não é falha nem cancel).

**Turn / Turno**  
Uma execução do agente. Input: thread, prompt, contexto (rules, memória, catálogo). Output: texto, tool calls, diffs. Persistido em DB sob a thread.

**Vault**  
Cofre criptografado local (AES-256-GCM + scrypt), arquivo `userData/vault.enc`. Armazena secrets (keys de provider/MCP/GitHub), journal de memória e flags (ex.: seed de catálogo). O `sessionToken` **não** vai no arquivo: nasce em memória no unlock e o renderer guarda cópia em `localStorage` (`sessionToken`) para o header `x-engrenacode-session`.

**Worktree (git worktree)**  
Cópia isolada do repositório criada para o turno em modo worktree, em `userData/worktrees/<projectId>/<threadId>`. Cleanup depois do turno: remove se a working tree estiver limpa; **retém** se houver alteração local (não só conflito F18). Ver F13, F18.

---

## Siglas

| Sigla | Significado |
|-------|-----------|
| **E2E** | End-to-End (teste com o app rodando; homologação usa o empacotado) |
| **HMR** | Hot Module Replacement (Vite recarrega módulo ao salvar) |
| **IPC** | Inter-Process Communication (Electron) |
| **MCP** | Model Context Protocol |
| **PTY** | Pseudo-Terminal (`node-pty`, F26) |
| **WS** | WebSocket |
| **STT** | Speech-to-Text (F27) |

---

## Conceitos do Produto

**Acesso Supervisionado vs Full-access**  
`supervised` = user aprova cada tool (exceto as internas). `full-access` = tudo automático. `auto-accept-edits` = meio termo: ver a entrada **Auto-accept-edits** acima (F31 inclui shell de arquivo/leitura na lista fechada).

**Ondas de Entrega**  
Features são parallelizáveis por onda. Onda N depende de (Onda N-1). Ex.: F03 Workspace (onda 3) depende de F01 Vault (onda 1).

**Catálogo Seed**  
Catálogo pré-carregado no primeiro unlock: 12 skills + 8 subagents (`kind` default `dev`). Aplicado via `apply-catalog.ts` (F17).

**Modo de Chat**  
Configuração de chat: prompt salvo + modo de chat (colaborativo, explorador, arquiteto, etc.). Pode filtrar skills e rules visíveis. F28.

**Monorepo**  
Estrutura: `apps/engrena-code`, `apps/engrena-plan`, `packages/ui` · `packages/vault` · `packages/http-core` · `packages/db-core` (nomes npm `@engrena/*`). Gerenciado por `pnpm` e `pnpm-workspace.yaml`.

---

## Leia também

- [`PRD.md`](./PRD.md) §3–§5 para personas e objetivos
- [`PROGRESS.md`](./PROGRESS.md) para mapear feature → onda
- [`workspace-glossary.png`](./workspace-glossary.png) para o contrato visual de permissão
- `docs/F*-*/ui.md` para anatomia de UI (quando a feature tem superfície)

# Glossário — EngrenaCode

Termos técnicos e de produto usados na documentação, código e discussões.

**Atualizado:** 2026-08-19

---

## A–C

**Auto-accept-edits**  
Nível de acesso (permission mode) que aprova automaticamente sem card de permissão certos comandos de edição de arquivo (Read, Write, Edit) — mas nega Bash/MCP/WebFetch e pede confirmação em UI. Diferente de `acceptEdits` do Claude Code, que também auto-aprova alguns comandos shell. Ver [`CLAUDE.md`](../../../CLAUDE.md) Regras Aprendidas.

**Broker (permission)**  
Processo/hook que intercepta tool calls do CLI no turno e pede autorização ao usuário via card inline (`PermissionPrompt`) se o nível de acesso exigir. Implementado em `permission-hook.cmd` (Windows) ou `permission-hook.sh` (POSIX).

**CLI, Claude CLI**  
Binário `claude` — CLI oficial de Claude da Anthropic. EngrenaCode roda turnos via `claude` com `--stream json`, não via SDK/API HTTP.

**CodeGraph**  
Índice local do repositório (F19): parser de símbolos, grafo de dependências, ferramentas `repo_graph_*` no MCP interno. Habilita navegação estrutural e autocomplete de código.

---

## D–F

**Delegate / Delegation**  
Ato de spawnar um subagent (filho) a partir de um turno (pai). O pai envia `call_subagent` e aguarda o resultado via WS. Ver F07, F15.

**Diff (pendente, aceito, rejeitado, conflito)**  
Mudança de arquivo detectada após um turno. Estados: `pending` (aguardando decisão do usuário), `accepted` (user concordou), `rejected` (user recusou), `conflict` (dois ou mais filhos em paralelo alteraram o mesmo arquivo — requer manual de qual ganhar). Ver F03, F18.

**Dispatch**  
Ato de criar um turno: coletar o contexto (regras, memória, catálogo), chamar o CLI com `--resume`, puxar resultado, persistir em DB, emitir WS events. Função principal em `dispatch.ts`.

**Feature / Onda / Versão**

- **Feature:** Um produto entregável nomeado `Fxx`, ex. F03 Workspace. Tem spec, plan, ui.md, copy.md, implementação, testes, smoke.
- **Onda (Sprint):** Conjunto de features parallelizáveis. Ex.: Onda 3 = F03, F10, F17 (sem dependência 1:1).
- **Versão:** Release numerada. Ex.: v1.2 (F12–F17), v1.3 (F18–F27), v1.4 (F28–F31).

**Full-access**  
Nível de acesso (permission mode) que aprova todas as tools sem confirmação interativa. Oposto de `supervised`.

---

## G–L

**Gate / Gating**

- **Permission gate (F03):** Decisão em tempo de turno se a tool pode rodar (via broker).
- **Git gate (F03):** Bloqueio de turno se repo não tem HEAD (ex.: repo novo, sem commits).
- **Vault gate:** Bloqueio 423 `vault_locked` se usuário não destravar o cofre.
- **Usage limit gate (F25):** Bloqueio se consumo de mês já passou o limite configurado.

**HTTP loopback**  
Servidor HTTP/WS em `127.0.0.1:5174` que o Electron sobe para o backend do app (vault, threads, diffs, git, MCPs). O Vite dev server (5173) se conecta aqui; o CLI do turno também.

**IPC (Inter-Process Communication)**  
Passagem de mensagens entre main process e renderer (Electron window). Canais: `engrenacode` (genérico), `engrenacode:shell:open-external`, `engrenacode:terminal:*`, etc.

**Lease**  
Lock/token que garante que um projeto tem no máximo um turno ativo por vez (evita race condition). Adquirido em `dispatchNewThread`, liberado quando thread assenta. Ver `thread.state`.

---

## M–P

**MCP (Model Context Protocol)**  
Protocolo de ferramentas que o modelo pode chamar durante um turno. EngrenaCode tem MCP interno (`engrenacode` — skills, memória, codegraph, perguntas) e MCPs externos (integração com Linear, Slack, etc.).

**Permissão (permission mode, access level)**  
Controle de quais tools rodam sem confirmação: `full-access`, `auto-accept-edits`, `supervised`. Configurado por thread e aplicado pelo broker.

**PROGRESS.md**  
Fonte de verdade operacional. Tabela de todas F01–F31 com status (Feito/Pendente), evidência (path a spec/smoke), próximos passos. Atualizada a cada merge de feature. Não confundir com PRD.md (design/requisitos).

**PRD.md**  
Documento de Requisitos de Produto. Visão, personas, objetivos, roadmap, critérios de aceitação (§9). Congelado em 2026-08-08 (v1.3 completa). Mudanças futuras via `/prd-writer` em modo extensão.

---

## R–S

**Reasoning Level**  
Profundidade de raciocínio do modelo de IA antes da resposta: `standard`, `deep`, `extra-high`, `xhigh` (Claude). Configurável por turno via composer.

**Rule / Regras**  
Instruções persistentes do usuário que aplicam a todo turno (sistema prompt). Criadas em `#rules`, persistidas no vault, aplicadas via `RuleRegistry` ao chamar `buildSystemPrompt`. Ver F06.

**Skill (MCP skill, load_skill)**  
Procedimento reutilizável (arquivo `.md` com frontmatter YAML + conteúdo). Carregado sob demanda via tool `load_skill` durante um turno (não como sistema prompt). Catálogo em `#skills`. Ver F05, F12.

**Smoke / Smoke test**  
Validação manual ou E2E de uma feature no app empacotado (não testes unitários). Descrita em `docs/F*-*/smoke-results.md` com print, passos, resultado. Prova que funciona na máquina real do usuário.

**Subagent / SubAgents**  
Agente IA delegado a partir de um turno (pai). Pode rodar sozinho ou em paralelo com irmãos. Outputs (diffs, logs) agregados na timeline do pai. Ver F07, F15, F18.

**Supervised**  
Nível de acesso que pede confirmação (card inline) para TODA tool chamada. Oposto de `full-access`.

---

## T–W

**Thread**  
Conversação IA + histórico + estado (running, idle, waiting_permission, waiting_user, error, cancelled, committed). Criada em projeto, persiste em DB (threads + messages + tool_calls + diffs). Pode ser `--resume`d.

**Thread state**  
Estado de execução: `idle` (pronto para turno novo), `running` (agente trabalhando), `waiting_permission` (card de permissão aberto), `waiting_user` (AskUserQuestion em espera), `error` (falhou), `cancelled` (usuário parou), `committed` (terminado, aguardando decisão do usuário sobre diffs).

**Turn / Turno**  
Uma execução do agente (Claude CLI). Input: thread, prompt, contexto (rules, memória, catálogo). Output: texto, tool calls, diffs. Persistido em DB sob a thread.

**Vault**  
Cofre criptografado local (AES-GCM + scrypt) que armazena: sesionToken (acesso HTTP), keys (Claude/Codex/MCP/GitHub), rules e memória. Arquivo: `userData/vault.enc`. Requer senha na primeira use (unlock).

**Worktree (git worktree)**  
Cópia isolada do repositório criada para cada turno (ou batch de turnos) para evitar colisão de edições. Criada em `userData/worktrees/<projectId>/<threadId>`, cleanup após turno (retém direto se conflito). Ver F13, F18.

---

## Siglas

| Sigla | Significado |
|-------|-----------|
| **E2E** | End-to-End (teste com o app empacotado) |
| **HMR** | Hot Module Reload (Vite recarrega módulo ao salvar) |
| **IPC** | Inter-Process Communication (Electron) |
| **MCP** | Model Context Protocol |
| **PTY** | Pseudo-Terminal (`node-pty`, F26) |
| **WS** | WebSocket |
| **STT** | Speech-to-Text (F27) |

---

## Conceitos do Produto

**Acesso Supervisionado vs Full-access**  
`supervised` = user aprova cada tool. `full-access` = tudo automático (risco maior, velocidade maior). `auto-accept-edits` = meio termo (aprova edição de arquivo, nega shell).

**Ondas de Entrega**  
Features são parallelizáveis por onda. Onda N depende de (Onda N-1). Ex.: F03 Workspace (onda 3) depende de F01 Vault (onda 1).

**Catálogo Seed**  
Catálogo pré-carregado na primeira use: 12 skills + 8 subagents `kind=dev`. Aplicado em unlock via `apply-catalog.ts` (F17).

**Modo de Chat**  
Configuração de chat: prompt salvo + modo de chat (colaborativo, explorador, arquiteto, etc.). Pode filtrar skills e rules visíveis. F28.

**Monorepo**  
Estrutura: `apps/engrena-code`, `apps/engrena-plan`, `packages/@engrena/*`. Gerenciado por `pnpm` e `pnpm-workspace.yaml`. Cada app tem suas dependências, testes, build.

---

## Leia também

- [`PRD.md`](./PRD.md) §3–§5 para personas e objetivos
- [`PROGRESS.md`](./PROGRESS.md) para mapear feature → onda
- `docs/F*-*/ui.md` para anatomia de UI

# Domínio — sistema legado

> Gerado pelo Detective (Reversa) em 2026-07-28  
> Nível: **essencial** · Confiança dominante: 🟡 INFERIDO (negócio) / 🟢 CONFIRMADO (contratos em `shared/`)

---

## Arqueologia Git (resumo)

O repositório público tem histórico **muito raso** (3 commits na linha principal):

| Commit | Mensagem | Leitura |
|--------|----------|---------|
| `cc6c267` | sistema legado v1.0 — primeiro release público | Corte inicial público |
| `1948e09` | sistema legado v1.2 Unstable | Evolução de feature (pipeline/build) |
| `f85757a` | sistema legado v1.2 fix Pipeline | Correção pós-v1.2 no pipeline |

ADRs retroativos via Git **não são viáveis** neste nível com tão pouca história. Decisões de domínio estão documentadas em comentários/tipos de `shared/` e em ADRs citados no código (ex.: ADR-13/15/17/19 no Feature Build) — 🟡 esses ADRs numerados existem como *referência no código*, não como arquivos em `_reversa_sdd/adrs/` (nível essencial omite a pasta `adrs/`).

---

## Glossário

| Termo | Definição | Confiança |
|-------|-----------|-----------|
| **Project** | Diretório/repositório local registrado no sistema legado (`projects.path` UNIQUE). Âncora de cwd, vault secrets, MCP, memory e codegraph. | 🟢 |
| **Thread** | Unidade de execução conversacional ligada a um projeto: provider, modelo, lifecycle (`ThreadState`), access level e modo de execução. | 🟢 |
| **Vault** | Cofre cifrado local de chaves/tokens. Unlock libera a sessão; não é autenticação remota multi-usuário. | 🟢 |
| **Session** | Token efêmero pós-unlock (`X-Sistema-Legado-Session`) para HTTP/WS no loopback. | 🟢 |
| **Dispatch** | Orquestração ponta a ponta de um turno (driver → persistência → WS). | 🟢 |
| **Provider** | Runtime de IA: `claude \| codex \| glm \| minimax \| grok \| kimi`. | 🟢 |
| **AccessLevel** | Quanto o *agente* pode fazer sem pedir: `supervised \| auto-accept-edits \| full-access`. | 🟢 |
| **ExecutionMode** | Isolamento: `main` (cwd vivo) ou `worktree` (branch `sistema-legado/<thread>`). Travado após criação. | 🟢 |
| **Subagent** | Definição global invocável; runs filhos são efêmeros (sem row em `threads`). | 🟢 |
| **Skill** | Prompt markdown catalogável; não executa código. | 🟢 |
| **Command** | Template slash com strategy (`prompt \| pipeline \| workflow \| feature-pipeline \| feature-build`). | 🟢 |
| **MCP** | Server de tools (stdio/http/sse), vínculo por projeto; segredos via vault/`secretRef`. | 🟢 |
| **Rule** | Instrução permanente injetada em todo turno. | 🟢 |
| **Memory** | Memória persistente do projeto (`journal.md` / `memory.md`) com tetos e “dreaming”. | 🟢 |
| **CodeGraph** | Graph de símbolos do repo; agente só via tools `repo_graph_*` server-side. | 🟢 |
| **Feature Pipeline** | `/featdevelop`: fases fixas em código; artefatos em `docs/features/<slug>/`. | 🟢 |
| **Feature Build** | `/featbuild`: executa sprints; `build-state.json` com motor como escritor único. | 🟢 |
| **Diff** | Alterações por arquivo propostas pelo agente (`pending \| accepted \| rejected`). | 🟢 |
| **Permission (tool)** | Pedido in-memory de aprovação de tool pelo usuário local (não RBAC). | 🟢 |
| **Runner** | Camada que conecta provider, DB e eventos WS. | 🟡 |

---

## Regras de negócio principais

### Acesso e sessão

| # | Regra | Evidência | Confiança |
|---|-------|-----------|-----------|
| R1 | Cofre travado bloqueia rotas/ações (exceto surface `public`). | `vault-guard` | 🟢 |
| R2 | Após unlock, cliente envia `X-Sistema-Legado-Session` (nunca query string). | session auth + renderer | 🟢 |
| R3 | App é **single-user local**: sem papéis/usuários no DB. “Permission” = aprovação de tools + vault. | ausência de RBAC tables | 🟢 |
| R4 | `AccessLevel` controla autonomia do agente, não papéis humanos. | `shared/src/thread.ts` | 🟢 |

### Thread e execução

| # | Regra | Evidência | Confiança |
|---|-------|-----------|-----------|
| R5 | Fim de turno bem-sucedido/cancelado → `idle`; review de diff **não** bloqueia (há `awaiting-review` legado). | `dispatch.ts` comentários | 🟢 |
| R6 | Lease: uma execução “ocupada” por projeto ⇒ `409 thread_busy`. | build-resume / branch-switch | 🟢 |
| R7 | `executionMode` escolhido antes do 1º envio e **travado**. | `Thread.executionMode` | 🟢 |
| R8 | Resume de sessão do provider só se `sessionCwd` bater com o cwd atual. | `Thread.sessionCwd` | 🟢 |
| R9 | Git branch switch/create/commit bloqueados com thread `running`. | rotas git | 🟢 |
| R10 | Codex anuncia só `full-access`; exige seleção explícita. | `execution-capabilities` | 🟢 |
| R11 | Seq WS = seq persistido (allocate-then-emit). | `dispatch.ts` | 🟢 |

### Pipeline e Build

| # | Regra | Evidência | Confiança |
|---|-------|-----------|-----------|
| R12 | Fases do pipeline são **imutáveis e ordenadas no código** (não no modelo). | `FEATURE_PIPELINE_PHASES` | 🟢 |
| R13 | ≤1 pipeline ativo por thread **e** por projeto (índices parciais). | migration 047 | 🟢 |
| R14 | Artefatos do pipeline ficam no **repo** (`docs/features/<slug>/`), nunca no DB. | `FeaturePipeline` docs | 🟢 |
| R15 | Build na mesma thread exige ausência de pipeline ativo. | `dispatch.ts` | 🟢 |
| R16 | No build, `failed` ≠ `error` (funcional vs operacional). | `feature-build.ts` ADR-19 | 🟢 |
| R17 | Transições de build/sprint são **guardadas** (`canTransitionFeatureBuild` / sprint). | `FEATURE_BUILD_STATUS_TRANSITIONS` | 🟢 |
| R18 | `cancelled` no build é legado read-only; fluxos novos não transitam para ele. | `feature-build.ts` | 🟢 |

### Catálogo, memória, graph, MCP

| # | Regra | Evidência | Confiança |
|---|-------|-----------|-----------|
| R19 | Filho subagent **nunca** tem row em threads/messages/tool_calls. | `subagent.ts` | 🟢 |
| R20 | Memory dreaming: trigger ~80%, hard-reject ~75%, debounce 24h, fail streak 3. | `project-memory` | 🟢 |
| R21 | CodeGraph jamais se remove (`repair` substitui uninit); auto-sync fire-and-forget. | `codegraph.ts` / engine | 🟢 |
| R22 | Segredos MCP resolvidos do vault no spawn; omitidos se ausentes. | `mcp` + secret-wrapper | 🟢 |
| R23 | Mensagens sintéticas pipeline/build usam campo dedicado, não matching de prefixo. | `message.ts` | 🟢 |
| R24 | Auth Claude default `subscription` (key salva não vence sozinha). | `vault.ts` | 🟢 |

---

## Controle de acesso (nota — sem `permissions.md`)

Neste nível **essencial**, RBAC multi-papel **não** é central ao produto. Mecanismos reais:

1. **Vault lock/unlock** — gate global  
2. **Session token** — autenticidade do cliente local  
3. **projectScope** — resolve cwd por `project_id` (isolamento de dados, não ACL de papéis)  
4. **AccessLevel + PermissionBroker** — autonomia do agente e aprovação de tools pelo dono

Se no futuro houver multi-usuário, gerar `permissions.md` em nível completo/detalhado.

---

## Lacunas 🔴

| Lacuna | Por quê |
|--------|---------|
| Transições runtime de `pr-merged` / `pr-closed` | Enum e CHECK SQL existem; uso ativo pouco evidenciado no grep |
| ADRs numerados (13/15/17/19) vs arquivos | Referenciados no código; não há pasta de ADRs no repo analisado |
| Histórico Git raso | Decisões antigas não recuperáveis por `git log` |
| Política exata do PermissionBroker por provider | Depende de AccessLevel + capacidades; matriz fina 🟡 |

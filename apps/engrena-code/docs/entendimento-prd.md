# EngrenaCode — PRD de Entendimento do Chat

> Documento de entendimento (não é o PRD de produto em `apps/engrena-code/docs/PRD.md`).
> Objetivo: validar o modelo mental do chat **como o código o implementa hoje**, antes de um redesign/reescrita.
> Fonte: leitura do código em `apps/engrena-code/` (renderer workspace, HTTP threads, dispatch/runner, broker, WS).
> Data do recorte: 2026-08-12.

---

## 1. Sumário Executivo

O chat do EngrenaCode não é um cliente HTTP simples de LLM. É um **orquestrador de turno de agente CLI** (principalmente Claude Code via `stream-json`) com:

1. UI de workspace (timeline + composer + cards inline de permissão/pergunta)
2. API HTTP loopback (`127.0.0.1:5174`) para criar thread, enviar mensagem, responder permissão/pergunta, cancelar
3. WebSocket por thread para eventos ao vivo (texto, tools, estado, permissão, diff)
4. Persistência SQLite (threads, messages, tool_calls, diffs)
5. Estado efêmero em memória (lease de projeto, fila de permissão do broker, resolvers de AskUserQuestion, allowlist de tools da thread)

O valor prometido ao usuário: pedir trabalho, ver progresso (shimmer/tools/texto), autorizar tools quando necessário, continuar a conversa na mesma thread, revisar diffs. A continuidade da conversa no Claude **não** é “reenviar o histórico SQLite ao modelo”; é `--resume` com `cli_session_id` gravado na thread.

Minha leitura: o desenho é coerente no papel, mas concentra risco demais em um hook gigante (`usePrincipalWorkspace`), em mapas in-memory e em contratos frágeis com o Claude CLI (hooks PreToolUse, permission-mode, resume). Isso explica por que correções pontuais continuam falhando: o bug frequentemente está na **fronteira entre estados** (composer routing × DB state × WS × broker), não no markdown da bolha.

---

## 2. Problema que este documento ataca

Muitas correções foram feitas no chat e ele ainda quebra. Antes de reescrever, precisamos de um contrato explícito do comportamento pretendido pelo código atual.

Este PRD serve para:

- Alinhar “o que o sistema acha que está fazendo”
- Separar **comportamento de produto** de **detalhe de implementação quebradiço**
- Dar base para um chat do zero sem herdar estados mortos, filas duplicadas ou UX contraditória

Não serve para:

- Justificar a implementação atual
- Listar todos os features do produto (F01–F28)
- Propor a arquitetura nova (isso vem depois da validação)

---

## 3. Escopo

### Dentro

- Ciclo de vida de thread e turno
- Composer e roteamento de envio
- Streaming e timeline
- Permissão de tool (PreToolUse / broker)
- AskUserQuestion (`waiting_user`)
- Fila de follow-up enquanto ocupado
- Histórico persistido vs otimista
- Cancelamento
- Contexto anexado, `#codebase`, chat modes (no que afetam o turno)

### Fora (existem no workspace, mas não são o núcleo do chat)

- Diff review / accept / git commit-push-PR (consomem estado da thread, mas não definem o chat)
- Terminal PTY, CodeGraph UI, dashboard
- Catálogo skills/rules/subagents (só o ponto em que viram MCP no turno)
- Billing/consumo

---

## 4. Atores e responsabilidades

| Ator | Responsabilidade | Onde mora hoje |
|------|------------------|----------------|
| Renderer (Workspace) | Selecionar projeto/thread, draft do composer, bolhas otimistas, fila local, cards, scroll, abrir WS | `usePrincipalWorkspace` + `ChatHistory` + `TaskComposer` + `PermissionPrompt` |
| HTTP threads API | CRUD thread, dispatch, answer, permission, cancel, history, followups | `threads-handler` / `threads-service` |
| Dispatch / `runTurn` | Lease, persistir user msg, montar prompt, spawn CLI, mapear eventos → SQLite + WS, fechar turno | `services/runner/dispatch.ts` |
| CLI driver | Spawn provider, `stream-json`, `--resume`, settings/hooks | `cli-driver.ts` |
| Permission broker | Servidor efêmero `/permission`; decide allow imediato ou espera UI; allowlist | `permission-broker.ts` + `permission-policy.ts` + `permission-hook.ts` |
| AskUserQuestion bridge | MCP efêmero `POST /ask` ↔ UI `POST /answer` | `ask-user-question.ts` |
| WS hub | Fanout por `threadId` | `ws-hub` / `ws-upgrade` / `ws-client` |
| SQLite | Fonte durável de thread/messages/tool_calls/diffs | repositórios sob `db/` |
| Project lease | No máximo uma operação longa por projeto | `project-execution.ts` |

Não há store global tipo Redux. Quase todo estado de UI do chat vive no hook do workspace.

---

## 5. Modelo de dados (o que é “verdade”)

### Thread (persistida)

Campos que importam para o chat:

- `state`: `running | idle | committed | error | stopping | waiting_user | waiting_permission | cancelled`
- `accessLevel`: `supervised | auto-accept-edits | full-access`
- `cliSessionId`: id da sessão Claude para `--resume`
- `chatMode`, `executionMode` (`main` | `worktree`), provider/model/reasoning

### Mensagens (persistidas)

- User: texto digitado (+ blocks de chips/anexos como metadado de UI). **Corpo dos anexos não fica no banco**; é relido do disco no dispatch.
- Assistant: gravada no **fim** do turno (texto completo + éventuais `blocks` de decision chips).
- Tool calls: linhas em `tool_calls`, intercaláveis na timeline.

### Otimista / efêmero (não é verdade durável)

| Dado | Onde |
|------|------|
| Texto streaming | memória renderer + WS `message.delta` |
| Pending messages (`sending/sent/queued/permission`) | renderer; reconciliadas por conteúdo com history |
| Fila de follow-up | `localStorage` `engrenacode.message-queue.v1.*` |
| Fila de permissão na UI | renderer (`permissionQueue`) |
| Pending do broker / ask resolvers | memória do processo main |
| Allowlist de tools da thread | memória do processo (project allowlist pode persistir) |
| Lease do projeto | memória do processo |

**Invariante de boot:** `recoverRunningThreads` cobre exatamente três estados (`running`, `waiting_user` e `waiting_permission`) e os vira `error` na subida, porque os resolvers in-memory morreram com o processo. **`stopping` não é reconciliado no boot.** Uma thread que o processo deixou em `stopping` reabre nesse estado, sem processo por trás e sem ninguém para concluir o cancelamento.

---

## 6. Ciclo de vida do turno

### 6.1 Envio pelo composer (prioridade)

Função pura `routeComposerSend`:

1. Texto vazio → noop
2. Gate de permissão (`waiting_permission` **ou** fila local de permissão) → interpreta allow/deny/allow-all **ou** bloqueia (nunca enqueue)
3. `waiting_user` + pergunta pendente → `POST /answer`
4. `running | waiting_user` (sem gate resolvível) → enqueue local
5. Sem thread → `POST` cria thread + primeiro turno
6. Com thread “livre” → `POST …/messages` (follow-up)

`waiting_permission` **não** cai no passo 4. Com `threadState === 'waiting_permission'` o gate do passo 2 sempre dispara primeiro; se a fila local de permissão estiver vazia, o resultado é `permission_blocked` (mais refetch do snapshot via `GET …/permissions`), nunca `enqueue`. Escrever isso como “enqueue quando ocupado” é o tipo de simplificação que faz a UI parecer que engoliu a mensagem.

Contrato de UX crítico (`F03-workspace/spec.md` §3.5): o card de **permissão** tem dois gatilhos — o chip concede/nega no clique, sem tocar no composer, e `sim`/`não`/`permitir todos` digitado + **Enviar** faz o mesmo; os dois convergem em `PermissionDecisionKind` e daí há uma rota só até o POST. O card de **pergunta** continua opção → composer → Enviar. Texto livre com card de permissão aberto vai para a fila.

### 6.2 Dispatch

```
HTTP create/messages
  → acquireLease(project)   // 409 thread_busy se ocupado
  → runTurn:
       appendMessage(user)
       compose prompt (anexos + modo em resume)
       sobe MCPs internos (ask / delegate / memory / skills) se provider suporta
       sobe permission broker se provider === 'claude' && permissionBrokerApplies(accessLevel)
       runCliTurn(stream-json):
         text-delta     → WS message.delta
         tool-start     → SQLite + WS; ask_user_question → state waiting_user
         tool-result    → update + WS; se era ask → volta running
         PreToolUse     → broker → waiting_permission + permission.request
       persiste assistant (+ decision blocks se houver)
       primeFollowups (se há subscribers WS)
       diffWorkingTree → diff.ready
       state → idle
  → finally: reject ask pendente, deny permissions, fecha servers, releaseLease
```

### 6.3 Transporte ao vivo

- **Não é SSE.** Dispatch devolve `{ stream: { ws: '/?threadId=…' } }`.
- Cliente abre `ws://127.0.0.1:5174/?threadId=…` com subprotocolo de sessão.
- No connect, o server pode reenviar permissões pendentes (replay).

Eventos WS relevantes: `message.delta`, `tool_call.start|result`, `state.change`, `permission.request|resolved|native_denial`, `diff.ready`, `error`, mais satélites (`subagent.*`, `pipeline.*`, `mcp.notice`, `memory.entry`).

### 6.4 Continuação Claude

- Após turno com `session_id` no stream → grava `cli_session_id`.
- Próximo turno: `--resume <cli_session_id>`.
- Mudança de chat mode no meio da thread: não basta `--append-system-prompt` (resume ignora). O bloco do modo vai no **prompt do turno**.

### 6.5 Cancel

- `POST …/cancel` nos estados canceláveis: `running | stopping | waiting_user | waiting_permission`.
- Ordem importante no código: negar permissões / rejeitar ask / fechar servers **antes** do abort, senão hook fica pendurado.
- UI limpa streaming + pendings e refetch history em background.

---

## 7. Máquina de estados da thread

```
create → running
  ├─ ask_user_question tool     → waiting_user → (POST /answer) → running
  ├─ PreToolUse precisa UI      → waiting_permission → (POST /permission | timeout) → running
  ├─ sucesso                    → idle → (fluxo git/accept) → committed
  ├─ cancel                     → stopping → cancelled
  └─ falha / recover de boot    → error
```

Estados “ocupados” para o composer: `running`, `waiting_user`, `waiting_permission` (e o gate de permissão ainda trava enqueue quando o DB diz waiting e a fila local está vazia: `permission_blocked` + refetch snapshot).

---

## 8. Permissões (produto vs CLI)

### Política Engrena (`permission-policy`)

| accessLevel | Comportamento |
|-------------|----------------|
| `supervised` | Tudo que passa no broker pergunta (ask) |
| `auto-accept-edits` | Auto-allow leitura/edição (Read/Glob/Grep/LS/Write/Edit/…); Bash/WebFetch/MCP pedem UI |
| `full-access` | Sem broker; CLI em bypass |

O broker **não** sobe em “qualquer nível exceto full-access”. A condição real no dispatch é `provider === 'claude' && permissionBrokerApplies(accessLevel)`: o nível de acesso é só metade do teste, o provider é a outra. Fora do Claude não há broker montado, e é por isso que a paridade de permissão entre providers é hoje uma promessa, não um fato. Motivo documentado no código para não delegar ao CLI: usar `--permission-mode acceptEdits` no Claude sem hook nega Bash/MCP **sem** abrir UI; o usuário “aprova” em prosa e vira follow-up órfão.

### Wiring Claude (contratos quebradiços, mas atuais)

- Com hook: `--permission-mode auto` (não manual/dontAsk/default/acceptEdits como autoridade)
- O `--settings` exige **dois** grupos de hook, não um: `{"hooks":{"PreToolUse":[…],"PermissionRequest":[…]}}`, ambos apontando para o **mesmo command**. `PreToolUse` sozinho não basta em headless: o CLI nega a escrita com “haven't granted it yet” mesmo depois do broker liberar
- O hook **espelha** o `hookEventName` do evento que recebeu (`PreToolUse` ou `PermissionRequest`) e usa formatos de decisão diferentes conforme o grupo: `permissionDecision` num, `decision.behavior` no outro. Responder com o formato do grupo errado faz o CLI ignorar a decisão em silêncio
- Comando do hook embute `ELECTRON_RUN_AS_NODE=1`
- Tools internas (ask_user_question / load_skill / call_subagent) em `--allowedTools`
- “Permitir todos” tem **dois escopos distintos**, não um: `allow_always` grava o `toolName` na allowlist da **thread** (memória do processo, morre no restart e limpa no DELETE da thread) e `allow_project` persiste em **SQLite**, na tabela `tool_allowlist`, sobrevivendo a reinício. Os dois resultam em auto-allow no broker sem UI; só o alcance muda
- Timeout do broker: fail-closed (~2 min)

### UI

- Card **inline** no fim da timeline (não modal overlay)
- Clique → preenche composer; Enviar → `POST /permission`
- Não remover item da `permissionQueue` antes do POST suceder
- Se DB = `waiting_permission` e fila local vazia → buscar `GET …/permissions` antes de decidir

---

## 9. AskUserQuestion vs follow-up vs permissão

| | Permissão tool | AskUserQuestion | Follow-up normal |
|--|----------------|-----------------|------------------|
| Estado | `waiting_permission` | `waiting_user` | tipicamente `idle` (ou enqueue se busy) |
| Origem | PreToolUse hook | MCP `ask_user_question` | usuário |
| Resolve | `POST /permission` | `POST /answer` | `POST /messages` (ou create) |
| Persiste texto do usuário no DB? | Não (bolha otimista `permission`) | Não (mesmo padrão de resposta de gate) | Sim, no início do `runTurn` |
| Se errar o roteamento | Enfileira ou abre turno novo; agente repete pedido em prosa | Pergunta MCP fica presa; texto vira turno órfão | — |

Há ainda “decision chips” de prosa (pergunta detectada no texto do assistant, sem tool): viram `blocks` na mensagem; clique preenche composer e o envio é follow-up normal.

---

## 10. Fila, lease e busy

- Enquanto ocupado sem gate resolvível: mensagem vai para fila em `localStorage`.
- Drain esperado em `state.change` ∈ `{idle, committed, error}` via `processQueueIfIdle`.
- Lease: uma execução longa por projeto; concorrência → `409 thread_busy`; cabeça da fila pode ser re-enfileirada.
- Followups (chips de sugestão pós-turno) ≠ fila de mensagens; vêm de `GET …/followups` e esvaziam em estados busy.

Ponto frágil observado no código: caminho `cancelled` limpa coisas na UI mas **não** necessariamente drena a fila da mesma forma que `idle/error`.

---

## 11. Timeline e UX de progresso

- Timeline = messages + grupos de Work log (tools) + blocos de subagent.
- Streaming assistant = `streamingText` (some quando history refetch traz a mensagem final).
- Shimmer/atividade: visível enquanto `state === running` e não há card de permissão/pergunta pendente; rótulo da tool running mais recente (fallback “Trabalhando” / “Pensando”), nunca nome cru da tool como copy principal.
- Cronômetro de “Pensando” deve ancorar na bolha otimista do envio atual (senão follow-up herda tempo do turno anterior).
- Refetch de history disparado pelo stream deve ser **background** (não ligar `historyLoading` que troca a árvore por “Carregando…” e joga scroll/worklog).
- Scroll: stick-to-bottom só se perto do fim; CTA “Ver mensagem” se a resposta chega fora de vista.
- Estado aberto do Work log é estado React, não depender só de `<details>` no DOM.

---

## 12. Histórias de usuário (comportamento que o chat precisa acertar)

Estas são as histórias mínimas que qualquer reescrita precisa preservar ou deliberadamente redesenhar. Não são “nice to have”.

### H1. Primeiro turno
Como usuário com projeto selecionado, quero enviar um prompt e ver uma thread nascer com streaming, tools e resposta persistida.

### H2. Follow-up com contexto
Como usuário, quero responder na mesma thread e o agente lembrar o que foi dito (via resume de sessão CLI, não só via UI history).

### H3. Enviar enquanto trabalha
Como usuário, quero digitar follow-up durante `running` e ter a mensagem enfileirada, não perdida nem virando turno concorrente no mesmo projeto.

### H4. Autorizar tool
Como usuário em supervised (ou tool fora do auto-accept), quero ver o pedido na timeline, escolher permitir/negar/permitir sempre, enviar, e ver a tool continuar ou parar, sem o agente inventar que eu já cliquei.

### H5. Responder pergunta estruturada
Como usuário em `waiting_user`, quero escolher opção ou texto livre e ter isso consumido como resposta da tool, não como mensagem nova órfã.

### H6. Parar
Como usuário, quero cancelar um turno em andamento (incluindo gates) e voltar a um estado em que posso falar de novo.

### H7. Trocar nível de acesso
Como usuário, quero mudar a pill de access mid-thread com persistência (`PATCH`) e efeito real na política do broker (upgrade libera o que a política auto-aprova).

### H8. Reabrir app
Como usuário, quero reabrir o app e ver histórico persistido; não quero threads eternamente “running” sem processo por trás (viram erro recuperável).

---

## 13. Requisitos funcionais (contrato atual)

RF01. Todo envio passa por um roteador único com a prioridade da §6.1.  
RF02. Live updates usam WebSocket autenticado por thread; history HTTP é a reconciliação durável.  
RF03. User message persistida no início do turno; assistant no fim; streaming não é fonte de verdade.  
RF04. Anexos de contexto são resolvidos no dispatch a partir do disco; o histórico mostra o que o usuário digitou/chips.  
RF05. Claude follow-up usa `--resume` com `cli_session_id`.  
RF06. Permissão de tool passa pelo broker Engrena com política por `accessLevel` quando `provider === 'claude' && permissionBrokerApplies(accessLevel)`: provider e nível, não só o nível. O wiring do broker no CLI exige os **dois** grupos de hook (`PreToolUse` **e** `PermissionRequest`) no mesmo `--settings`.  
RF07. Clique em card ≠ concessão; Enviar concede/responde.  
RF08. `POST /permission` só remove o pedido da UI após sucesso.  
RF09. `waiting_user` resolve via `/answer`; não via `/messages`.  
RF10. Um lease por projeto; busy → erro explícito ou re-fila no cliente.  
RF11. Cancel limpa gates in-memory antes de matar o processo do turno.  
RF12. Boot recupera `running | waiting_user | waiting_permission` órfãos para `error`. `stopping` fica de fora do recover; é lacuna conhecida, não contrato.  
RF13. Activity indicator permanece em `running` mesmo com texto já streaming.  
RF14. History refetch de stream não pode destruir scroll/worklog com loading foreground.

---

## 14. Fora de escopo deste entendimento / ambiguidades honestas

Assunções que **não** estão claras só pelo código, ou que misturam produto e remendo:

1. **O que é “chat quebrado” para o usuário final** (permissão? scroll? fila? resume? shimmer?) não está neste documento; precisa ser validado por você.
2. Providers não-Claude: o mesmo esqueleto existe, mas vários contratos (hook, resume, MCP ask) são Claude-cêntricos. Paridade real entre providers é duvidosa.
3. Decision chips de prosa vs AskUserQuestion tool: dois caminhos de “pergunta” com persistência diferente; fácil a UI parecer a mesma e o backend não.
4. Fila após `cancelled`: comportamento efetivo parece incompleto frente a `idle/error`.
5. “Permitir todos” (thread vs project): há dois escopos; o mental model do usuário provavelmente é um só.
6. Worktree/executionMode afetam cwd do turno e diffs; o chat assume isso, mas a UX de “onde o agente escreveu” pode estar opaca.
7. Este documento descreve o **sistema atual**. Não afirma que ele é o desenho certo para a reescrita.

---

## 15. Fragilidades estruturais (por que correção local falha)

1. **Um hook é o bus central** (`usePrincipalWorkspace`): routing, WS, queue, history, permission, ask, access, codebase. Qualquer fix toca vários eixos.
2. **Três fontes de “está pedindo permissão?”**: `thread.state`, `permissionQueue` local, pending map do broker. Dessincronia = modal sumido / enqueue errado / POST bloqueado.
3. **Três fontes de “o usuário mandou texto”**: pending otimista, fila localStorage, messages SQLite. Resposta de permissão parece mensagem mas não é.
4. **Contratos Claude CLI opacos**: permission-mode, formato de hooks, `hookEventName`, `ELECTRON_RUN_AS_NODE`, resume vs system prompt. Regressão silenciosa (hook dispara e decisão é ignorada).
5. **Estado de gate só em memória**: restart ou crash no meio de waiting_* deixa UI/DB inconsistentes até o recover bruto para `error`.
6. **Timeline acoplada a refetch**: se loading foreground voltar, scroll e worklog quebram de novo; isso já foi “consertado” e é fácil regredir.
7. **Produto ensina o modelo errado** se card conceder no clique: o agente e o usuário passam a crer em um canal que não existe.

---

## 16. Critérios de aceitação deste entendimento

O entendimento está validado se você concordar ou corrigir os pontos abaixo com sim/não + nota:

1. Chat = orquestração de turno CLI + WS + SQLite, não “chat GPT-like” puro.
2. Continuidade Claude = `--resume` / `cli_session_id`, não replay do history no prompt.
3. Composer tem um roteador com prioridade permissão > ask > enqueue > send.
4. Chip de permissão concede no clique; opção de pergunta só preenche; Enviar resolve gate ou envia turno.
5. Permissão é broker Engrena + policy sob `provider === 'claude' && permissionBrokerApplies(accessLevel)`, com dual-hook `PreToolUse` + `PermissionRequest`, não `--permission-mode acceptEdits` nativo.
6. Resposta de permissão/ask não é mensagem de usuário persistida como follow-up.
7. Streaming é efêmero; history é verdade; refetch de stream é background.
8. Busy = fila local + lease de projeto; não dois `runTurn` no mesmo projeto.
9. Waiting_* depende de memória de processo; boot força `error` em `running | waiting_user | waiting_permission`, e `stopping` fica fora do recover.
10. A reescrita deve preservar H1–H8 ou declarar qual história muda de propósito.

Se algum item estiver errado, este documento deve ser corrigido **antes** de especificar o chat do zero.

---

## 17. Implicações para uma reescrita (só direção, sem desenho)

Sem propor arquitetura nova, o código atual sugere que qualquer chat do zero precisa, no mínimo:

- Uma máquina de estados de thread **explícita** e única fonte para o composer
- Separar “gate aguardando humano” de “mensagem de chat”
- Tratar resume/sessão CLI como parte do contrato de produto, não detalhe do runner
- Isolar o adaptador Claude (hooks/permission-mode) atrás de uma porta testável
- Não voltar a concentrar UI+fila+WS+routing num único hook monólito

Fim do entendimento (autor). Abaixo: revisão independente com contexto limpo contra o código.

---

## 18. Revisão independente (contexto limpo)

> **Status: correções aplicadas ao corpo em 2026-08-13.** Os cinco erros factuais listados abaixo foram corrigidos em §5, §6.1, §6.2, §8, §13 (RF06 e RF12) e §16 (itens 5 e 9). Esta seção **permanece como registro histórico do parecer**: o texto abaixo descreve o corpo **antes** da correção e não deve ser reescrito para bater com ele. As "Omissões materiais" continuam abertas: são material a acrescentar, não erro a corrigir.

> Agente revisor sem o histórico da redação. Verificou claims contra `apps/engrena-code/`. Não editou o corpo §1–§17; esta seção é o parecer.

### Veredito

**Aprovado com ressalvas** como base de reescrita. O modelo mental central está certo: chat = orquestração de turno CLI + HTTP loopback + WS por thread + SQLite, com continuidade Claude via `--resume`/`cli_session_id`, composer com gate antes de enqueue/send, e permissão/ask como canais distintos de follow-up. Não é seguro como único input sem correção: a seção de wiring Claude omite o contrato real `PreToolUse` **+** `PermissionRequest`, generaliza o broker para “qualquer nível ≠ full-access” quando o código só monta broker em Claude, e deixa de fora estados/caminhos que já quebram UX (`stopping`, fila após `cancelled`, slash/pipeline, teto de usage).

### Erros factuais

- **§8 / wiring: settings só com `PreToolUse` e `hookEventName: 'PreToolUse'`** → o CLI exige **dois** grupos no `--settings`: `PreToolUse` e `PermissionRequest` (mesmo command); o hook espelha `hookEventName` do evento (`PreToolUse` **ou** `PermissionRequest`) e formatos de decisão diferentes (`permissionDecision` vs `decision.behavior`). PreToolUse sozinho não basta em headless. → `cli-driver.ts` (`buildPermissionSettingsFile`), `permission-hook.ts`, `permission-contract.ts`.
- **§6.1 passo 4: `waiting_permission` (sem gate resolvível) → enqueue** → com `threadState === 'waiting_permission'` o gate sempre dispara primeiro; fila local vazia vira `permission_blocked`, nunca `enqueue`. → `composerRoute.logic.ts`.
- **RF06 / §8: broker em qualquer nível ≠ full-access** → broker só sobe quando `provider === 'claude' && permissionBrokerApplies(accessLevel)`. → `dispatch.ts`, `permission-policy.ts`.
- **§8 “Permitir todos” como um só escopo** → há `allow_always` (thread, memória) e `allow_project` (SQLite `tool_allowlist`). → `permissionComposer.logic.ts`, `permission-broker.ts`, `PermissionPrompt.tsx`.
- **Boot recover** → `recoverRunningThreads` cobre `running | waiting_user | waiting_permission`; **`stopping` não** é reconciliado no boot. → `threads.ts`, `unlock-handler.ts`.

### Omissões materiais (alta/média)

- Contrato dual PreToolUse + PermissionRequest (alta; reescrita incompleta regressa permissão).
- Broker/resume/MCP ask Claude-cêntricos (alta).
- Estado `stopping` ausente no `routeComposerSend` (alta; pode tentar follow-up durante cancel).
- Caminho slash → `runPipelineCommand` além de `runTurn` (alta).
- Fila após `cancelled` não drena como `idle|committed|error` (média).
- Ask reidrata via `tool_calls` no history; permissão via WS replay / `GET …/permissions` (média).
- Gate `assertUsageLimitNotExceeded` antes do lease (média).
- Lease permanece durante `waiting_*` até o `finally` do `runTurn` (média).
- Imagens no composer/turno pouco cobertas (média).

### Checklist §16 (revisor)

| # | Resultado |
|---|-----------|
| 1 | Correto |
| 2 | Correto (só Claude; não generalizar) |
| 3 | Parcial (`permission_blocked`; `stopping` omitido) |
| 4 | Correto |
| 5 | Parcial (Claude + dual-hook; não multi-provider) |
| 6 | Correto |
| 7 | Correto |
| 8 | Correto no happy path; ressalva `cancelled` |
| 9 | Parcial (`stopping` fora do recover) |
| 10 | Correto como processo; H4/H6 precisam dos fixes |

### Recomendação do revisor (antes de usar como input de redesign)

1. Corrigir §8 / RF06: dual-hook, broker somente Claude, fallback sem hook.
2. Corrigir §6.1: `waiting_permission` sem fila = block + snapshot; documentar `stopping`/`cancelled`.
3. Explicitar `allow_always` vs `allow_project`.
4. Documentar recover de boot real e fila em `cancelled`.
5. Incluir usage gate, slash→pipeline, lease mantido em gates.
6. Separar “contrato a preservar” de “detalhe quebradiço atual”.
7. Só depois disso usar o doc como input de redesign.

---

**Status do artefato:** entendimento redigido + revisão anexada + **erros factuais da §18 aplicados ao corpo §1–§17 em 2026-08-13**.

O que ficou pendente, para não confundir com "corrigido":

- As **omissões materiais** da §18 (contrato dual no detalhe de implementação, slash → `runPipelineCommand`, `stopping` no `routeComposerSend`, fila após `cancelled`, `assertUsageLimitNotExceeded` antes do lease, lease mantido durante `waiting_*`, imagens no composer) **não** foram escritas no corpo. São seções a acrescentar, não frases a corrigir.
- A validação humana do §16 continua pendente. O corpo agora bate com o código lido em 2026-08-12; ele ainda não foi confirmado como o desenho **desejado** para a reescrita.

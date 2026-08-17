# F03 Smoke Results

**Feature:** F03 Workspace
**Data:** 2026-08-05 (~19:05–19:15 BRT)
**Ambiente:** `pnpm dev` (Electron real, `dangerouslyDisableSandbox` — sandbox do host bloqueava GPU/network process do Electron) com `ENGRENACODE_USER_DATA=%TEMP%\engrena-smoke-onda-final` + Playwright em `http://localhost:5173` (mesmo bundle do renderer servido pelo Electron)
**Credenciais smoke:** workspace `~/smoke-onda-final` · password `smoke-onda-final-pass`
**Projeto:** pasta git real fora do repo (`%TEMP%\engrena-smoke-project`, `git init` + commit seed), nunca o próprio `engrena-code`
**Provider:** `claude` (único binário disponível no PATH; `codex`/`kimi` ausentes)

## Pré-requisitos

- [x] `.env.local` com `VITE_DEV_SERVER_URL=http://localhost:5173`; portas 5173/5174 livres antes do boot
- [x] Electron real sobe e responde (5 processos `electron.exe`), unlock loopback `127.0.0.1:5174` up
- [x] Vault isolado desbloqueado via UI (`sessionToken` em localStorage)

## Fluxo real (unlock → pasta → dispatch → diff → git)

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| 1 | Unlock via UI (`LoginScreen`) | `#dashboard` pós-unlock | pass |
| 2 | Cadastrar projeto scratch (API `POST /api/projects`) + abrir `#principal` | projeto listado, branch `main` detectada | pass |
| 3 | Vincular 1 skill/1 rule/1 subagent ao projeto | Repo Harness mostra counts reais | pass — `Rules 1 ativa`, `Skills 1 vinculado`, `SubAgents 1 vinculado` |
| 4 | Criar thread `claude · supervised · main`, enviar prompt real | thread `running`, streaming de tool calls | pass — 1ª tentativa expôs bug de ambiente (ver Notas), não bug do app |
| 5 | Retry com `auto-accept-edits` | `Glob`/`Read`/`Edit` completed; thread `idle` | pass |
| 6 | Aba Diff | `README.md` pendente `+4/-0 CLAUDE` | pass — anatomia bate com `ui/principal-referencia.png` |
| 7 | Aceitar mudanças | diff `aceito`; arquivo real escrito em disco | pass — conferido via `cat README.md` fora do app |
| 8 | Commit local (mensagem preenchida) | git commit real no repo scratch | pass — `git log` mostra `c1f3623 chore: smoke edit via real agent turn` |
| 9 | Light/dark | tokens Design Lock, sem hex solto | pass (screenshots `f03-diff-theme1.png` claro, `f03-dark.png` escuro) |

## Repo Harness (F05–F07 reais no Workspace)

- [x] Skills vinculadas aparecem com count real (1 vinculado)
- [x] Rules vinculadas aparecem com count real (1 ativa)
- [x] SubAgents vinculados aparecem com count real (1 vinculado)
- [x] MCPs vinculados aparecem com count real (0 → 1 após vínculo do Linear em Track D)

## Não coberto nesta rodada

- `call_subagent` real (run efêmero + diffs do filho na revisão do pai): exigiria 3º turno real; fora do escopo autorizado desta sessão (1 turno real combinado com o usuário). PRD §9 "call_subagent cria run efêmero" segue **deferred**.
- Push/PR real para o GitHub: ação visível/difícil de reverter, deixada fora da execução automática por decisão de escopo (ver `docs/PROGRESS.md`); commit local já satisfaz o passo "git" do item original.
- `Worktree` execution mode e access `Full access` não exercitados (apenas `Main`/`Supervised`→`Auto-accept edits` usados).

## Notas

- **Achado real, não bug do app:** a 1ª tentativa de turno errou com "Credit balance is too low" porque o processo `pnpm dev` herdou `ANTHROPIC_API_KEY` do ambiente do shell (não do vault), levando o `claude` CLI filho a autenticar por API key sem saldo em vez de usar a sessão de assinatura já logada no binário. Reiniciar `pnpm dev` sem essa env var resolveu; turnos seguintes usaram a assinatura corretamente (confirmado em `#consumo`: billing `subscription`, `cost_source=sdk`).
- Acesso `Supervised` (`--permission-mode default`) faz o Edit falhar com "Need permission" porque o CLI é spawnado sem TTY interativo para aprovar — nesse fluxo real, `Auto-accept edits` (`--permission-mode acceptEdits`) é o modo correto para deixar o Edit completar e ainda assim revisar o diff antes de tocar o disco definitivamente (o accept em si é uma ação separada, sempre revisável).
- Thread status `committed` é terminologia própria do app (diff aplicado ao disco), não indica git commit — confirmado que o commit git real só acontece ao clicar `Commit` explicitamente no painel Repositório.

## Critérios PRD §9

| Critério | Status |
|----------|--------|
| Usuário cadastra projeto, cria thread com Claude\|Codex\|Kimi, access level e execution mode | **pass** |
| Execution mode trava após o primeiro envio | pass (pills desabilitadas durante `running`) |
| Streaming, tool status e histórico persistem | **pass** (real, não seed) |
| Accept/reject por arquivo; git mutável bloqueado com thread running | **pass** (accept real) |
| Segunda execução no mesmo projeto retorna `thread_busy` | não reexercitado nesta rodada (coberto por unitário pré-existente) |
| Skills, rules e subagents vinculados participam do turno | **pass** — Repo Harness confirma vínculo real consumido pelo turno |

---

# Smoke: Supervised end-to-end (2026-08-10)

**Contexto:** turno Supervised nao criava arquivo nenhum — o agente respondia em prosa ("Preciso permissao pra criar arquivos. Confirma?") e encerrava o turno; responder "Sim" abria um turno novo sem contexto ("Qual tarefa?").

**Metodo:** `pnpm dev` (Electron real) + `playwright-cli` em `http://localhost:5173`; `ENGRENACODE_USER_DATA` isolado em `%TEMP%\engrenacode_claude_todolist_smoke`; vault/userData reais do usuario intocados; `ANTHROPIC_API_KEY` unset (assinatura). Projeto fixture `TodolistV1` em `C:\Users\Me\Code\EngrenaCode\TodolistV1`, provider Claude, modelo `claude-haiku-4-5`, access `Supervised`, execution `Main`.

## Causa raiz (confirmada por experimento isolado contra o binario `claude`)

O hook `PreToolUse` emitia `hookSpecificOutput` **sem** `hookEventName`. O CLI dispara o hook (comprovado: log do hook recebeu `tool_name: Write`), mas **ignora a decisao em silencio** sem esse campo e cai no default headless, que nega escrita: `permission_denials: [Write]` + "Claude requested permissions to write to X, but you haven't granted it yet". Com `hookEventName: 'PreToolUse'` no mesmo output, `allow` cria o arquivo e `deny` bloqueia com a razao chegando limpa ao modelo (ambos por stdout + exit 0).

## Confirmado ao vivo

1. **Gate de git**: pasta sem repo → banner "Inicialize o Git"; clique em `Inicializar Git` cria repo + `chore: initial commit (EngrenaCode)`.
2. **Modal de permissao real**: primeira tool (`Bash`) abre `Permitir a ferramenta Bash?` com parametros; `Permitir` libera o turno.
3. **Antes da correcao**: turno terminava com pedido de confirmacao em prosa; `Sim` no chat gerava tool `Write` negada ("but you haven't granted it yet"), zero arquivos no disco.
4. **`--resume`**: apos o fix de sessao, o follow-up "Sim, pode criar os arquivos." manteve o contexto (o agente foi direto ao `Write` do `package.json`), em vez do antigo "Qual tarefa?".
5. **Depois da correcao do hook**: thread nova com o mesmo prompt criou `package.json` e `server.js` reais no disco; aba `Diff 2`; resposta final "Pronto. Projeto setup completo...". `server.js` com Express, array em memoria e as 4 rotas REST pedidas.

## Nao exercitado

- `Negar` no modal durante o fluxo do app (deny validado no experimento isolado + unitario `permission-hook.test.ts`).
- Worktree, Auto-accept edits e Full access nesta rodada.

---

# Smoke: latência da mensagem do usuário no chat (2026-08-11)

**Contexto:** responder no chat (ex.: "Sim, pode prosseguir") não mostrava a mensagem na conversa por ~1 min — tempo suficiente para o usuário responder duas vezes por engano. Causa: o renderer só pintava mensagem de usuário quando o próximo `GET /history` chegava (disparado por `tool_call.start` / `state.change`); com o agente pensando 52 s, a mensagem ficava invisível esse tempo todo.

**Método:** `pnpm dev` (Electron real, `dangerouslyDisableSandbox`) + `playwright-cli` em `http://localhost:5173`; `ENGRENACODE_USER_DATA` isolado em `%TEMP%\engrenacode_claude_todolist_gapfix`; `ANTHROPIC_API_KEY` unset (assinatura); vault/userData reais do usuário intocados. Projeto `TodolistV1` em `C:\Users\Me\Code\EngrenaCode\TodolistV1`, provider Claude, modelo `claude-haiku-4-5`, prompt real da todolist (Express + Scalar, memória, 4 rotas REST).

## Medido ao vivo (clique → bolha na conversa)

| # | Caminho | Esperado | Resultado |
|---|---------|----------|-----------|
| 1 | Primeiro envio (cria thread) | bolha imediata + rótulo de estado | **pass — 91 ms**, rótulo `Executando…` |
| 2 | Resposta ao PermissionPrompt pelo chat | bolha imediata de eco | **pass — 22 ms**, rótulo `Resposta enviada ao pedido de permissão` |
| 3 | Envio com agente trabalhando | bolha imediata em estado de fila | **pass — 33 ms**, rótulo `Na fila — aguarde o turno atual terminar` |
| 4 | Reconciliação com o histórico | bolha otimista some quando a persistida chega (sem duplicar) | pass — bolha real às 04:33 + `Pensando… 14s` |
| 5 | Drenagem da fila no fim do turno | follow-up despacha sozinho | pass — mensagem enfileirada virou turno real ao thread sair de `running` |
| 6 | Frase afirmativa natural no modal | "Sim, pode prosseguir" resolve o allow | **pass** — antes caía no aviso "Há uma permissão pendente…" |

## Turno real (efeito colateral do cenário)

- `Write package.json` e `Write index.js` aprovados pelo modal; `npm install` real; API respondeu em `http://localhost:3000/todos` com as 4 rotas + `/docs` (Scalar).

## Achados não corrigidos nesta rodada

- **Aba Diff com 2334 arquivos** após `npm install` no projeto sem `.gitignore`: o coletor de diff varre `node_modules` inteiro no fim do turno. É o que faz o turno demorar minutos para assentar (e alimentava o gap percebido). Correção fica fora deste diff.
- **Turno preso em `running`** quando o CLI filho é morto com pedido de permissão pendente: o `PermissionBroker` não tem timeout, então a thread só assentou (para `error`) bem depois.
- Follow-up enfileirado que falha no POST (ex.: lease do projeto tomada por outra thread) agora volta para a frente da fila — antes sumia sem rodar. Verificado por código/tsc, não reexercitado ao vivo.

---

# Smoke: navegar na conversa durante o turno (2026-08-11)

**Contexto:** com o agente trabalhando, cada `tool_call`/`state.change` refazia `GET /history` e o renderer trocava a árvore do chat por "Carregando histórico…". Resultado: scroll voltava ao topo e todo `<details>` de Work log fechava no meio da análise. Comportamento alvo: o do sistema legado (`LionCodeLabs`, `useStickToBottom` + container com `[overflow-anchor:none]`), sem refresh visível.

**Método:** `pnpm dev` (Electron real) + `playwright-cli` em `http://localhost:5173`; `ENGRENACODE_USER_DATA` isolado em `%TEMP%\engrenacode_chatscroll_smoke`; `ANTHROPIC_API_KEY` unset. Projeto `TodolistV1`, Claude `claude-haiku-4-5`, access `Full access`. Medições no container real do chat (`div[class*="overflow-anchor"]`) e no `<details>` cujo summary contém "Work log".

## Medido ao vivo

| # | Cenário | Esperado | Resultado |
|---|---------|----------|-----------|
| 1 | Work log aberto + usuário no topo, turno rodando com 3 refetches de histórico | continua aberto | **pass** — `worklogCollapsedDuranteTurno: false` |
| 2 | Mesma condição | scroll não é jogado para o topo nem arrastado ao fim | **pass** — `scrollTop` fixo em 0 durante todo o turno |
| 3 | Resposta do agente com usuário longe do fim | CTA "Ver mensagem" acima do composer, à direita | **pass** — apareceu em 14 s |
| 4 | Clique no CTA | leva à última resposta | **pass** — `scrollTop` 0 → 550 (= máximo) |
| 5 | Usuário no fim, turno novo | sem CTA e colado no fim | **pass** — `ctaApareceu: false`, `ficouColadoNoFim: true` |

## Nota

Refetch em background que falha não derruba mais a conversa: erro vai para o console e o histórico em tela permanece (antes, `Falha ao carregar o histórico da thread.` substituía o chat inteiro).

---

# Smoke — Indicador de atividade no chat (2026-08-11)

**Data:** 2026-08-11 (~07:31–07:38 BRT)
**Ambiente:** `pnpm dev` (Electron real, `dangerouslyDisableSandbox`) com `ENGRENACODE_USER_DATA=%TEMP%\engrena-smoke-shimmer`, `ANTHROPIC_API_KEY`/`CLAUDE_API_KEY` unsetadas antes do boot; Playwright em `http://localhost:5173`
**Credenciais smoke:** workspace `~/smoke-shimmer` · password `smoke-shimmer-pass`
**Projeto:** `%TEMP%\engrena-smoke-shimmer-proj` (git init + commit seed, fora do repo)
**Provider:** `claude` · access `Auto-accept edits` · execution `Main`
**Artefatos:** `.playwright-cli/shimmer-during-text.png`, `.playwright-cli/shimmer-executando.png`, `.playwright-cli/shimmer-tool-{7,8}.png`

## Gap original

Com resposta parcial do agente já em tela, o rodapé do chat ficava vazio durante o resto do turno: `showThinking` exigia `streamingText === ''`, então o indicador sumia na primeira frase e o chat parecia congelado. O work log continuava marcando `trabalhando…`, mas sem sinal de vida abaixo do texto.

## Fluxo real (4 turnos reais na mesma thread)

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| 1 | Unlock via UI (vault novo isolado) | `#dashboard` | pass |
| 2 | `POST /api/projects` (header `x-engrenacode-session`) + abrir `#principal` | projeto listado | pass |
| 3 | Turno 1 (glob/read/grep) | indicador visível durante todo o `running` | pass — `Pensando… 6s` → `Executando… 1s` → `Pensando… 14s` |
| 4 | Turno 2 (follow-up passo a passo) | indicador junto do texto já renderizado | pass — `shimmer-tool-8.png`: passos 1–6 em tela **e** `● Pensando… 25s` abaixo |
| 5 | Turno 3 (`sleep 12 && ls`) | rótulo troca para a tool em execução | pass — `.text-shimmer` = `["sleep 12 && ls", "Executando… 1s"]` |
| 6 | Turno 4 (`sleep 25`) | screenshot com rótulo de tool | pass — `shimmer-executando.png`: `● Executando… 1s` |
| 7 | Fim do turno | indicador some com `state !== running` | pass — `.text-shimmer` vazio, `Pensou por 33s` no lugar |

## Achado corrigido durante o smoke

Turno 2 nasceu com `Pensando… 31s`: `thinkingStartMs` só olhava o histórico persistido, e no follow-up a mensagem nova ainda é bolha otimista (`pending`), então o cronômetro herdava o horário do turno anterior. `currentActivity` passou a considerar as pendings já despachadas (`queued`/`permission` não contam). Reverificado ao vivo: follow-up seguinte nasceu em `Pensando… 1s`.

## Cobertura de rótulo

`Pensando` (sem tool) · `Executando` (Bash) confirmados ao vivo. Demais rótulos (`Lendo`, `Buscando`, `Procurando arquivos`, `Editando`, `Delegando`, `Carregando skill`, `Planejando`, `Pesquisando na web`) e o fallback `Trabalhando` para tool desconhecida/`mcp__*` cobertos por unitário em `chatHistory.logic.test.ts`.

---

# Smoke: permissão Supervised TodoV1 (2026-08-12)

**Contexto:** regressão relatada — modal ausente / Allow sem efeito / "Sim" no chat não liberava tool; prompt real da todolist (Express + Scalar).

**Método:** `pnpm dev` + `ELECTRON_EXTRA_LAUNCH_ARGS=--no-sandbox` + `ENGRENACODE_USER_DATA=%TEMP%\engrenacode_claude_perm_smoke_0812` + `playwright-cli` em `http://localhost:5173`; `ANTHROPIC_API_KEY` unset; projeto `D:\temp\TodoV1` (git seed); Claude · Supervised · Main · `claude-sonnet-4-6`.

## Resultado

| # | Critério | Resultado |
|---|----------|----------|
| 1 | Modal PreToolUse abre no primeiro Bash | **pass** — `Permitir a ferramenta …` com params `ls D:/temp/TodoV1` |
| 2 | Clique **Permitir** libera a tool | **pass** — Work log avançou; agente seguiu para `package.json` / install |
| 3 | **Permitir todos** evita re-prompt da mesma chave | **pass** — tools seguintes sem novo modal (allowlist) |
| 4 | Artefatos no disco após aprovação | **pass** — `package.json`, `index.js`, `package-lock.json`, `node_modules` (express + @scalar/express-api-reference) |
| 5 | Nome da tool no modal | **fail parcial** — UI mostrou `unknown` (params ok); fallbacks `tool`/`toolName`/`name` adicionados no hook |
| 6 | Composer "Sim" + Enviar com modal aberto | **bloqueado na UI** — botão virava Parar e backdrop interceptava clique; corrigido: Enviar sob `permissionPending` + overlay `pointer-events-none` |

## Nota

Turno ficou preso em "test it runs" com servidor Node de longa duração; thread assentou em `error` após cancel. Não é falha do broker de permissão — o gate Supervised já tinha liberado Write/Bash/npm install.


## Permission Recovery — Sprint 1 (2026-08-12)

**Escopo:** contrato PreToolUse + eventos recuperáveis de negação nativa.
**Gate unitário:** 	sc -b + targeted (cli-driver/permission-contract/stream-json-parse/permission-hook/dispatch native-denial) + suite completa 1355×2.

| Critério | Resultado |
|----------|-----------|
| supervised → --permission-mode auto + --settings + --include-hook-events | pass (cli-driver.test) |
| Parser emite hook-started / hook-response / permission-native-denial sem command body | pass (stream-json-parse + fixtures) |
| permission-native-denial → log + WS permission.native_denial | pass (dispatch.test) |
| Windows hook embute ELECTRON_RUN_AS_NODE=1 | pass (cli-driver.test) |
| Background Bash sem PreToolUse ainda pode negar nativo; evento EngrenaCode existe | pass (mínimo Sprint 1; UI modal = Sprint 2) |

Agentes: .claude/agents/sprint-1-permission-contract-dev.md + …-review.md. Loop: 2 ciclos (FAIL wire dispatch → fix → APPROVE).

## Permission Recovery — Sprint 2 (2026-08-12)

**Escopo:** waiting_permission + broker snapshot/timeout/replay + composer routing.
**Gate:** 	sc -b + targeted + suite 1373 (2ª corrida flake 20ms no broker isolado verde).

| Critério | Resultado |
|----------|-----------|
| Estado waiting_permission distinto de running/waiting_user | pass |
| GET /permissions + replay WS no subscribe | pass |
| Timeout 2min fail-closed auto-deny | pass |
| “Sim” resolve; texto inválido não enfileira | pass (composerRoute.logic) |
| Enviar + Parar com modal; dequeue só após HTTP OK | pass |

Agentes: .claude/agents/sprint-2-permission-state-*.md. Loop: 1 ciclo APPROVE.

## Permission Recovery — Sprint 3 (2026-08-12)

**Escopo:** cancel tree by PID + deny-before-abort + tool calls interrupted.
**Gate:** 	sc -b + focused 111 + suite 1390.

| Critério | Resultado |
|----------|-----------|
| killProcessTree Windows taskkill /T /F; never by name | pass |
| deny permissions/ask → close servers → interrupt tools → abort | pass |
| Renderer limpa streaming; erro se cancelled:false | pass |
| Enviar+Parar preservados | pass |

Agentes: .claude/agents/sprint-3-process-lifecycle-*.md. Loop: 1 ciclo APPROVE.

## Permission Recovery — Sprint 3 (2026-08-12)

**Escopo:** cancel tree by PID + deny-before-abort + tool calls interrupted.
**Gate:** 	sc -b + focused 111 + suite 1390.

| Critério | Resultado |
|----------|-----------|
| killProcessTree Windows taskkill /T /F; never by name | pass |
| deny permissions/ask → close servers → interrupt tools → abort | pass |
| Renderer limpa streaming; erro se cancelled:false | pass |
| Enviar+Parar preservados | pass |

Agentes: .claude/agents/sprint-3-process-lifecycle-*.md. Loop: 1 ciclo APPROVE.

## Permission Recovery — Sprint 4 (2026-08-12)

**Escopo:** export MD/JSON confiável + botão visível + snapshot settled.
**Gate:** 	sc -b + 20 focused + suite 1403.

| Critério | Resultado |
|----------|-----------|
| Botão export sempre visível (não só hover) | pass |
| try/catch/finally + erro z-60 | pass |
| Snapshot assenta tools running em cancelled/idle | pass |
| Export em qualquer estado de thread | pass |

Agentes: .claude/agents/sprint-4-transcript-export-*.md. Loop: 1 ciclo APPROVE.

## Permission Recovery — Sprint 5 (2026-08-12)

**Escopo:** coalesce history + caps stderr/tool + markdown light no stream.
**Gate:** 	sc -b + 55 targeted + suite 1421 (2ª corrida; 1ª flake tinypool IPC).

| Critério | Resultado |
|----------|-----------|
| HistoryRefetchGate single-flight/coalesce + mergeById | pass |
| stderr ≤256KiB cauda + marcador; tool result ≤64KiB | pass |
| ChatMarkdown light enquanto streaming | pass |
| Métricas DEV sem segredos | pass |
| Sprints 1–4 intactas na regressão da suite | pass |

Agentes: .claude/agents/sprint-5-runtime-performance-*.md. Loop: 1 ciclo APPROVE.

### Fechamento das 5 sprints
Contrato PreToolUse observável → waiting_permission recuperável → cancel por árvore PID → export confiável → caps/coalesce de memória. Smoke Electron real TodoV1 pós-fix ainda recomendado manualmente (Bash background + Sim + Cancel + export).

## Permission Recovery — correção pós-smoke: broker fora de supervised (2026-08-12)

**Sintoma no smoke real** (thread `thr_c458e61a`, projeto `D:/temp/TodoV1`, nível **Auto-accept edits**):
`Bash npm install` e as tools MCP falharam com `This command requires approval` /
`Claude requested permissions to use mcp__…, but you haven't granted it yet`, **sem** `permission.request`
no WS. Sem permissão pendente, o `Aprovado` do usuário foi roteado como turno novo e o agente respondeu
"Precisa clicar direto no prompt de permissão do `npm install` (botão)" — botão que não existia.

**Causa:** o broker PreToolUse só era montado em `supervised` (`dispatch.ts` + `cli-driver.ts`), e
`--permission-mode acceptEdits` nega Bash/MCP nativamente sem consultar hook nenhum.

**Correção:** `permission-policy.ts` — broker em qualquer nível exceto `full-access`, com a semântica do
nível vindo da política (não do modo do CLI): `auto-accept-edits` auto-aprova leitura/edição
(`Read/Glob/Grep/LS/NotebookRead/TodoWrite/Write/Edit/MultiEdit/NotebookEdit`) e pergunta em
`Bash`/`WebFetch`/`mcp__*`; `supervised` pergunta tudo. `PATCH accessLevel` mid-turn passou a liberar só
o que o novo nível auto-aprova.

| Critério | Resultado |
|----------|-----------|
| auto-accept-edits monta broker: Write sem UI, Bash abre `permission.request` | pass (dispatch.test) |
| `--settings` + `--permission-mode auto` em auto-accept-edits; `acceptEdits` só sem broker | pass (cli-driver.test) |
| full-access segue sem porta/broker (`bypassPermissions`) | pass |
| upgrade → auto-accept-edits solta Write e mantém Bash no modal; → full-access solta tudo | pass (threads-handler.test) |
| Gate `tsc -b` + suite 1434 (delegate.test flake de 5 s verde na 2ª corrida) | pass |

Validado ao vivo (2026-08-12, Luks): smoke TodoV1 em Auto-accept edits — pedido de permissão aparece e
a aprovação por texto (`Aprovado`) concede, sem o agente pedir clique.

## Permission Recovery — pedido de permissão dentro do chat (2026-08-12)

**Ajuste pedido na validação:** o pedido chegava como caixa flutuante fora do chat; o esperado é ficar
na própria conversa.

**Mudança:** `PermissionPrompt` deixa de ser overlay (`fixed inset-0 z-50` + `aria-modal`) e passa a ser
card inline no fim da timeline do `ChatHistory`, do mesmo jeito que o `AskUserQuestionCard`: cabeçalho
"O agente precisa de permissão", pergunta, `Parâmetros` em `<details>` fechado e as opções como chips
(Permitir / Permitir todos / Sempre neste projeto / Negar). O clique segue preenchendo o composer —
concede o Enviar ou o texto digitado. `permissionQueue.length` entrou no sinal do `useChatScroll` porque
o pedido chega antes do `tool_call` existir e o card nasceria fora de vista.

| Critério | Resultado |
|----------|-----------|
| Sem overlay/backdrop no código: nenhum `fixed`/`z-50`/`aria-modal` restante no fluxo de permissão | pass |
| Gate `tsc -b` + 327 testes de `src/renderer` | pass |
| Card no fim da timeline, opções → composer, Enviar concede (Electron real) | pass (validação Luks + ajuste AskUser sem campo próprio) |

## Permission UX + Haiku Auto-accept sim (2026-08-12)

**Pedidos do smoke visual:**
1. Permissão duplicada / sugestões com "Executando…" — followups e decisões agora só em thread idle sem pending ativo.
2. AskUserQuestion com textarea+Enviar no card — removidos; só chips → composer principal; em `waiting_user` o composer mostra Enviar (não só Parar).
3. Enquanto a IA trabalha, texto do usuário continua enfileirado (`enqueue`); followups são limpos no envio/fila.

**Simulação API** (`claude-haiku-4-5`, `auto-accept-edits`, `D:\temp\TodoV1`, userData isolado `engrenacode_claude_haiku_sim2_0812`):

| Critério | Resultado |
|----------|-----------|
| Broker em waiting_permission; toolName=`Bash` (não `unknown`) | pass |
| Write auto-aprovado (0 pedidos Write); Write completed ≥4 | pass |
| Zero `ask_user_question` no turno | pass |
| Hook `PermissionRequest` + launcher `.cmd` (stdin Windows) | pass (package.json/index.js/README criados; npm install concluiu) |
| Gates: permission-hook + cli-driver + permission-contract + askUserQuestion | 68 testes pass |

## Fase 0 do redesign do chat — smoke Electron real (2026-08-13)

Fecha **D08**. Primeiro smoke ao vivo após a remediação da auditoria (0 🔴 / 4 🟡, suíte 1500/151).
Ambiente: Electron real via `pnpm dev` (`ANTHROPIC_API_KEY` desetada, sessão de assinatura),
Chromium dirigido por `playwright-cli` em `localhost:5173`, API loopback `127.0.0.1:5174`.
Projeto: `D:\temp\TodoV1` recriado do zero (git init + 1 commit).
Provider `claude-sonnet-4-6`, accessLevel `supervised`, execution `main`.

**Versão do CLI: `claude` 2.1.231.** O contrato do hook estava registrado como validado contra
2.1.226 (CLAUDE.md) e as fixtures contra 2.1.228. Esta é a primeira validação ao vivo na 2.1.231.

### Resultados

| Critério | Resultado |
|----------|-----------|
| Card de permissão inline no fim da timeline (sem overlay) | pass |
| `toolName` = `Bash` (não `unknown`) | pass |
| Clique na opção **só** preenche o composer; card permanece; tool não executa | pass |
| Enviar concede de verdade e a tool executa | pass |
| "Permitir todos" → allowlist da thread; Bash seguinte sem novo card | pass |
| `cliSessionId` persistido para `--resume` | pass (`020a677c-…`) |
| Composer em `waiting_permission`: Parar **e** "Enviar decisão de permissão" | pass (Enviar desabilitado com texto vazio) |
| Placeholder muda para modo follow-up em `idle` | pass |
| **R03** — negação nativa do CLI vira aviso visível | pass (ver ressalva abaixo) |
| Cancel/lifecycle: turno com `run_in_background` não deixa órfão | pass (ver nota) |
| Export `format=md` e `format=json` | pass (4 mensagens, 3 tool calls, Work log íntegro) |
| Export com `format=markdown` | 400 `validation_error` com mensagem clara (esperado; a API aceita `md`) |

### R03 provou-se, e revelou um defeito na própria copy

O turno disparou uma negação nativa real: a primeira `Bash` (`git log --oneline`) foi negada por um
hook **global do usuário** (`~/.claude/scripts/validate-git-log-limit.ps1`), que exige bound em `git log`.
Antes da correção do R03 esse evento era tipado no `StreamEvent` e descartado sem branch — o usuário
veria o agente falar de aprovação sem card nenhum. Agora aparece.

Mas a copy atual afirma: *"O CLI negou a ferramenta Bash por conta própria, sem pedir permissão ao
EngrenaCode — por isso nenhum card apareceu no chat"*, e sugere revisar o nível de acesso da thread.
Neste caso **é falso**: o card apareceu, o broker do EngrenaCode concedeu, e outro hook da mesma cadeia
`PreToolUse` negou depois. A mensagem precisa distinguir os dois casos, e quando o `systemMessage` do
hook vier junto (veio, e explicava o bound), ele é a informação útil — não o nível de acesso.

Registrado como achado novo. Não corrigido nesta passagem.

### Nota sobre órfãos de processo

O agente resolveu `sleep 180 && echo fim` com `run_in_background: true`, o turno assentou em `idle`
imediatamente e a árvore (`bash.exe` ×3 + `powershell.exe`) **foi colhida** — os PIDs não sobreviveram
ao fim do turno. Baseline de `claude.exe` inalterado (14 → 14), `node.exe` inalterado (13 → 13).

Contraste com o smoke de 2026-08-12: ao limpar `D:\temp\TodoV1` foram encontrados **dois `node server.js`
órfãos** (PIDs 36272 e 30728), criados em 12/08 18:13 e 18:21, ainda vivos ~19 h depois, segurando a
porta 3000 e o diretório. São anteriores à correção de kill por árvore de PID, então não a invalidam —
mas documentam que o modo de falha era real e passava despercebido.

### Não coberto

Cancel explícito via botão Parar no meio de um turno longo em foreground: o agente escolheu background
e o turno fechou antes. Continua recomendado.

## Fase C do redesign do chat — smoke Electron real (2026-08-16)

Gate da Fase C do plano: **H1, H2, H3, H7**, scroll/work log sem regressão e reconnect com socket morto.
Ambiente: Electron real via `pnpm dev` (`ANTHROPIC_API_KEY` desetada), Chromium headed dirigido por
`playwright-cli` em `localhost:5173`, API loopback `127.0.0.1:5174`. Projeto `D:\temp\TodoV1`.
Provider `claude-sonnet-4-6`, execution `main`. Thread `thr_8c9d2e01-81d5-4f22-88e1-a9603d42b75e`.

### Como o socket foi derrubado

Primeira tentativa (emulação de rede do Chromium, `Network.emulateNetworkConditions` / `context.setOffline`)
**não serve** e custou dois turnos: `offline: true` corta fetch/XHR mas **não** o WebSocket em loopback —
o card de permissão chegou com `navigator.onLine === false`. Pior, a condição gruda na sessão CDP e não
volta nem com `setOffline(false)`; só fechando o browser.

O que funciona é patch no construtor, via `addInitScript`: uma subclasse de `WebSocket` que registra cada
tentativa com timestamp e, sob a flag `window.__break`, reescreve a porta `5174` para uma porta morta.
Isso dá socket morto de verdade, backoff observável e restauração instantânea.

### Resultados

| Critério | Resultado |
|----------|-----------|
| H1 — turno nasce com streaming, tool e resposta persistida | pass |
| H2 — follow-up lembra o contexto via resume | pass (`cli_session_id` = `4d69d620-…` no DB) |
| H3 — follow-up durante `running` enfileira ("Na fila — aguarde") e drena em `idle` | pass |
| H7 — pill de acesso mid-thread | pass (`PATCH` 200; DB gravou `access_level='auto-accept-edits'`) |
| Socket morto reconecta sozinho | pass — exatamente 1 socket novo, sem tempestade em 108 s |
| Backoff crescente com jitter | pass — tentativas em +0,7s, +4,5s, +10,2s, +20,1s, +31,3s |
| Resync após a queda traz o que passou, sem duplicata | pass — turno inteiro produzido com o socket quebrado; cada mensagem aparece 1× |
| Gate aberto reaparece pelo snapshot `GET /gate` | pass — reload completo (passando pelo unlock) e o card volta na posição certa |
| Concessão real depois do reconnect executa a tool | pass |
| Troca de thread durante o backoff não escreve na thread nova | pass — após a troca, 100% das tentativas usam o `threadId` novo; timeline da outra thread sem contaminação |
| Work log aberto sobrevive ao refetch de stream | pass — `<details>` continua aberto |
| Scroll não é destruído pelo refetch | pass — `scrollTop` idêntico (1978) antes e depois; sem "Carregando…" foreground |
| CTA quando a resposta chega fora de vista | pass — copy real é "O agente respondeu. / Ir para o final (ctrl+End)", não "Ver mensagem" como o plano dizia |

### Achado novo 🔴 — thread presa em "Agente trabalhando" com o backend em `idle`

Reprodução: turno em andamento, socket quebrado durante todo o turno (backoff apontando para porta morta),
troca de thread e volta. O turno terminou normalmente no servidor — `threads.state = 'idle'`, resposta
persistida, `GET /gate` vazio — mas a UI ficou com o composer em modo busy: placeholder
"Agente trabalhando — Enter enfileira para o próximo turno" e só o botão Parar. **A thread fica inutilizável
até um F5**, sem nenhum sinal de erro.

Trocar de thread e voltar **não** corrige. Recarregar a página corrige. Ao reabrir a thread o cliente chama
`GET /history`, `GET /diffs` e `GET /gate` — mas nada relê o `state` da thread, que vem da lista carregada
antes e permanece obsoleta em memória. O `state.change → idle` perdido durante a queda nunca é recuperado.

É o mesmo buraco que o resync fechou para mensagens e para o gate, faltando para o estado do turno.

### Achado 🟡 — R08 reconfirmado ao vivo

O aviso "Aprovação nativa do Claude CLI negou a ferramenta Bash (sem modal EngrenaCode) … revise o nível de
acesso da thread" apareceu num turno em que o card **apareceu** e o broker do EngrenaCode **concedeu**;
o Bash foi negado depois, por outro hook da cadeia `PreToolUse`. A copy afirma o contrário do que houve.
Já estava aberto como R08; esta é a segunda observação ao vivo.

### Achado 🟡 — erro de decisão renderizado em dobro

Com o `POST /gate/:id/resolve` falhando, a mensagem "Não foi possível enviar a decisão. Tente novamente."
apareceu **duas vezes** na tela. O comportamento de fundo está certo (o card permanece, nada é removido
otimisticamente), só a renderização do erro é duplicada.

### Observação ℹ️ — "dois sockets por thread" era artefato da instrumentação (retificado em 2026-08-16)

Registrado aqui primeiro como suspeita de vazamento: duas conexões para `5174` na mesma thread, ambas em
`readyState 1`, com a hipótese de que o cleanup do mount duplo do `React.StrictMode` não fechava a primeira.

**Não se confirma.** Medido depois com um tracer que conta criação e chamadas de `close()` por socket: uma
thread aberta do zero cria **um** socket, sem `close()` pendurado. O par que eu tinha visto veio do meu
próprio teste — eu fechava à mão os sockets apontados para a porta morta enquanto o hook já tinha um timer
de reconnect agendado, e as duas aberturas se somavam. O `disconnect` de `renderer/services/ws-client.ts:71`
zera os handlers e chama `ws.close()` como deveria.

Fica como lembrete de método: contar sockets numa lista acumulada não distingue vazamento de artefato do
próprio instrumento. O que decide é registrar criação e fechamento por socket.

### Notas de ambiente (custaram tempo neste smoke)

- O cofre vive na memória do processo main e só é destravado por IPC pela **janela do Electron**. Fechar
  aquela janela derruba o `pnpm dev` inteiro (exit 0) e leva a API junto; qualquer reload do renderer do
  Electron trava o cofre e derruba a sessão que o Chromium estava usando.
- `playwright-cli open` sem `--headed` sobe headless: não há janela para o usuário digitar a senha.
- O header de sessão é `x-engrenacode-session`, não `Authorization: Bearer`.

### Não coberto

Cancel explícito pelo botão Parar em turno longo em foreground (continua pendente desde 2026-08-13) e
`GET /gate` durante a janela de backoff longo (o gate expira em 120 s, o reconnect real leva menos de 8 s).

### Correção do achado 🔴, verificada ao vivo (2026-08-16)

`resyncThread` passou a reler o estado da thread em todo open (não só no reconnect) e a aplicar
`decideThreadStateResync` de `threadStream.logic.ts`; o bloco de assentamento virou
`reconcileSettledTurn`, chamado tanto pelo `state.change` ao vivo quanto pelo resync.

Repro com o código novo, mesmo roteiro: turno longo, socket reescrito para porta morta durante o
turno inteiro, servidor assentando em `idle` com o cliente cego. Antes de religar, o composer
seguia em "Agente trabalhando" (o bug). Ao religar, a UI voltou sozinha para "Responder nesta
conversa…" com o botão Enviar, e a resposta produzida durante a queda entrou na timeline uma vez
só. Nenhum F5.

Gates: `tsc -b` verde; `pnpm test` 160 arquivos / 1781 testes (baseline 1770 + 11 novos), verde
com o app de smoke encerrado.

### Correção dos dois achados 🟡, verificada ao vivo (2026-08-16)

**R08 (`da022fa`).** O broker passou a registrar o que concedeu no turno, e o evento
`permission.native_denial` carrega `brokerGranted`. Com o hook global do usuário negando
`git log --oneline` sem bound, a faixa mostrou a copy do caso certo: *"O EngrenaCode concedeu a
ferramenta Bash, mas outro hook PreToolUse do Claude CLI negou em seguida. O nível de acesso da
thread não muda isso…"*. O work log do próprio agente confirmou a causa (*"bloqueado por hook de
política global. Rodei com -n 50 + git rev-list --count"*). A copy antiga, que afirmava que nenhum
card apareceu, não é mais emitida nesse caso.

Nota sobre o achado original: ele citava um `systemMessage` do hook como a informação útil
descartada. **Esse campo não existe** no payload do CLI — era suposição. O equivalente com
evidência in-repo é `decision_reason`, agora propagado e truncado em 300 chars.

**Erro de decisão duplicado (`628442d`).** Reproduzido interceptando `POST **/gate/**/resolve` com
500: antes, dois `<p role="alert">` idênticos (um no `PermissionPrompt`, outro no composer, vindos
de `gateApi.error` e de uma cópia em `sendError`). Depois da correção, **um** `role="alert"`, no
card, com o card ainda em tela — o contrato de "falhou, o pedido não some" segue valendo.

Gates dos dois: `tsc -b` verde, `pnpm test` 160 arquivos / 1795 testes (1781 + 14 novos).

## A09 + D08 — as quatro formas de Bash e o Cancel em foreground (2026-08-16)

Último smoke pendente do lote: o que dá consumidor honesto à `BASH_PERMISSION_MATRIX` (A09) e o que
faltava do D08 desde 2026-08-13. Ambiente: Electron real via `pnpm dev` (`ANTHROPIC_API_KEY`
desetada antes de subir), Chromium headed dirigido por `playwright-cli` em `localhost:5173`, API
loopback `127.0.0.1:5174`. Projeto `D:\temp\TodoV1`, provider `claude-sonnet-4-6`, access
**supervised**, execution `main`. Thread `thr_3c28713f-60d9-4b84-87f7-8fd986f09f0d`. Binário
`claude` **2.1.233**.

A correlação foi lida direto de `log_entries` (`kind='tool'`) no `engrenacode.db`, que é onde
`hook started: …` / `hook response: …` e a negação nativa caem — não por inspeção de DOM.

### As quatro linhas da matriz

| Caso da matriz | `command` observado no card | `PreToolUse` disparou? | Negação nativa? | Desfecho |
|---|---|---|---|---|
| `simple` | `ls` | sim | não | `Bash (completed)` |
| `compound` | `pwd && ls -1` | sim | não | `Bash (completed)` |
| `foreground-server` | `python -m http.server 8931` (`timeout: 600000`) | sim | não | `Bash (cancelled)` pelo Parar |
| `run-in-background` | `sleep 20 && echo caso4-ok` (`run_in_background: true`) | sim | não | `Bash (completed)` |

`expectsPreToolUseGate: true` valeu nas quatro, e `requiresNativeDenialEventIfUngated` nunca
precisou disparar porque nenhuma ficou sem gate. A nota pessimista da linha `run-in-background`
("se o CLI atual pular PreToolUse e cair em aprovação nativa…") **não se materializa** em 2.1.233:
o card apareceu com `run_in_background: true` no payload, igual às outras três.

Os quatro gates de permissão nasceram e morreram resolvidos em `thread_gates` (`permission/Bash`,
quatro linhas, todas `state=resolved`), e o clique só preencheu o composer — a concessão veio do
Enviar, como manda o contrato.

### D08 — Parar durante turno longo em foreground

O caso `foreground-server` é o palco que faltava: `python -m http.server 8931` bloqueia a tool, e o
turno fica preso de verdade (nada de o agente escolher `run_in_background` e o turno fechar sozinho,
que foi o que frustrou a tentativa de 2026-08-13).

Com o servidor no ar (`python.exe` PID 8460, `0.0.0.0:8931 LISTENING`), o botão **Parar** foi
clicado. Resultado:

- `Bash (cancelled)` no log **no mesmo segundo** do clique — a tool não ficou presa em `running`.
- Processo 8460 morto e porta 8931 liberada em **menos de 2 s** (primeira verificação já achou
  `listening=0`, `proc8460=False`). Sem órfão.
- Thread assentou em `cancelled` no DB e o composer voltou para "Responder nesta conversa…".
- Nenhum gate ficou aberto.

D08 fechado.

### Achado 🟡 novo — negar pelo card é relatado como "sem consultar o broker"

Depois dos quatro casos, o agente pediu `Read`. A permissão foi **negada pelo card do EngrenaCode**
(botão Negar → Enviar). O CLI então emitiu `permission_denied` no stream, e as duas superfícies do
EngrenaCode descreveram o que aconteceu **errado**:

- log (`kind='tool'`): *"Aprovação nativa do Claude CLI negou a ferramenta Read sem consultar o
  broker do EngrenaCode."*
- faixa âmbar: *"O CLI negou a ferramenta Read por conta própria, sem pedir permissão ao
  EngrenaCode, por isso nenhum card apareceu no chat. Peça de novo ao agente; se repetir, revise o
  nível de acesso da thread."*

O broker foi consultado, o card apareceu, e quem negou foi o usuário. A causa é estrutural:
`NativeDenialCase` tem só dois valores, derivados de `brokerGranted`, e o broker registra apenas
concessões (`recordBrokerGrant`); "negado por mim" é indistinguível de "nunca visto". É a mesma
classe do R08 — que fechou o caso *broker concedeu e outro hook negou* e deixou este de fora.

O dano é o conselho: manda revisar o nível de acesso e repetir o pedido, quando a resposta certa é
"você negou". Rastreado como **R09**.

### Também verificado de graça

- **D3 ao vivo.** A faixa âmbar trouxe, no primeiro turno, *"O Claude CLI instalado é a versão
  2.1.233, acima da faixa 2.1.226 a 2.1.231 … O turno não foi bloqueado"* — a copy `above-max`
  exata, uma vez só na sessão inteira, com a linha curta correspondente em `log_entries` (`kind`
  `task`). Nenhum turno foi bloqueado por causa dela.
- **`--resume`.** `hook started: SessionStart:resume` abre cada follow-up, confirmando que a thread
  continuou a mesma sessão do CLI.

### Não coberto

`GET /gate` durante a janela de backoff longo (segue pendente desde a Fase C: o gate expira em 120 s
e o reconnect real leva menos de 8 s).

Nota sobre a fala do agente: depois do cancel ele escreveu que "caso 3 não rodou, o servidor nunca
subiu". É falso — o servidor subiu e foi observado escutando na 8931. O cancel apenas o deixou sem o
resultado da tool. Não é defeito do EngrenaCode, mas explica por que o transcript daquela thread
parece contradizer esta evidência.

### Correção do R09, fechada em 2026-08-17

O achado saiu deste smoke e foi corrigido no mesmo lote. `brokerGranted` (booleano) deu lugar a
`BrokerPermissionOutcome`, com cinco valores honestos: `granted`, `denied`, `expired`,
`unavailable` e `never-requested`. O broker passou a registrar o que **respondeu** ao hook, não só
o que concedeu, e a continuação do gate passou a entregar `{allow, reason}` — sem o motivo, negar
no card e ninguém responder eram o mesmo `false`.

A frase que motivou o achado (*"negou … sem consultar o broker do EngrenaCode"*) agora só aparece
quando o hook de fato nunca perguntou. Negação do usuário virou *"Você negou a ferramenta X no card
de permissão"*, com o conselho certo: pedir de novo e conceder, ou responder "Permitir todos" /
"Sempre neste projeto" — nada de mandar revisar o nível de acesso por uma decisão que foi dele.

O texto do R08 ficou intacto, com teste cobrando isso: é a mesma copy que já tinha sido paga uma vez.

Limitações registradas de propósito: um body acima do cap (413) nega antes de existir `toolName` e
cai em `never-brokered`; a granularidade continua por tool, com a última decisão vencendo; e
`expired` cobre também o cancel de turno com card aberto.

Gates: `tsc -b` exit 0, `pnpm test` **1855 testes / 161 arquivos** verde em duas rodadas, `vite build` ok.

### As três limitações do R09, tratadas em 2026-08-17

- **Cancel deixou de se passar por timeout.** `GATE_REASON_THREAD_CANCELLED` virou constante e o
  broker registra `cancelled`, com copy própria. Antes, apertar Parar com o card aberto produzia a
  frase do fail-closed, que mandava "responder ao card enquanto ele estiver na tela".
- **Decisões conflitantes viram `ambiguous`.** A chave do registro é o `toolName`, não a chamada, e
  deixar a última decisão vencer em silêncio fazia a negação nativa afirmar a decisão da chamada
  errada. Quando a mesma tool é liberada numa chamada e negada em outra no mesmo turno, o
  diagnóstico passa a dizer que não dá para saber a qual delas a negação pertence.
- **Rejeição por tamanho (413) passa a ressalvar a frase.** Esse caminho responde antes de existir
  `toolName`, então a tool fica indistinguível de "o CLI nunca consultou o broker". O turno é
  marcado e a frase de `never-brokered` ganha a ressalva, em vez de afirmar certeza.

O que **não** foi resolvido, por não ter solução do lado de cá: a atribuição da negação a uma
chamada específica. O CLI manda `tool_use_id` na negação e o hook manda `toolName` no pedido; sem
chave comum, o melhor honesto é admitir a ambiguidade — que é o que passa a acontecer.

Gates: `tsc -b` exit 0, `pnpm test` **1866 testes / 161 arquivos** verde em duas rodadas, `vite build` ok.

### Correção da limitação de granularidade (2026-08-17)

O registro acima afirmava que atribuir a negação a uma chamada específica era impossível por falta
de chave comum. **Estava errado.** A doc do Claude Code documenta `tool_use_id` no payload do
`PreToolUse`, ao lado de `tool_name`/`tool_input`, e a negação nativa chega no stream com o mesmo
id (a fixture `system-permission-denied.json` já o traz, e `stream-json-parse.ts` já o extrai).
Quem perdia a chave era o nosso `permission-hook`, que lia o stdin inteiro e repassava ao broker
apenas `{toolName, toolInput}`.

O hook passou a repassar `toolUseId`; o broker grava cada decisão em duas chaves — a exata (`id:…`)
e a agregada por nome — e `brokerOutcomeForTool` consulta a exata primeiro. Com o id nos dois
lados, duas chamadas da mesma tool no mesmo turno recebem cada uma a sua decisão. `ambiguous` deixa
de ser a resposta comum e vira fallback para quando o id falta de algum dos lados.

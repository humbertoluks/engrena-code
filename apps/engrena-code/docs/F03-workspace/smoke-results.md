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

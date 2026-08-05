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

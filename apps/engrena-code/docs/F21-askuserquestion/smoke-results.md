# Smoke: F21. AskUserQuestion

**Data:** 2026-08-09
**Método:** app em dev (`pnpm dev`, Electron real) + `playwright-cli` apontando para `http://localhost:5173`, `ENGRENACODE_USER_DATA` isolado sob `%TEMP%\engrenacode_claude_d07smoke` (mesma sessão do smoke de F20). Vault e `userData` reais do usuário intocados. Turnos reais contra o binário `claude` (assinatura, `ANTHROPIC_API_KEY` unset no shell), modo `Full access`.

## Setup

- 1 projeto fixture (`F21 AskUserQuestion Smoke`, `C:\d07smoke\engrenacode_claude_f21`, repo git real).
- 4 threads: single-select, multi-select, tentativa Minimax (sem key), thread para o teste de cancelamento (criada via `POST /api/projects/:id/threads` direto para fixar `provider=claude`, contornando o último provider escolhido na UI que tinha ficado em Minimax).

## Confirmado ao vivo

1. **Card inline em `waiting_user`**: turno pedindo `ask_user_question` com 3 opções → `thread.state` vai a `waiting_user`; card "O agente precisa da sua resposta" aparece na timeline com as 3 opções + campo "Outra…"; `Enviar` desabilitado até marcar opção ou escrever texto livre (**item 4** confirmado no mesmo passo — nenhum `POST /answer` disparado sem seleção).
2. **Responder e continuar**: clique em "Python" → `Enviar` habilita → clique em `Enviar` → thread volta a `running` e depois `idle` sozinha (poll via `GET /threads`), resposta do agente ("Python escolhido.") aparece na timeline sem reabrir a thread.
3. **`multiSelect: true`**: card muda o texto para "Escolha uma ou mais opções"; marcar "Vitest" + "Playwright" mantém ambos com `pressed`; `Enviar` só habilita com pelo menos 1 marcado; resposta final do agente confirma as 2 opções recebidas ("Vitest, Playwright. Escolhido.").
4. **Thread ocupada durante `waiting_user`**: painel de Repositório com Commit/Commit&push/Commit,push&PR desabilitados; composer mostra placeholder "Agente trabalhando — Enter enfileira para o próximo turno" (mesmo tratamento de `running`, herdado de F03 — não é bloqueio silencioso, é enfileiramento visível).
5. **Picker de provider lista GLM/Grok/Minimax mesmo sem key** (cross-check com item 6 do F23): catálogo estático, sem depender de key salva.
6. **Cancelar thread presa em `waiting_user`**: `POST` direto criou uma thread `claude` (contornando o provider Minimax que tinha ficado selecionado por último na UI) até `waiting_user`; clique em "Parar execução" → `thread.state` vira `cancelled`; card com as opções sai da timeline (só resta o registro do tool call `ask_user_question — trabalhando…`, sem os botões de resposta).
7. **Light/dark**: card de pergunta e card respondido conferidos nos dois temas — tokens do Design Lock, sem hex solto, sem Lion*.

## Não exercitado neste smoke

- **Item 5** (thread com provider Minimax → `mcp.notice` informando que `ask_user_question` está fora do turno): sem key Minimax salva neste ambiente (nenhuma credencial real disponível para a sessão de smoke), a UI bloqueia o envio com "Provider indisponível" antes mesmo de rodar o turno — não dá pra chegar no cenário real. Coberto por teste unitário (`dispatch.test.ts`, cenário de `mcp.notice`/Minimax sem a tool `ask_user_question`), não reproduzido ao vivo.

## Screenshots

- `smoke/f21_answered_light.png` — pergunta respondida (single-select), tema claro
- `smoke/f21_answered_dark.png` — mesma thread, tema escuro

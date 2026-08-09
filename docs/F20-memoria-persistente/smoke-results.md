# Smoke: F20. Memória Persistente

**Data:** 2026-08-09
**Método:** app em dev (`pnpm dev`, Electron real) + `playwright-cli` apontando para `http://localhost:5173`, `ENGRENACODE_USER_DATA` isolado sob `%TEMP%\engrenacode_claude_d07smoke`. Vault e `userData` reais do usuário intocados. Turno real contra o binário `claude` (assinatura, `ANTHROPIC_API_KEY` unset no shell antes do dev/spawn), modo `Full access` para evitar prompt de permissão em automação headless.

## Setup

- 1 projeto fixture (`F20 Memoria Smoke`, `C:\d07smoke\engrenacode_claude_f20`, repo git real prefixado `engrenacode_claude_f20`).

## Confirmado ao vivo

1. **Turno grava entrada de memória**: prompt pedindo para o agente registrar via `write_memory` que `NOTES.md` é fixture do smoke → `mcp__engrenacode__write_memory` aparece na timeline como tool call concluído; `GET /memory/status` passa de `entryCount:0` para `entryCount:1`, `lastEntryAt` atualizado; `GET /memory/journal` retorna a entrada com timestamp e resumo.
2. **Bloco de memória injetado no próximo turno**: em thread nova, prompt "sem olhar o filesystem, o que a memória diz sobre NOTES.md" → o agente responde citando o conteúdo exato da entrada gravada (`"NOTES.md fixture file for F20 smoke test. Not recreate after."`), confirmando que `MemoryRegistry.composeBlockForTurn` injeta o bloco no `systemPrompt` sem precisar de contexto de conversa anterior (thread nova, sem histórico).
3. **Toggle off preserva journal e remove o bloco/tool**: `PATCH /memory/status {enabled:false}`; nova thread perguntando a mesma coisa → agente responde "Memory empty... No tool call write_memory exist" (nem o bloco nem a tool `write_memory` foram oferecidos); `GET /memory/status` continua `entryCount:1`; `GET /memory/journal` retorna o mesmo conteúdo anterior (journal não apagado).
4. **UI do painel Memória** (`ui.md`/`copy.md` já existem, anatomia testável): linha "Memória" no Repo Harness reflete os 2 estados exercitados (`desligada`, `1 entrada`); modal abre com título + pill de contagem, toggle on/off, journal somente leitura, footer com última entrada + tamanho; aviso de desligado ("journal existente foi preservado") aparece e some corretamente ao religar. Light/dark conferidos via screenshot — tokens do Design Lock, sem hex solto, sem Lion*.

## Bug real encontrado e corrigido pelo smoke

Clicar no toggle "Memória" do modal (`PATCH /api/projects/:id/memory/status`) falhava sempre no browser real com erro CORS: `Access to fetch ... blocked by CORS policy: Method PATCH is not allowed by Access-Control-Allow-Methods in preflight response`. Causa: `applyCors` em `src/services/http/unlock-handler.ts:72` hardcodava `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS` — sem `PATCH`, o único método usado por `memory-handler.ts`. Como a Electron renderer window também é um contexto de browser sujeito a CORS, isso quebrava o toggle em produção, não só no smoke. Corrigido em `unlock-handler.ts` (adicionado `PATCH` ao allowlist) com assert novo no teste de preflight existente (`unlock-handler.test.ts`, CORS allowlist describe, `expect(...).toContain('PATCH')`). `pnpm vitest run src/services/http/unlock-handler.test.ts` — 13/13 verde. Rebuild + re-smoke confirmou o toggle funcionando (ligar/desligar sem erro).

## Screenshots

- `smoke/f20_modal_enabled_dark.png` — modal com memória ligada, journal com 1 entrada, tema escuro
- `smoke/f20_modal_enabled_light.png` — mesmo estado, tema claro

## Não exercitado neste smoke

- Item 4 (journal corrompido) — coberto por teste unitário real (`dispatch.test.ts:602`, `PRD AC4 — a corrupted journal does not fail the turn`), não reproduzido ao vivo: corromper o secret `memory:<projectId>` exigiria acesso direto ao vault em memória do processo Electron, sem endpoint HTTP para isso (intencional — é cenário de fixture de teste, não de UI/API).
- Item 5 (falha de escrita simulada) — coberto por teste unitário real (`memory-write-server.test.ts:77`, `runTurn_writeMemoryFailureDoesNotFailTurn`), mesma razão do item 4.

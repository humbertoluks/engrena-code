# Smoke: F08. Registros

**Data:** 2026-08-05 (smoke inicial + recovery de boot) e sessão seguinte (`kind='git'`/`'tool'` via turno real + paginação >100)
**Método:** `pnpm dev` (Electron + Vite reais) + `playwright-cli`, com `ENGRENACODE_USER_DATA` isolado (vault real do usuário intocado; sessão live do usuário na porta 5174 foi encerrada e reiniciada com confirmação explícita antes deste smoke).

**Nota de proveniência:** este arquivo foi escrito em 2026-08-09 formalizando, no local e formato padrão, o smoke real já narrado com detalhe em `docs/PROGRESS.md` (linhas 162–172 na época) — não é uma nova rodada de smoke ao vivo.

## Confirmado ao vivo

1. **Anatomia**: `#registros` renderiza h1/subtítulo/filterbar/tabela conforme `ui.md`.
2. **Filtros**: os 4 chips (Todos/Tasks/Tool calls/Git flow) filtram corretamente, `aria-pressed` no chip ativo, contagem de linhas certa por `kind` (dados semeados diretamente no SQLite do fixture).
3. **Ordenação**: `created_at DESC` (evento mais recente no topo) confirmada; badges de kind com as cores certas (accent/amber/green).
4. **Navegação**: clique no thread id navega para `#principal?project=<id>&thread=<id>&tab=history` e o Workspace resolve projeto e thread certos.
5. **Empty state**: `Nenhum registro ainda` confirmado antes do seed.
6. **Recovery de boot real ponta a ponta**: thread semeada com `state='running'`, `pnpm dev` reiniciado — no boot seguinte a thread virou `error` e um `log_entries kind='task'` foi gravado e apareceu em `#registros` (filtro Tasks) sem nenhuma ação manual.
7. **`kind='tool'`/`'git'` via turno real** (não só seed): o smoke real de F03 gerou `kind='tool'` reais (`Glob`/`Read`/`Edit`, incluindo o caso `error`) via `dispatch.ts` e `kind='git'` reais (`diff aceito`, `Commit ... criado`) via `apply-diff.ts`/`git-handler.ts`, todos visíveis em `#registros` com ordenação e navegação corretas.
8. **Paginação com >100 registros reais**: 150 linhas semeadas diretamente no SQLite isolado, botão "Carregar mais" testado e confirmado que carrega as 150.
9. **Light/dark**: conferido via screenshot (sem hex solto, tokens corretos); zero erros/warnings no console em toda a sessão.

## Não exercitado neste smoke

- Nenhum item relevante do PRD ficou de fora — cobertura completa entre este smoke e o de F03 (que forneceu os eventos `tool`/`git` reais).

## Screenshots

- `ui/registros-referencia.png` (já existente no repo desde a implementação original)

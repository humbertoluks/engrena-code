# Smoke: F18. Subagents em Paralelo (Write-Parallel) — fase visual

**Data:** 2026-08-08
**Método:** app empacotado (`electron-builder --dir`) com `--remote-debugging-port=9222`, `ENGRENACODE_USER_DATA` isolado sob o scratchpad da sessão, CDP attach via `playwright-cli`. Vault e `userData` reais do usuário intocados.

## Setup

Sem turno de agente real: o batch/conflito/`kind` foi semeado diretamente no SQLite isolado (mesmo padrão usado no smoke de F21 — "estado semeado direto no SQLite em vez de queimar turno pago"), reproduzindo o cenário do fixture `ui/write-parallel-fixture.html`:

- 1 projeto fixture (`F18 Smoke Fixture`, repo git real) + 1 thread (`claude · full-access · main`)
- 4 `subagent_runs` no mesmo `parallel_batch_id`: `front-react` (`running`), `api-node` (`completed`), `docs-writer` (`completed`), `test-runner` (`error`)
- 1 diff `conflict` em `src/shared/types.ts` com 2 candidatos (`front-react` +18/−4, `api-node` +7/−2)
- 1 diff `pending` exclusivo em `src/renderer/App.tsx`

## Confirmado ao vivo

1. **Campo Tipo** (`#subagents` → **+ Novo Agente**): select "Tipo" entre Categoria e Provider, opções Dev/Pipeline, hint literal do `copy.md`. Criado um subagent real com `kind=pipeline` via UI — persistiu (`smoke-pipeline-agent` apareceu no catálogo).
2. **Faixa agregada do card Subagents**: renderizou `"Paralelo · 2/4 concluídos · 1 rodando · 1 erro"` — bate exato com o `wp.activity.aggregate` do `copy.md` e com o fixture.
3. **Badge worktree**: presente em todos os 4 runs do batch (`WORKTREE`), ausente nos runs seriais (não exercitado neste smoke, coberto por unit test).
4. **Seção Conflitos** no DiffViewer: bloco âmbar "Conflitos" com o path, hint de bloqueio, 2 candidatos (nome + additions/deletions) e CTA "Usar este" em cada um. Diff `pending` exclusivo segue fora da seção, com Aceitar/Rejeitar normais.
5. **Resolução de conflito ao vivo**: clique em "Usar este" (candidato `front-react`) → `POST resolve-conflict` real → seção Conflitos desaparece, `src/shared/types.ts` reaparece na lista normal como `pendente` com Aceitar/Rejeitar habilitados, contador da aba muda de `Diff 1` para `Diff 2`.
6. **Light/dark**: ambos os temas conferidos via screenshot — tokens do Design Lock (`amber`/`green`/`red`/`border`/`surface`), zero hex solto, sem `Lion*`.

## Bug real encontrado e corrigido pelo smoke

O primeiro screenshot (`workspace-batch-conflict-dark` antes da correção, descartado) mostrou o nome do subagent sumindo ou sobrepondo o texto de duração/status nas rows do card `SubagentActivity` — o wrapper `flex items-center gap-xs truncate` não tinha `min-w-0`/`flex-1` definidos corretamente entre nome/badge/modelo, e a row de batch (nome + badge `WORKTREE` + modelo + duração + status, tudo numa linha só) não cabia na largura real da sidebar com nomes realistas (`front-react`, `test-runner`). Dois ajustes, ambos aplicados a `SubagentActivity.tsx`:

- `min-w-0 flex-1` no wrapper e no `<span>` do nome (truncamento correto com reticências em vez de sobreposição).
- Modelo ocultado quando a row pertence a um batch paralelo (a própria anatomia do `ui.md` §A.5 já não lista modelo nessas rows, só nome/badge/duração/status).
- Status textual omitido enquanto a row de batch está `running` (`ui.md` §A.5: "omitido na row enquanto running, só pulso") — libera espaço e evita truncar o nome a 1-2 caracteres.

Rows `Concluídos`/`erro` de batch com nomes longos ainda truncam agressivamente (`a…`, `d…`) numa sidebar estreita — comportamento pré-existente do `truncate` já usado antes de F18 (não é regressão nova), mitigado pelo `title` do botão (hover mostra nome/provider/modelo completos) e pelo modal de auditoria ao clicar na row.

## Não exercitado

- Batch com 4 filhos simultâneos reais (turno de agente pago) — coberto por teste de integração com worktrees git reais (`delegate.test.ts`), não por smoke visual.
- Erro ao resolver conflito (`wp.error.resolve`) — caminho de sucesso confirmado; falha do endpoint não forçada neste smoke.

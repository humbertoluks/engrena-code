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

## Turno real com 4 filhos simultâneos (2026-08-08, sessão seguinte)

Fechado o item que tinha ficado como "não exercitado": rodado um turno pago de verdade, sem seed no SQLite, contra o binário `claude` real (autenticado pela assinatura já logada no CLI — `ANTHROPIC_API_KEY`/`CLAUDE_API_KEY` unset no processo que subiu o app, mesma regra do resto do projeto). App empacotado + CDP attach, projeto fixture git real num path curto (`C:\f18rt\project` — path fundo do `userData` isolado quebra `git worktree add` no Windows com `fatal: '$GIT_DIR' too big.`, mesmo artefato já documentado no smoke de F14), 4 subagents reais (`writer-a..d`, provider `inherit`) vinculados ao projeto.

Prompt real instruindo o agente pai a chamar `mcp__engrenacode__call_subagent` uma vez com `tasks[]` de 4 itens, cada um escrevendo um arquivo próprio via tool `Write` real.

Confirmado ao vivo:
- 4 `subagent_runs` reais no mesmo `parallel_batch_id`, todos `running` simultaneamente (`durationMs` final 15–18s cada, não somados — confirma paralelismo real, não FIFO) — card lateral mostrou `Paralelo · 0/4 concluídos · 4 rodando · 0 erro` em tempo real.
- Todos os 4 completaram (`4/4 concluídos`), cada um escreveu exatamente o arquivo pedido com o conteúdo certo, sem contaminação cruzada entre filhos (conferido lendo os 4 arquivos no disco do projeto real).
- Aba **Diff** foi de `Diff` (vazia) a `Diff 8` (4 arquivos deste turno + 4 de uma rodada anterior ainda não commitados no mesmo projeto) — cada arquivo aparece **exatamente uma vez**.

**Bug real encontrado e corrigido por este turno pago** (não pego pelos testes de integração nem pelo smoke com estado semeado, porque nenhum dos dois passa pelo `dispatch.ts` completo): a primeira rodada real produziu **8 diffs para 4 arquivos** — cada arquivo duplicado. Causa: `mergeParallelChildDiffs` criava um diff `pending` para cada path exclusivo **e** `dispatch.ts` roda `diffWorkingTree(cwd)` no fim de todo turno (o mesmo mecanismo que sempre capturou mudanças do path serial F15) — como o batch já materializa o arquivo direto no cwd real do pai, o `diffWorkingTree` de fim de turno também o via e criava uma segunda entrada.

Corrigido em `parallel-merge.ts`: o caso de path exclusivo agora **só materializa**, sem criar diff — o `diffWorkingTree` de sempre em `dispatch.ts` cria a entrada, exatamente como já fazia pro path serial F15 (nunca precisou de lógica especial). Só o caso `conflict` continua criando diff explicitamente ali, porque esse path nunca é materializado no cwd do pai (fica retido nos worktrees dos filhos até `resolve-conflict`), então `diffWorkingTree` nunca o veria sozinho.

Re-rodado um segundo turno real após o fix (arquivos `out2-*.txt`, mesmos 4 subagents): `Diff 8` sem nenhuma duplicata — os 4 arquivos da rodada anterior (`out-*.txt`, ainda sem commit) mais os 4 novos, cada um uma vez só. Regressão travada em `delegate.test.ts` (`test_parallel_two_children_disjoint_paths` simula agora o post-turn de `dispatch.ts` explicitamente e verifica 1 diff por arquivo, não 0 nem 2).

## Não exercitado

- Conflito de path com turno pago real (2 filhos reais escrevendo o mesmo arquivo) — o caminho de conflito foi provado ponta a ponta com worktrees git reais em teste de integração (`delegate.test.ts`) e com estado semeado no smoke visual acima; não repetido com custo de API adicional já que a lógica de materialização é idêntica à do caso disjunto, que o turno pago acima já exercitou e corrigiu.
- Erro ao resolver conflito (`wp.error.resolve`) — caminho de sucesso confirmado; falha do endpoint não forçada neste smoke.

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

## Timeline do pai com batch paralelo (2026-08-17)

Rodada posterior, no contexto do F29 (`docs/F29-monitor-de-execucao/smoke-results-tool-stream.md`, rodada 3): batch de 2 filhos reais disparado pelo composer da UI. Achou um defeito que nem o turno de 4 filhos acima nem os unitários pegaram, porque nenhum dos dois olhou a timeline do chat — **o bloco de subagente mostrava só um dos filhos do batch**. Os N filhos de um `tasks[]` gravam o mesmo `parent_tool_call_id`, e a correlação do renderer era 1:1 (`Map<string, SubagentRun>`), sobrescrevendo em silêncio. Corrigido para 1:N, com um bloco por filho.

## Não exercitado

- Erro ao resolver conflito (`wp.error.resolve`) — caminho de sucesso confirmado; falha do endpoint não forçada neste smoke.


## Conflito de path com 2 filhos reais (2026-08-17)

Fecha o último item que estava como não exercitado. Antes disso o conflito só tinha sido visto em
teste de integração (worktrees git reais, mas sem passar pelo `dispatch.ts` inteiro) e no smoke visual
com candidatos semeados direto no SQLite — nenhum dos dois materializa nada a partir de um worktree de
filho de verdade.

**Método:** `pnpm dev` real, vault e projeto reais, turno disparado pela API loopback em `full-access`.
Projeto fixture git em path curto. Dois subagents dedicados (`smoke-writer-a`/`smoke-writer-b`,
provider `inherit`), uma única chamada `call_subagent` com `tasks[]` de 2 itens, ambos mandados
sobrescrever **o mesmo** `alvo.txt` com conteúdos distinguíveis.

### Tentativa que não produziu conflito, e por quê

A primeira rodada usou `explorer` e `implementer` do catálogo. O `explorer` **recusou escrever** — é
read-only pela própria definição do agente — então só um filho tocou o arquivo, o path virou exclusivo
e saiu um diff `pending` comum. Não é defeito do produto: é o batch se comportando como deve quando só
um filho escreve. Ficou o aprendizado de que o conflito exige subagents que de fato escrevem, e a
rodada boa passou a usar dois escritores dedicados.

### Confirmado ao vivo

| # | O que | Resultado |
|---|---|---|
| 1 | Os dois filhos escrevem o mesmo path | `smoke-writer-a` e `smoke-writer-b` fecharam `completed`, mesmo `parallel_batch_id` |
| 2 | Diff único, sem duplicata | **1** linha em `diffs` para `alvo.txt` — nem 0 nem 2 (é a regressão que o turno de paths disjuntos achou em 2026-08-08) |
| 3 | Status e candidatos | `conflict` com **2** candidatos, cada um com o `worktreePath` do seu filho e `+1/−1` |
| 4 | cwd do pai intocado | `alvo.txt` seguia com `alvo inicial` — o path em conflito **não** é materializado, ao contrário do exclusivo |
| 5 | Worktrees retidos e sujos | os dois presentes em `git worktree list`, cada um com `M alvo.txt` e o seu próprio conteúdo |
| 6 | Resolução com filho vencedor | `POST resolve-conflict` com `winningChildThreadId` do `smoke-writer-a` → diff volta a `pending`, candidatos zerados |
| 7 | Conteúdo certo aterrissou | cwd do pai passou a ter `ESCRITO PELO WRITER A` — o do vencedor, não o do perdedor |
| 8 | Diff volta a ser aceitável | `POST accept` respondeu `applied: true` e o diff fechou em `accepted` (em `conflict` o `apply-diff` recusa com 409 `diff_conflict`) |

O item 7 é o que só o turno pago prova: no smoke com estado semeado os candidatos eram fabricados e
não havia worktree nenhum de onde copiar, então "resolveu" significava apenas trocar o status.

**Caminho de erro:** fechado logo depois, na seção abaixo.

**Limpeza:** worktrees removidos, fixture de volta ao commit, subagents de smoke apagados do catálogo.


## Erro ao resolver conflito (`wp.error.resolve`) — 2026-08-17

Último item aberto do F18. Ao ir atrás de como forçar a falha, o caminho de erro revelou **um defeito
real**, e não só a falta de um teste.

### O defeito

`materializeFileIntoParent` decidia tudo por `existsSync(src)` no arquivo dentro do worktree do
vencedor. Se o arquivo não estava lá, a função concluía "o filho apagou este arquivo" e **removia o
arquivo no cwd do pai**. Só que o mesmo `existsSync` dá falso quando o **worktree inteiro** sumiu — e
ele some por caminhos normais: `git worktree prune`, restart do app, limpeza de disco, thread do filho
apagada. Nesse caso a resolução:

1. apagava o arquivo do pai, que estava íntegro;
2. promovia o diff a `pending` carregando os hunks do vencedor (`+1/−1`), descrevendo uma alteração
   que nunca aterrissou;
3. zerava os candidatos, tirando do usuário a chance de resolver pelo outro filho.

Ausência do worktree não é ausência do arquivo. `resolveParallelConflict` passou a checar o worktree
antes de materializar e recusa com `worktree_missing`; o handler mapeia para **409**, junto de
`diff_not_conflict`, porque é estado e não pedido malformado.

### Confirmado ao vivo

Contra o servidor real, com um conflito semeado apontando para um worktree inexistente (sem turno pago
— o que se testa aqui é o endpoint, não o batch):

```
POST /api/threads/:id/diffs/:diffId/resolve-conflict   {"winningChildThreadId":"child-sumido"}

HTTP 409
{"error":{"code":"worktree_missing",
          "message":"O worktree de \"writer-a\" nao existe mais; nao da para materializar essa versao."}}
```

E o que mais importa: o estado sobreviveu ao erro. Arquivo do pai intacto (`alvo inicial`), diff ainda
`conflict` com os **2** candidatos de pé — dá para tentar de novo pelo outro filho.

A mensagem nomeia o subagent de propósito. O `DiffViewer` faz `setError(result.error ?? COPY.errorResolve)`,
então a faixa mostra essa frase específica em vez do texto genérico de `wp.error.resolve` — o que
resolve o `TODO se API devolver message` anotado no `copy.md`. O genérico segue como fallback para
erro sem corpo.

### Cobertura

Três casos novos, todos vermelhos antes do fix e verdes depois: `parallel-merge.test.ts` com o worktree
sumido (recusa, arquivo intacto, diff ainda resolvível) e com o caso legítimo que não pode ser
atropelado (worktree presente e o filho realmente apagou o arquivo → remover é a resolução certa); e
`threads-handler.test.ts` com o 409 `worktree_missing` ponta a ponta pelo handler.

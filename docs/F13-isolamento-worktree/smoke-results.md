# F13 Smoke Results — Isolamento Worktree

**Feature:** F13 Isolamento Worktree
**Data:** 2026-08-06
**Ambiente:** `pnpm dev` (Electron real, `dangerouslyDisableSandbox`) com `ENGRENACODE_USER_DATA` isolado (tmp) + Playwright em `http://localhost:5173` (mesmo bundle do renderer servido pelo Electron); provider real `claude` (sessão de assinatura já logada no binário — `ANTHROPIC_API_KEY` unset)

## Fluxo real

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| 1 | Unlock real + adicionar projeto git local (fixture com 1 commit) | Projeto listado, `branch: main` no sidebar | pass |
| 2 | Composer: Execution=Worktree, Access=Full access, enviar prompt real ("crie um arquivo smoke.txt") | Thread criada; badge **Worktree** aparece na lista de threads (`ProjectTree`) | pass |
| 3 | Verificar disco | `git worktree add` real criou `{userData}/worktrees/<projectId>/<threadId>` na branch `engrenacode/<threadId>` a partir do HEAD do repo principal | pass |
| 4 | Agente real escreve `smoke.txt` | Arquivo aparece dentro do worktree; `project.path` continua com `git status --porcelain` vazio | pass — isolamento confirmado |
| 5 | Diff pendente na aba Diff (1) | Diff capturado do cwd=worktree | pass |
| 6 | GitActions → Commit (mensagem real) | Commit real cai na branch do worktree; `git log` do repo principal continua só em `init` | pass |
| 7 | `DELETE /api/threads/:id` (worktree limpo pós-commit) | `{deleted:true, worktreeCleanup:"removed", warning:null}`; pasta e branch somem (`git worktree list`/`git branch -a` só mostram o repo principal) | pass |
| 8 | 2ª thread worktree; agente cria `dirty.txt` sem commitar; `DELETE` | `{deleted:true, worktreeCleanup:"retained", warning:"Worktree retido com alterações locais; remova manualmente quando seguro."}`; pasta e branch **preservadas** no disco | pass |
| 9 | Reload da UI (sessão nova) | Thread apagada não reaparece na árvore do projeto | pass |

## Notas

- `resolveThreadCwd` confirmado ponta a ponta: dispatch (turno do agente) e git-handler (commit) usaram o mesmo `worktreePath`, nunca `project.path`, quando `executionMode=worktree`.
- Erro `worktree_git_required`/`worktree_create_failed` **não** foi exercitado via UI nesta rodada: o gate pré-existente de F03 (`gitGateActive` em `TaskComposer.tsx`) já bloqueia o envio de qualquer thread — main ou worktree — quando o projeto não tem HEAD, antes mesmo do código de F13 rodar. O caminho é coberto pelos testes automatizados (`dispatch.test.ts`, `threads-handler.test.ts`) que chamam a API direto.
- Achado (não é bug de F13): o painel "Repositório" do `WorkspaceSidebar`/`GitActions` mostra o `vcsStatus` do **projeto principal**, não do worktree ativo — por isso o hint "Tudo em dia" ficou visível mesmo com `dirty.txt` pendente no worktree. O botão Commit não depende desse status (só do campo de mensagem vazio), então a operação real funcionou corretamente; é só o texto de status que está desalinhado. Fica registrado para o escopo de F14 (`GitActions`), que é quem trabalha essa superfície.
- Nenhum artefato de smoke ficou para trás: `ENGRENACODE_USER_DATA` temporário, projeto fixture e `.playwright-cli/` removidos ao final; vault/userData reais do usuário não foram tocados.

## Critérios PRD §9 (F13)

| Critério | Status |
|----------|--------|
| Primeiro envio com `executionMode=worktree` cria worktree real e persiste `worktreePath` | **pass** |
| Dispatch, diffs e git da thread usam `worktreePath`; `main` continua em `project.path` | **pass** |
| Falha de criação não executa o turno no path principal por engano; mensagem específica | pass (unitário/integração; não exercitado via UI — ver Notas) |
| Apagar thread limpa worktree quando seguro; caso sujo, retém e avisa | **pass** |

# Smoke: F05. Skills

**Data:** 2026-08-09
**Método:** `pnpm dev` (Electron + Vite reais) + `playwright-cli`, `ENGRENACODE_USER_DATA` isolado sob `%TEMP%\engrenacode_claude_f05smoke` (vault real do usuário intocado). Projeto fixture git scratch fora do repo (`%TEMP%\engrenacode_claude_f05smoke_project`, `git init` local).

F05 nunca tinha smoke real registrado (só "unitários verdes" em `PROGRESS.md`) — esta é a primeira rodada ao vivo.

## Confirmado ao vivo — CRUD em `#skills`

1. **Listagem**: primeiro unlock já mostra os 12 skills do catálogo seed (F17), chip "Todas 12"/"onboarding 12".
2. **Criar** (`+ Nova skill`): formulário (Nome/Descrição/Categoria/Conteúdo/Habilitada) com botão "Criar" desabilitado até campos obrigatórios preenchidos; skill `f05-smoke-teste` criada e apareceu na listagem imediatamente, contador "Todas" foi para 13, novo chip de categoria "smoke 1" apareceu.
3. **Busca**: campo "Buscar por nome ou descrição…" filtrando por `f05-smoke` reduziu a lista pro único match, mantendo os chips de categoria coerentes com o resultado filtrado.
4. **Toggle Ativar/Desativar** (habilitação global): "Desativar" trocou o card para badge "desativada" e o botão virou "Ativar"; "Ativar" reverteu — persistido (confirmado reabrindo o form de edição).
5. **Editar**: form pré-preenchido com os valores atuais; alterar a descrição e "Salvar" persistiu a mudança na listagem sem reload.
6. **Excluir**: fluxo de confirmação inline (`Excluir` → `Excluir?`/`Não`, não é modal) — confirmar removeu o card da listagem e voltou a contagem para 12.
7. **Light/dark**: `smoke/f05_skills_light.png` / `smoke/f05_skills_dark.png`.

## Confirmado ao vivo — vínculo por projeto (Repo Harness → `ProjectSkillsModal`)

8. **Vínculo real**: projeto fixture adicionado via Workspace; card "Skills" do Repo Harness abre `ProjectSkillsModal` listando os 13 skills com checkbox "Ativar `<nome>` neste projeto"; marcar o checkbox da skill de teste persistiu no servidor (`GET /api/projects/:id/skills` confirmado via `curl` direto: `linked:true, enabledInProject:true`).
9. **Reordenação/toggle por projeto**: cada skill vinculada ganha botões ↑/↓ (`sortOrder`) e um toggle "on/off" (`enabledInProject`) — presentes e clicáveis para a skill vinculada.

## Bug real encontrado e corrigido pelo smoke (🟡 UI staleness)

Ao fechar o `ProjectSkillsModal` depois de marcar/desmarcar o checkbox, o card "Skills" do Repo Harness continuava mostrando **"0 vinculados"** dentro da mesma sessão — mesmo com o vínculo já persistido no servidor (confirmado via API direta). Só reselecionar o projeto (remount do componente) atualizava a contagem exibida. O mesmo padrão de bug afetava, por construção idêntica, os outros 3 cards do harness (Rules/SubAgents/MCPs) — todos usam o mesmo `useEffect` disparado só por `[project]`, nunca refeito ao fechar o respectivo modal.

Causa: `WorkspaceSidebar.tsx` buscava as 4 contagens (`rulesService.counts`, `skillsService.listForProject`, `subagentsService.counts`, `mcpsService.listForProject`) num único `useEffect` com dependência `[project]` — fechar `ProjectSkillsModal`/`ProjectRulesModal`/`ProjectSubagentsModal`/`ProjectMcpsModal` só chamava `setOpenModal(null)`, sem jamais reexecutar a busca.

Corrigido: lógica de busca extraída para `refreshHarnessCounts(projectId)` (via `useCallback`), chamada tanto no `useEffect` de montagem/troca de projeto quanto no `onClose` dos 4 modais. Confirmado ao vivo após o fix (HMR aplicado, sem restart do dev server): desmarcar a skill no modal e fechar atualizou o card pra "0 vinculados" **na mesma sessão, sem reselecionar o projeto**; remarcar e fechar voltou pra "1 vinculado" igualmente instantâneo. `tsc -b` limpo. Sem teste `*.test.ts` novo — `WorkspaceSidebar.tsx` é um componente `.tsx` sem lógica extraída pra `*.logic.ts` (não havia teste de componente antes do fix nesse arquivo, convenção do projeto: `.tsx` não é testado como componente, só `*.logic.ts` puro).

## Não exercitado neste smoke

- Conflito de nome ao criar/editar skill (`name` único global) — comportamento coberto por teste unitário do repositório, não forçado ao vivo.
- Limite prático de ~1 MiB de conteúdo — não testado com payload real desse tamanho.

## Screenshots

- `smoke/f05_skills_light.png` / `smoke/f05_skills_dark.png` — tela `#skills` com CRUD
- `smoke/f05_harness_linked.png` — Repo Harness com "Skills 1 vinculado" refletindo em tempo real

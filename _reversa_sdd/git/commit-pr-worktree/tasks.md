# commit-pr-worktree, Tarefas de Implementação

> Reimplementar createWorktree + fluxo commit/PR/push seguro.

## Pré-requisitos

- [ ] T-01/T-05 de `git/tasks.md` (worktree + repo-lock)
- [ ] Vault com vcsTokens (github/gitlab/bitbucket/azure)
- [ ] VCS provider tokens configurados

## Tarefas

- [ ] T-01, createWorktree path tmpdir/sistema-legado-worktrees/<threadId>
  - Origem no legado: `packages/server/src/git/worktree.ts`
  - Critério de pronto: path fixo; branch sistema-legado/<short>; reuse
  - Confiança: 🟢

- [ ] T-02, Recriação worktree pós-sumiço mantendo threadId
  - Origem no legado: `packages/server/src/git/worktree.ts`
  - Critério de pronto: dispatch não falha se dir ausente
  - Confiança: 🟢

- [ ] T-03, Commit no worktree sob withRepoLock
  - Origem no legado: `packages/server/src/git/pr.ts`, `exec.ts`
  - Critério de pronto: commit serializado; mensagem conforme rota
  - Confiança: 🟢

- [ ] T-04, assertHostAllowed + VcsHostAllowlist
  - Origem no legado: `packages/server/src/git/host-allowlist.ts`
  - Critério de pronto: host fora lista → throw antes de push
  - Confiança: 🟢

- [ ] T-05, Push autenticado efêmero com token vault
  - Origem no legado: `packages/server/src/git/pr.ts`, `providers/*`
  - Critério de pronto: push OK; token não persistido em remote URL
  - Confiança: 🟢

- [ ] T-06, openChangeRequest multi-provider
  - Origem no legado: `packages/server/src/git/pr.ts`, `vcs-registry.ts`, `providers/*`
  - Critério de pronto: PR URL retornada; thread pr-open
  - Confiança: 🟢

- [ ] T-07, Guard thread running em rotas git mutáveis
  - Origem no legado: rotas git (grep running guard)
  - Critério de pronto: commit/push/branch bloqueados em running
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, createWorktree + reuse
- [ ] TT-02, PR feliz com host allowlisted
- [ ] TT-03, Host bloqueado → erro pré-push
- [ ] TT-04, Thread running → commit rejeitado

## Tarefas de Migração de Dados (se aplicável)

- N/A

## Ordem Sugerida

1. T-01, T-02 (worktree)
2. T-04 (allowlist gate)
3. T-03, T-05, T-06 (commit + push + PR)
4. T-07 (running guard)

## Lacunas Pendentes (🔴)

- pr-merged/pr-closed automation

# git, Tarefas de Implementação

> Sequência para reimplementar infraestrutura Git do servidor.

## Pré-requisitos

- [ ] Git CLI ≥2.40 no PATH (child-worktrees)
- [ ] `@lioncode/shared` tipos diff/thread
- [ ] Vault com vcsTokens por provider
- [ ] tmpdir writable para worktrees

## Tarefas

- [ ] T-01, `createWorktree` path determinístico tmpdir/lioncode-worktrees/<threadId>
  - Origem no legado: `packages/server/src/git/worktree.ts`
  - Critério de pronto: branch lioncode/<short>; recriação pós-sumiço
  - Confiança: 🟢

- [ ] T-02, `captureReviewBaseline` + refs baselines/<id>/
  - Origem no legado: `packages/server/src/git/review-baseline.ts`, `tree-snapshot.ts`
  - Critério de pronto: baseline imutável capturada pré-turno
  - Confiança: 🟢

- [ ] T-03, `generateDiffs` / `generateDiffsBetweenRefs` + parse unified
  - Origem no legado: `packages/server/src/git/diff.ts`
  - Critério de pronto: paths relativos; sem ..; não absolutos
  - Confiança: 🟢

- [ ] T-04, `apply.ts` accept: dry-run, commit worktree, apply main, rollback
  - Origem no legado: `packages/server/src/git/apply.ts`
  - Critério de pronto: falha rollback; sucesso finalize
  - Confiança: 🟢

- [ ] T-05, `withRepoLock` fila Promise timeout 30s
  - Origem no legado: `packages/server/src/git/repo-lock.ts`
  - Critério de pronto: mutações serializadas; timeout erro
  - Confiança: 🟢

- [ ] T-06, `projectExecutionRegistry` lease 1 exec/repo
  - Origem no legado: `packages/server/src/git/project-execution.ts`
  - Critério de pronto: 409 thread_busy
  - Confiança: 🟢

- [ ] T-07, fork-refs GC + worktree-remove 2 camadas
  - Origem no legado: `packages/server/src/git/fork-refs.ts`, `worktree-remove.ts`
  - Critério de pronto: GC respeita thread viva, dir <60s
  - Confiança: 🟢

- [ ] T-08, VCS registry + host allowlist + pr.ts (ver commit-pr-worktree)
  - Origem no legado: `providers/*`, `host-allowlist.ts`, `pr.ts`
  - Critério de pronto: assertHostAllowed antes de push
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Worktree create + reuse mesmo threadId
- [ ] TT-02, Accept-diff feliz sob repo-lock
- [ ] TT-03, Reject bloqueado após divergência HEAD
- [ ] TT-04, Host não allowlisted → erro

## Tarefas de Migração de Dados (se aplicável)

- N/A (refs git criadas em runtime)

## Ordem Sugerida

1. T-01, T-05, T-06 (worktree + locks)
2. T-02, T-03, T-04 (review flow)
3. T-07, T-08 (GC + VCS)

## Lacunas Pendentes (🔴)

- pr-merged/pr-closed runtime triggers

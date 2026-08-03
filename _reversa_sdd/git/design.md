# git, Design Técnico

> Como o módulo Git do servidor é construído, com base no legado.

## Interface

### Worktree

| Símbolo | Assinatura | Retorno | Confiança |
|---------|------------|---------|-----------|
| `createWorktree` | `(repoPath, threadId, branch?)` | `WorktreeHandle` | 🟢 |
| `WorktreeHandle.path` | — | path em tmpdir | 🟢 |
| `WorktreeHandle.branch` | — | `lioncode/<short>` | 🟢 |

Path determinístico: `tmpdir/lioncode-worktrees/<threadId>` 🟢

### Review / Diff

| Símbolo | Papel | Confiança |
|---------|-------|-----------|
| `captureReviewBaseline` | index temp → write-tree → refs baselines/<id>/ | 🟢 |
| `generateDiffs` | worktree vs baseline | 🟢 |
| `generateDiffsBetweenRefs` | diff entre refs | 🟢 |
| `FileDiff` | file, additions, deletions, hunks | 🟢 |

### Lock / Lease

| Símbolo | Papel | Confiança |
|---------|-------|-----------|
| `withRepoLock` | mutex curto, timeout 30s | 🟢 |
| `acquireProjectLease` | execução longa, 1/repo | 🟢 |
| `ProjectExecutionLease` | token, ownerType, operation | 🟢 |

### VCS

| Símbolo | Papel | Confiança |
|---------|-------|-----------|
| `openChangeRequest` | commit → push → PR/MR | 🟢 |
| `assertHostAllowed` | bloqueia exfiltração token | 🟢 |
| `VcsHostAllowlist` | ReadonlySet hosts | 🟢 |

## Fluxo Principal (dispatch)

1. Lease de projeto adquirida 🟢
2. Modo `main`: cwd = repo vivo 🟢
3. Modo `worktree`: reusa path activo ou `createWorktree` 🟢
4. `captureReviewBaseline` antes do turno 🟢
5. Pós-turno: `generateDiffs` → diffs pending 🟢

## Fluxo Accept

1. Dry-run `git apply --check` 🟢
2. Commit interno no worktree 🟢
3. Apply no main sob `withRepoLock` 🟢
4. Rollback se falha; finalize refs 🟢

## Fluxo PR (resumo)

1. Resolve VCS provider (registry) 🟢
2. `assertHostAllowed(host)` 🟢
3. Commit sob repo-lock 🟢
4. Push autenticado efêmero 🟢
5. `openChangeRequest` 🟢

## Dependências

- `shared` — tipos diff, thread state 🟢
- `exec.ts` — wrapper git CLI 🟢
- DB — review-baselines repository 🟢
- `vault` — tokens VCS 🟢
- Consumido por `runner`, rotas git/PR/accept, `server.ts` (GC boot) 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Worktree persistente (não ephemeral por turno) | worktree.ts | 🟢 |
| Path determinístico = session resume | code-analysis git | 🟢 |
| Host allowlist sem override | host-allowlist.ts | 🟢 |
| GC conservador (60s, thread viva) | fork-refs/worktree-remove | 🟢 |
| Child-worktree pre-flight | child-worktree.ts | 🟢 |

## Estado Interno

| Estado | Onde | Notas |
|--------|------|-------|
| Worktree paths | filesystem tmpdir | map threadId→path |
| repo-lock queue | in-memory por repo | Promise chain |
| projectExecutionRegistry | in-memory | lease tokens |
| refs/lioncode/* | git refs | GC scheduled |

## Observabilidade

- Erros git via exec wrapper 🟢
- Sem métricas dedicadas 🟡

## Riscos e Lacunas

- 🟢 Estados `pr-merged`/`pr-closed` no enum/schema/UI: espelhar apenas; **sem** transição automática no server (validado humano: fora de escopo da reimplementação) [Revisão]
- 🟡 Política exacta GC em crash simultâneo multi-thread

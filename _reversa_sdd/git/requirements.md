# git

> Spec de requisitos do módulo Git do servidor (`packages/server/src/git`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Infraestrutura Git do sistema legado: worktrees persistentes por thread (`lioncode/<short>`), baselines de review, diffs, apply accept/reject, repo-lock, lease de execução longa, refs duráveis (`refs/lioncode/*`), child-worktrees efêmeros e PR/push multi-provider (GitHub/GitLab/Bitbucket/Azure) com allowlist de hosts. 🟢

## Responsabilidades

- Criar/reusar worktrees determinísticos em `tmpdir/lioncode-worktrees/<threadId>` 🟢
- Capturar review baselines imutáveis para accept/reject 🟢
- Gerar diffs worktree e entre refs 🟢
- Apply accept no main com dry-run, rollback, finalize 🟢
- Mutex curto (`repo-lock`) e lease longa (`projectExecutionRegistry`) 🟢
- Gerir refs `refs/lioncode/*` + GC 🟢
- Child-worktrees efêmeros + reconciliação pós-crash 🟢
- VCS providers + `assertHostAllowed` 🟢

## Regras de Negócio

- Worktree **não** removido ao fim do turno; só delete/GC 🟢
- GC não apaga thread viva, worktree ativo ou dir < 60s 🟢
- Reject bloqueado se HEAD/branch divergiu pós-turno 🟢
- Uma execução longa por repo (`409 thread_busy`) 🟢
- Paths de diff: relativos, sem `..`, não absolutos 🟢
- Git branch switch/create/commit bloqueados com thread `running` 🟢
- Token VCS nunca para host fora da allowlist 🟢
- Cwd estável do worktree = resume de sessão provider 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | createWorktree path determinístico + branch lioncode/<thread> | Must | cwd estável por threadId |
| RF-02 | captureReviewBaseline antes do turno | Must | refs sob baselines/<id>/ |
| RF-03 | generateDiffs / generateDiffsBetweenRefs → pending diffs | Must | paths relativos seguros |
| RF-04 | accept: dry-run --check → commit worktree → apply main sob repo-lock | Must | rollback em falha |
| RF-05 | reject: restore baseline se HEAD não divergiu | Must | bloqueio se divergiu |
| RF-06 | repo-lock: fila Promise não-reentrante, timeout 30s | Must | serializa mutações |
| RF-07 | projectExecutionLease: 1 exec longa/repo | Must | 409 se ocupado |
| RF-08 | VCS push/PR com assertHostAllowed | Must | host fora lista → erro |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Host allowlist sem override | `host-allowlist.ts` | 🟢 |
| Concorrência | repo-lock 30s timeout | `repo-lock.ts` | 🟢 |
| Durabilidade | Refs lioncode + GC (forks 24h, backups 30d) | `fork-refs.ts` | 🟢 |
| Disponibilidade | Child pre-flight Git≥2.40 + disco | `child-worktree.ts` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado thread em executionMode worktree
Quando dispatch resolve cwd
Então reusa worktree activo ou cria em tmpdir/lioncode-worktrees/<threadId>

Dado turno concluído com alterações
Quando generateDiffs corre
Então diffs pending com paths relativos sem ..

Dado utilizador accept-diff
Quando dry-run --check passa
Então commit interno no worktree e apply no main sob withRepoLock

Dado HEAD divergiu após turno
Quando utilizador tenta reject
Então operação bloqueada

Dado push para host não allowlisted
Quando assertHostAllowed corre
Então erro antes de enviar token
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-07 | Must | Execução isolada e review |
| RF-08 | Must | PR flow seguro |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/git/worktree.ts` | createWorktree, handle | 🟢 |
| `packages/server/src/git/diff.ts` | generateDiffs | 🟢 |
| `packages/server/src/git/review-baseline.ts` | captureReviewBaseline | 🟢 |
| `packages/server/src/git/apply.ts` | accept apply | 🟢 |
| `packages/server/src/git/repo-lock.ts` | withRepoLock | 🟢 |
| `packages/server/src/git/project-execution.ts` | lease | 🟢 |
| `packages/server/src/git/pr.ts` | openChangeRequest | 🟢 |
| `packages/server/src/git/host-allowlist.ts` | assertHostAllowed | 🟢 |

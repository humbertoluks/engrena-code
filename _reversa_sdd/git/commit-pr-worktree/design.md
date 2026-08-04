# commit-pr-worktree, Design Técnico

> Como worktree + commit + PR/push são construídos no legado.

## Interface

### createWorktree

| Parâmetro | Tipo | Papel | Confiança |
|-----------|------|-------|-----------|
| `repoPath` | string | repo principal | 🟢 |
| `threadId` | string | chave path | 🟢 |
| `branch?` | string | default sistema-legado/<short> | 🟢 |

Retorno `WorktreeHandle { path, repoPath, branch }` 🟢

### OpenPrParams

| Campo | Papel | Confiança |
|-------|-------|-----------|
| `repoPath` | repo principal | 🟢 |
| `branch` | branch do worktree | 🟢 |
| `files` | ficheiros incluídos | 🟢 |
| `snapshotRefs?` | refs baseline | 🟢 |
| `hostAllowlist` | VcsHostAllowlist | 🟢 |

### assertHostAllowed

| Entrada | Saída | Confiança |
|---------|-------|-----------|
| host string + allowlist | void ou throw | 🟢 |

## Fluxo Principal (PR)

1. Thread em `committed` ou equivalente pós-accept 🟢
2. Resolve worktree path (existente) 🟢
3. `withRepoLock(repoPath)` 🟢
4. Commit staged changes no worktree 🟢
5. Resolve remote URL → extrai host 🟢
6. `assertHostAllowed(host, allowlist)` 🟢
7. Obtém token vault (`vcsTokens.<provider>`) 🟢
8. Push autenticado efêmero (credencial não persiste em config) 🟢
9. Provider `openChangeRequest` → PR/MR URL 🟢
10. Thread → `pr-open`; emit state.change 🟢

## Fluxos Alternativos

- **Worktree sumiu:** recria path determinístico + branch 🟢
- **Host inválido:** erro antes de HTTP git 🟢
- **Thread running:** rotas git retornam erro 🟢
- **Provider desconhecido:** registry fallback ou erro 🟢
- **Push rejeitado:** erro propagado; thread state 🟡

## Dependências

- `vault` — vcsTokens 🟢
- `worktree.ts` — handle 🟢
- `repo-lock.ts` — serialização 🟢
- `vcs-provider.ts` / `providers/*` — API calls 🟢
- Rotas git-PR — HTTP entry 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| tmpdir path determinístico | worktree.ts | 🟢 |
| Allowlist sem override | host-allowlist.ts | 🟢 |
| Push efêmero (não git credential store) | pr.ts | 🟢 |
| Multi-provider via registry | vcs-registry.ts | 🟢 |

## Estado Interno

| Campo | Onde | Notas |
|-------|------|-------|
| worktree path | FS tmpdir | 1 por threadId |
| allowlist | config/vault payload | ReadonlySet |
| PR metadata | DB thread state | pr-open |

## Observabilidade

- Erros provider propagados ao cliente 🟢
- Token nunca em logs 🟢

## Riscos e Lacunas

- 🟢 `pr-merged`/`pr-closed`: espelhar enum/UI; sem trigger automático no server (validado: fora de escopo) [Revisão]
- 🟡 Matriz exacta providers × campos OpenPrParams

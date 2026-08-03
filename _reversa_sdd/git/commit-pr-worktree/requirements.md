# commit-pr-worktree

> Caso de uso do módulo `git`: worktree determinístico, commit e fluxo PR/push com host allowlist.  
> Escopo: createWorktree em tmpdir, commit interno, push autenticado, openChangeRequest — sem accept-diff genérico.

## Visão Geral

Garantir que threads em modo `worktree` tenham cwd estável em `tmpdir/lioncode-worktrees/<threadId>`, que commits e pushes para PR ocorram sob repo-lock com autenticação efêmera, e que `assertHostAllowed` bloqueie exfiltração de token para hosts não autorizados. 🟢

## Responsabilidades

- `createWorktree`: path fixo + branch `lioncode/<short>` 🟢
- Reutilizar worktree activo ou recriar pós-sumiço 🟢
- Commit interno no worktree antes de push 🟢
- `assertHostAllowed` antes de qualquer push 🟢
- Push autenticado efêmero (token vault, não persistido em URL) 🟢
- `openChangeRequest` multi-provider (GitHub/GitLab/Bitbucket/Azure) 🟢
- Operações bloqueadas com thread `running` 🟢

## Regras de Negócio

- Path determinístico: tmpdir/lioncode-worktrees/<threadId> 🟢
- Branch nomeada `lioncode/<short>` (derivada do thread) 🟢
- Worktree persiste entre turnos; não removido ao fim do turno 🟢
- Token VCS **nunca** enviado a host fora da allowlist 🟢
- Sem override da allowlist 🟢
- Git mutável (switch/create/commit/push) bloqueado em thread running 🟢
- Cwd estável habilita resume sessionCwd do provider 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | createWorktree em tmpdir com path por threadId | Must | cwd estável |
| RF-02 | Branch lioncode/<short> criada/reusada | Must | isolamento por thread |
| RF-03 | Commit no worktree sob repo-lock | Must | serializado |
| RF-04 | assertHostAllowed antes de push | Must | host inválido → erro |
| RF-05 | Push autenticado efêmero com token vault | Must | token não logado |
| RF-06 | openChangeRequest via provider registry | Must | PR/MR aberto |
| RF-07 | Bloquear git mutável se thread running | Must | 409 ou erro explícito |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Segurança | Host allowlist hard block | host-allowlist.ts | 🟢 |
| Segurança | Token efêmero, não em query | pr.ts | 🟢 |
| Concorrência | repo-lock em commit/push | repo-lock.ts | 🟢 |

## Critérios de Aceitação

```gherkin
Dado thread worktree sem worktree existente
Quando createWorktree é chamado
Então diretório criado em tmpdir/lioncode-worktrees/<threadId> com branch lioncode/<short>

Dado worktree existente para threadId
Quando dispatch resolve cwd
Então reusa path sem recriar desnecessariamente

Dado utilizador abre PR
Quando fluxo commit→push→openChangeRequest corre
Então assertHostAllowed valida host antes do push

Dado host github.com não na allowlist
Quando push tenta usar token
Então erro antes de rede; token não exfiltrado

Dado thread em running
Quando rota tenta commit ou push
Então operação bloqueada
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-07 | Must | PR flow isolado e seguro |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/git/worktree.ts` | createWorktree | 🟢 |
| `packages/server/src/git/pr.ts` | openChangeRequest, push flow | 🟢 |
| `packages/server/src/git/host-allowlist.ts` | assertHostAllowed | 🟢 |
| `packages/server/src/git/vcs-registry.ts` | provider resolution | 🟢 |
| `packages/server/src/git/providers/*` | GitHub/GitLab/Bitbucket/Azure | 🟢 |
| `packages/server/src/git/repo-lock.ts` | withRepoLock | 🟢 |

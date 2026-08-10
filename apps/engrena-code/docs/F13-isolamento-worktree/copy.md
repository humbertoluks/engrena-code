# Catálogo de copy: F13-isolamento-worktree

**Produto:** EngrenaCode  
**Fonte:** LionCodeLabs (`packages/renderer` — `ComposerControlsMenu.ExecutionModePill`, `TaskComposer`, `useTaskComposer`, `composerPrefs`, `DiffViewer`, `BranchSelector`)  
**Mapa de rename:** `LionCode → EngrenaCode`; `LionCodeLabs → EngrenaCode`; `lioncode → engrenacode`; `LionClaw → Design Lock` (se houver)  
**Última atualização:** 2026-08-06

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`{tela}.{slot}`  
Telas neste catálogo: `composer` (pill Execution / locks / erros), `diff` (reject worktree), `branch` (satélite), `thread` (badge TODO).

## Telas

### composer (`#principal` — região Execution / Worktree)

| Id | Texto | Notas |
|----|-------|-------|
| `composer.pill.execution.group` | Execution | EN — título do grupo (`PillGroup` label, `TaskComposer.tsx`) |
| `composer.pill.execution.main` | Main | EN — opção + label do trigger |
| `composer.pill.execution.worktree` | Worktree | EN — opção + label do trigger |
| `composer.error.network` | Não foi possível contatar o servidor local. | fonte |
| `composer.error.send` | Falha ao enviar a mensagem. | fonte — fallback genérico |
| `composer.error.worktree.gitRequired` | Inicialize o Git antes de usar Worktree. | PRD F13 Tratamento de Erros; texto vem literal do `error.message` do servidor (`worktree_git_required`), exibido no slot de erro genérico já existente (`TaskComposer.tsx` `sendError`) — sem string nova no client |
| `composer.error.worktree.createFailed` | Não foi possível criar o worktree: {motivo}. | idem, `worktree_create_failed` |

Ids removidos por não se aplicarem à implementação (pill = `PillGroup` toggle, sem popover/menu — ver Decisão em `spec.md` §3.3): `composer.pill.execution.aria`, `composer.pill.execution.menu.aria`, `composer.lock.queue`, `composer.lock.running`, `composer.lock.execution.single`, `composer.lock.execution.none` (bloqueio hoje é só `disabled` no `PillGroup`, sem `title` dedicado — paridade com Provider/Access existentes).

### diff

| Id | Texto | Notas |
|----|-------|-------|
| `diff.after.reject` | Mudanças rejeitadas. O worktree foi descartado e a thread não foi aprovada. | literal `DiffViewer.tsx`; sem rename de marca |

### branch (satélite WorkspaceSidebar)

| Id | Texto | Notas |
|----|-------|-------|
| `branch.placeholder.unknown` | sem branch | trigger quando mode worktree e fetch ainda não resolveu checkout principal |
| `branch.aria.current` | Branch atual: {name}. Trocar ou criar branch. | `{name}` ou `desconhecida` |

### thread

| Id | Texto | Notas |
|----|-------|-------|
| `thread.badge.worktree` | Worktree | PRD F13 Experiência: badge “Worktree” após criar; ausente na fonte, texto = label EN do pill Execution (paridade), implementado em `ProjectTree.tsx` |
| `thread.delete.worktree.retained` | Worktree retido com alterações locais; remova manualmente quando seguro. | contrato HTTP `spec.md` §5 (`warning`); sem superfície UI dedicada nesta feature — exibição fica para a UI de deletar thread (fora do escopo visual atual) |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{mode}` | label do modo atual (`Main` \| `Worktree`) |
| `{providerLabel}` | label do provider efetivo no composer |
| `{motivo}` | detalhe de falha de `git worktree` (PRD) |
| `{name}` | nome da branch atual ou `desconhecida` |

## Lacunas (resolvidas)

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `thread.badge.worktree` | PRD F13 Experiência pede badge “Worktree” na thread; não há JSX/string no renderer fonte | Resolvido — `ProjectTree.tsx`, texto `Worktree` |
| `composer.error.worktree.gitRequired` / `.createFailed` | PRD já fornece o texto literal; servidor devolve em `error.message`, client só exibe (sem string hardcoded nova) | Resolvido |
| `thread.delete.worktree.retained` | Spec Engrena define o texto do `warning` HTTP; UI de exibição não faz parte do escopo visual desta feature (endpoint DELETE ainda não tem tela dedicada) | Resolvido no contrato; UI *deferred* |

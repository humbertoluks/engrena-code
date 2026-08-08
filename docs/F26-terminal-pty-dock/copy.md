# Catálogo de copy: F26-terminal-pty-dock

**Produto:** EngrenaCode
**Fonte:** nenhuma (feature nativa) — extraído de `TerminalDock.tsx` (`COPY` local) e `TerminalPane.tsx` (`COPY` local)
**Última atualização:** 2026-08-07

Strings literais já em produção nos componentes. Este catálogo formaliza os ids para futura extração de um módulo central de copy, se/quando o padrão surgir no repo (hoje cada componente define seu próprio objeto `COPY` local — este arquivo não implica refactor).

## Convenção de ids

`terminal.{{slot}}`
Exemplos: `terminal.dock.title`, `terminal.pane.exitedTitle`.

## Telas

### terminal.dock (`TerminalDock.tsx`)

| Id | Texto | Notas |
|----|-------|-------|
| `terminal.dock.title` | Terminal | Botão de toggle do header |
| `terminal.dock.toggleAria` | Alternar terminal | `aria-label` do toggle |
| `terminal.dock.toggleTitle` | Terminal roda com os privilégios do seu sistema — sem sandbox adicional do EngrenaCode. Atalho: Ctrl+\` | `title` do toggle — cobre o requisito de aviso do PRD §6 e o hint do atalho; sem precedente na fonte LionCodeLabs (feature nunca teve esse aviso lá), decisão própria EngrenaCode |
| `terminal.dock.newTabCta` | + Nova aba | `disabled` sem `projectId` |
| `terminal.dock.closeTabAria` | Fechar aba | `aria-label` do `×` por aba |
| `terminal.dock.tabLabel` | Terminal {n} | `n` = posição 1-indexada na lista, não `tabId` |
| `terminal.dock.emptyState` | Nenhuma aba aberta. | Transitório — dock abre sempre com 1 aba criada automaticamente |
| `terminal.dock.noProject` | Selecione um projeto para abrir um terminal. | Corpo quando `projectId === null` |

### terminal.pane (`TerminalPane.tsx`)

| Id | Texto | Notas |
|----|-------|-------|
| `terminal.pane.connecting` | Abrindo sessão... | Estado `connecting` |
| `terminal.pane.errorTitle` | Não foi possível abrir o terminal | Estado `error` |
| `terminal.pane.errorDetail` | {errorMessage} | Mensagem vinda do erro IPC (`shell_not_found`, `project_not_found`, etc. — texto já traduzido no handler, não é o código) |
| `terminal.pane.exitedTitle` | Sessão encerrada | Estado `exited` |
| `terminal.pane.exitedDetail` | Processo encerrado (código {exitCode}). | |
| `terminal.pane.reopenCta` | Reabrir | `ButtonSecondary` no estado `exited` |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{n}` | Posição da aba na lista (1-indexada), não identificador estável |
| `{errorMessage}` | Mensagem de erro repassada pelo canal `terminal:create` |
| `{exitCode}` | `exitInfo.exitCode` do evento `terminal:exit` |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `terminal.pane.errorTitle` por código de erro | Hoje um único título genérico cobre `shell_not_found`/`project_not_found`/`thread_not_found`; separar por código é opcional | TODO design (baixa prioridade) |

Resolvidas nesta rodada: `terminal.dock.privilegeNotice` e `terminal.dock.shortcutHint` viraram `terminal.dock.toggleTitle` (ver tabela acima).

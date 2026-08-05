# Catálogo de copy: F08-registros

**Produto:** EngrenaCode  
**Fonte:** LionCodeLabs (`packages/renderer` — `RegistrosScreen`, `LogTable`)  
**Mapa de rename:** `LionCode → EngrenaCode`  
**Última atualização:** 2026-08-05

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`{tela}.{slot}`  
Telas neste catálogo: `registros` (`#registros`).

## Telas

### registros (`#registros`)

| Id | Texto | Notas |
|----|-------|-------|
| `registros.title` | Registros | h1 |
| `registros.subtitle` | Histórico persistido localmente (better-sqlite3) de tasks, tool calls e eventos de git flow por thread. | |
| `registros.filter.aria` | Filtrar registros por tipo | `aria-label` do group |
| `registros.filter.all` | Todos | chip |
| `registros.filter.task` | Tasks | chip |
| `registros.filter.tool` | Tool calls | chip |
| `registros.filter.git` | Git flow | chip |
| `registros.col.quando` | Quando | th |
| `registros.col.tipo` | Tipo | th |
| `registros.col.evento` | Evento | th |
| `registros.col.thread` | Thread | th |
| `registros.kind.task` | Task | badge de row |
| `registros.kind.tool` | Tool call | badge de row |
| `registros.kind.git` | Git flow | badge de row |
| `registros.empty.none` | Nenhum registro ainda | filtro Todos; **PRD** (fonte tinha frase longa) |
| `registros.empty.filtered` | Nenhum registro para este filtro | filtro ≠ Todos; **PRD** (fonte tinha frase longa) |
| `registros.cta.loadMore` | Carregar mais | |
| `registros.cta.loadingMore` | Carregando... | |
| `registros.cta.retry` | Tentar novamente | ErrorState; separado do corpo do erro |
| `registros.error.generic` | Não foi possível carregar os registros. | **PRD**; sem “Tente novamente.” no corpo |
| `registros.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. | rename aplicado |
| `registros.thread.open.aria` | Abrir thread {threadId} no workspace | a11y do link (gap fonte) |

### Nav / command palette (indireto)

| Id | Texto | Notas |
|----|-------|-------|
| `shell.nav.registros` | Registros | AppShell nav |
| `palette.action.abrir-registros` | Abrir Registros | CommandPalette |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{timestamp}` | `entry.timestamp` formatado `pt-BR` (dd/mm/aaaa, hh:mm:ss) |
| `{event}` | `entry.event` cru (sem paráfrase) |
| `{threadId}` | UUID / id da thread (mono; clicável no destino) |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `registros.error.vault_locked` | Copy dedicada para 423 (PRD: lista vazia / 423) | TODO — fonte usa mensagem genérica/`ApiError` |

### Observado na fonte (não usar no destino)

| Id fonte | Texto fonte | Motivo de descarte |
|----------|-------------|--------------------|
| `empty.none` (fonte) | Nenhum registro ainda. As tasks, tool calls e eventos de git flow aparecerão aqui conforme você usa o LionCode. | Destino = PRD curto |
| `empty.filtered` (fonte) | Nenhum registro corresponde a este filtro. Tente outro tipo ou volte para "Todos". | Destino = PRD curto |
| `error.generic` (fonte) | Não foi possível carregar os registros. Tente novamente. | Retry só no CTA |

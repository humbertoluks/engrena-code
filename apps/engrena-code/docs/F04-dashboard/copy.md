# Catálogo de copy: F04-dashboard

**Produto:** EngrenaCode  
**Fonte:** `src/renderer/screens/DashboardScreen.tsx` (`const COPY`) — as-built  
**Mapa de rename:** `LionCode → EngrenaCode`  
**Última atualização:** 2026-08-08

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`{tela}.{slot}`  
Telas neste catálogo: `dashboard` (`#dashboard`).

## Telas

### dashboard (`#dashboard`)

| Id | Texto | Notas |
|----|-------|-------|
| `dashboard.title` | Dashboard | h1 |
| `dashboard.cta.refresh` | Atualizar | secondary; loading reusa o mesmo texto + spinner |
| `dashboard.cta.completeSetup` | Completar configuração | banner + row inbox `setupIncomplete` |
| `dashboard.banner.setupIncomplete` | Configuração incompleta — conecte um provider e um token do GitHub para liberar todos os recursos. | corpo do banner |
| `dashboard.section.health` | Saúde da configuração | título do painel clicável |
| `dashboard.health.claude` | Claude | label na strip |
| `dashboard.health.clis` | CLIs | |
| `dashboard.health.github` | GitHub | |
| `dashboard.health.prompt` | prompt | minúsculo como no código/PRD |
| `dashboard.card.projects` | Projetos | MetricCard label |
| `dashboard.card.running` | Running | EN (estado de thread) |
| `dashboard.card.pendingDiffs` | Diffs pendentes | |
| `dashboard.card.errors` | Erros | |
| `dashboard.section.inbox` | Precisa da sua atenção | h2 inbox |
| `dashboard.empty.inbox` | Nada pendente… | ellipsis U+2026; também usado em recent vazio |
| `dashboard.empty.projects` | Adicione um projeto… | ellipsis U+2026 |
| `dashboard.cta.addProject` | Adicionar projeto | empty projetos → `#principal` |
| `dashboard.section.projects` | Projetos | h2 da grade |
| `dashboard.section.catalog` | Catálogo | h2 |
| `dashboard.catalog.skills` | Skills | link + contagem |
| `dashboard.catalog.rules` | Rules | |
| `dashboard.catalog.subagents` | SubAgents | |
| `dashboard.section.recent` | Atividade recente | h2 |
| `dashboard.kind.running` | running | badge inbox |
| `dashboard.kind.pendingDiff` | diff pendente | |
| `dashboard.kind.error` | erro | |
| `dashboard.kind.setupIncomplete` | setup incompleto | |
| `dashboard.error.generic` | Não foi possível carregar o dashboard. | |
| `dashboard.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. | |
| `dashboard.cta.retry` | Tentar novamente | ErrorState full-page |

### Nav / shell (indireto)

| Id | Texto | Notas |
|----|-------|-------|
| `shell.nav.dashboard` | Dashboard | `App.tsx` → `#dashboard` |
| `shell.nav.workspace` | Workspace | `App.tsx` → `#principal` |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{count}` | valor numérico de metric card ou catálogo |
| `{projectName}` | nome do projeto na inbox / grade / atividade |
| `{threadTitle}` | título da thread (fallback `threadId`) |
| `{provider}` | capitalizado por `providerLabel()` |
| `{state}` | `ThreadState` na atividade recente |
| `{relativeAge}` | `agora` (< 1 min) \| `{n}min atrás` (< 60 min) \| `{n}h atrás` (< 24 h) \| `{n}d atrás` (≥ 24 h) |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `dashboard.empty.recent` | Atividade recente vazia reusa `dashboard.empty.inbox` | aberto — ver `ui.md` Perguntas em aberto |
| `dashboard.subtitle` | Sem subtítulo no shipado | N/A — deliberado |
| `dashboard.cta.refresh.loading` | Sem string “Atualizando…” | N/A — deliberado |

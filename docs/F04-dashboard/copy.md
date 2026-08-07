# Catálogo de copy: F04-dashboard

**Produto:** EngrenaCode
**Fonte:** PRD EngrenaCode + código shipado (`src/renderer/screens/DashboardScreen.tsx`) — sem `DashboardScreen` no legado
**Mapa de rename:** `LionCode → EngrenaCode`
**Última atualização:** 2026-08-07 (recriado — closes `docs/AUDIT-PRD-S9-MIGRATION.md` §6/§8 "copy pendente"; a versão anterior deste arquivo, toda em `TODO`, foi removida em 2026-08-05 antes de a tela ir para código)

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto. Este catálogo documenta o texto **já shipado** em `DashboardScreen.tsx` (`const COPY`), sem nenhuma mudança de comportamento/layout nesta revisão — só fecha o registro que faltava.

## Convenção de ids

`{tela}.{slot}`
Telas neste catálogo: `dashboard` (`#dashboard`).

## Telas

### dashboard (`#dashboard`)

| Id | Texto | Notas |
|----|-------|-------|
| `dashboard.title` | Dashboard | h1 |
| `dashboard.cta.refresh` | Atualizar | secondary; reusado como `loadingLabel` implícito (ver Lacunas) |
| `dashboard.cta.completeSetup` | Completar configuração | → `#configuracao` |
| `dashboard.banner.setupIncomplete` | Configuração incompleta — conecte um provider e um token do GitHub para liberar todos os recursos. | corpo do banner quando `health.setupIncomplete` |
| `dashboard.section.health` | Saúde da configuração | título de seção |
| `dashboard.health.claude` | Claude | label na strip |
| `dashboard.health.clis` | CLIs | |
| `dashboard.health.github` | GitHub | |
| `dashboard.health.prompt` | prompt | minúsculo como no PRD |
| `dashboard.card.projects` | Projetos | MetricCard label |
| `dashboard.card.running` | Running | EN (estado de thread, consistente com o resto do app) |
| `dashboard.card.pendingDiffs` | Diffs pendentes | |
| `dashboard.card.errors` | Erros | |
| `dashboard.section.inbox` | Precisa da sua atenção | h2 inbox |
| `dashboard.empty.inbox` | Nada pendente… | ellipsis U+2026 |
| `dashboard.empty.projects` | Adicione um projeto… | ellipsis U+2026 |
| `dashboard.section.projects` | Projetos | h2 da grade de projetos |
| `dashboard.section.catalog` | Catálogo | h2 do resumo de catálogo |
| `dashboard.catalog.skills` | Skills | link + contagem |
| `dashboard.catalog.rules` | Rules | |
| `dashboard.catalog.subagents` | SubAgents | |
| `dashboard.section.recent` | Atividade recente | h2 últimas threads |
| `dashboard.kind.running` | running | badge inbox |
| `dashboard.kind.pendingDiff` | diff pendente | |
| `dashboard.kind.error` | erro | |
| `dashboard.kind.setupIncomplete` | setup incompleto | |
| `dashboard.error.generic` | Não foi possível carregar o dashboard. | erro de load sem detalhe de rede |
| `dashboard.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. | |
| `dashboard.cta.retry` | Tentar novamente | ErrorState |

### Nav / shell (indireto)

| Id | Texto | Notas |
|----|-------|-------|
| `shell.nav.dashboard` | Dashboard | `AppShell`/`App.tsx` → `#dashboard` |
| `shell.nav.workspace` | Workspace | `App.tsx` → `#principal` |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{count}` | valor numérico de metric card ou catálogo |
| `{projectName}` | nome do projeto na inbox / grade / atividade |
| `{threadTitle}` | título da thread (fallback `threadId` curto) |
| `{provider}` | `Claude` \| `Codex` \| `Kimi` \| `Minimax`, capitalizado por `providerLabel()` |
| `{relativeAge}` | `agora` (< 1 min) \| `{n}min atrás` (< 60 min) \| `{n}h atrás` (< 24 h) \| `{n}d atrás` (≥ 24 h) — função `relativeAge()` |

## Lacunas — resolvidas nesta revisão

Nenhum `TODO` restante. Os itens abaixo, listados como lacuna na versão original deste arquivo (removida em 2026-08-05), foram decididos junto com a implementação e não exigem string nova nem mudança de layout:

| Id necessário na versão original | Decisão |
|-----------------------------------|---------|
| `dashboard.subtitle` | **Sem subtítulo.** O h1 "Dashboard" é suficiente; PRD nunca fechou um subtítulo e nenhuma tela irmã (`#configuracao`, `#skills`, …) usa subtítulo sob o h1 — manter consistência |
| `dashboard.cta.refresh.loading` | **Sem string separada.** `ButtonSecondary` já mostra spinner + o próprio texto "Atualizar" (`loadingLabel` não é passado, cai no fallback `children`) — padrão reusado de outras telas, não precisa de string "Atualizando…" |
| `dashboard.banner.setupIncomplete` | Implementado — ver tabela acima |
| `dashboard.section.health` / `.projects` / `.catalog` / `.recent` | Implementados — ver tabela acima |
| `dashboard.error.generic` | Implementado — ver tabela acima |
| `shell.nav.workspace` | Implementado — ver tabela acima |
| Formato `{relativeAge}` | Implementado — ver Placeholders dinâmicos acima |

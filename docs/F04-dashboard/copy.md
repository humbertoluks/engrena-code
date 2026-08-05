# Catálogo de copy: F04-dashboard

**Produto:** EngrenaCode  
**Fonte:** PRD EngrenaCode + entrevista (Rodada 7); padrões LionCodeLabs (`packages/renderer`) — sem `DashboardScreen` no legado  
**Mapa de rename:** `LionCode → EngrenaCode`  
**Última atualização:** 2026-08-05

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`{tela}.{slot}`  
Telas neste catálogo: `dashboard` (`#dashboard`).

## Telas

### dashboard (`#dashboard`)

| Id | Texto | Notas |
|----|-------|-------|
| `dashboard.title` | Dashboard | h1 |
| `dashboard.subtitle` | | TODO — PRD não fecha |
| `dashboard.cta.refresh` | Atualizar | secondary |
| `dashboard.cta.refresh.loading` | | TODO — padrão irmão “Atualizando…” |
| `dashboard.cta.completeSetup` | Completar configuração | → `#configuracao` |
| `dashboard.banner.setupIncomplete` | | TODO — corpo do banner |
| `dashboard.section.health` | | TODO — “saúde da config” |
| `dashboard.health.claude` | Claude | label na strip |
| `dashboard.health.clis` | CLIs | |
| `dashboard.health.github` | GitHub | |
| `dashboard.health.prompt` | prompt | minúsculo como no PRD |
| `dashboard.card.projects` | Projetos | MetricCard label |
| `dashboard.card.running` | Running | EN (estado de thread) |
| `dashboard.card.pendingDiffs` | Diffs pendentes | |
| `dashboard.card.errors` | Erros | |
| `dashboard.section.inbox` | Precisa da sua atenção | h2 inbox |
| `dashboard.empty.inbox` | Nada pendente… | ellipsis U+2026 |
| `dashboard.empty.projects` | Adicione um projeto… | ellipsis U+2026 |
| `dashboard.section.projects` | | TODO — grade de projetos |
| `dashboard.section.catalog` | | TODO — resumo de catálogo |
| `dashboard.catalog.skills` | Skills | link + contagem |
| `dashboard.catalog.rules` | Rules | |
| `dashboard.catalog.subagents` | SubAgents | |
| `dashboard.section.recent` | | TODO — atividade recente / últimas 10 |
| `dashboard.kind.running` | running | badge inbox |
| `dashboard.kind.pendingDiff` | diff pendente | |
| `dashboard.kind.error` | erro | |
| `dashboard.kind.setupIncomplete` | setup incompleto | |
| `dashboard.error.generic` | | TODO |
| `dashboard.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. | rename aplicado |
| `dashboard.cta.retry` | Tentar novamente | ErrorState |

### Nav / shell (indireto)

| Id | Texto | Notas |
|----|-------|-------|
| `shell.nav.dashboard` | Dashboard | AppShell → `#dashboard` (delta vs legado `#principal`) |
| `shell.nav.workspace` | | TODO — label do item Workspace / `#principal` |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{count}` | valor numérico de metric card ou catálogo |
| `{projectName}` | nome do projeto na inbox / grade / atividade |
| `{threadTitle}` | título da thread (fallback id curto) |
| `{provider}` | `Claude` \| `Codex` \| `Kimi` |
| `{relativeAge}` | idade relativa do item (`TODO` formato) |
| `{skillsCount}` | contagem skills (globais e/ou vínculos — `TODO`) |
| `{rulesCount}` | contagem rules |
| `{subagentsCount}` | contagem subagents |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `dashboard.subtitle` | PRD/entrevista sem subtítulo | TODO |
| `dashboard.cta.refresh.loading` | só “Atualizar” no PRD | TODO |
| `dashboard.banner.setupIncomplete` | banner exigido; corpo não especificado | TODO |
| `dashboard.section.health` | título de seção não fechado | TODO |
| `dashboard.section.projects` | “grade de projetos” não é label UI | TODO |
| `dashboard.section.catalog` | “resumo leve do catálogo” não é label UI | TODO |
| `dashboard.section.recent` | “atividade recente” vs “últimas 10 threads” | TODO |
| `dashboard.error.generic` | sem string PRD | TODO |
| `shell.nav.workspace` | label do workspace após split Dashboard | TODO |
| Formato `{relativeAge}` | não especificado | TODO |

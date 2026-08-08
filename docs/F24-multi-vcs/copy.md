# Catálogo de copy: F24-multi-vcs

**Produto:** EngrenaCode  
**Fonte:** LionCodeLabs (`ConfiguracaoScreen` GitHub PAT; `McpOauthControls`; `threadVisuals.changeRequestLabels`) + PRD §6 F24 para títulos dos providers ausentes na UI fonte  
**Mapa de rename:** `LionCode → EngrenaCode`  
**Última atualização:** 2026-08-08

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`vcs.{{slot}}`

## Telas

### vcs.config (cards em `#configuracao`)

| Id | Texto | Notas |
|----|-------|-------|
| `vcs.github.title.pat` | Token do GitHub | Card PAT fonte |
| `vcs.github.title.oauth` | GitHub | Destino card OAuth |
| `vcs.github.subtitle.pat` | Personal access token usado pelo git flow ao abrir PRs (ou via CLI gh). | Fonte |
| `vcs.github.subtitle.oauth` | TODO | Fechar na spec técnica / design |
| `vcs.github.label.token` | Personal access token | |
| `vcs.github.placeholder.token` | ghp_… | |
| `vcs.github.helper.scopes` | Escopos necessarios: repo, workflow. | Ortografia “necessarios” da fonte |
| `vcs.github.cta.save` | Salvar token | |
| `vcs.github.cta.saving` | Salvando... | |
| `vcs.github.success` | Token salvo localmente (não validado com o GitHub). | |
| `vcs.gitlab.title` | GitLab | PRD / fixture |
| `vcs.bitbucket.title` | Bitbucket | PRD / fixture |
| `vcs.azure.title` | Azure DevOps | PRD / fixture |
| `vcs.oauth.cta.connect` | Conectar | `McpOauthControls` |
| `vcs.oauth.cta.connecting` | Conectando… | |
| `vcs.oauth.cta.disconnect` | Desconectar | |
| `vcs.oauth.cta.cancel` | Cancelar | |
| `vcs.oauth.cta.reconnect` | Reconectar | |
| `vcs.oauth.pending` | Aguardando autorização no browser… | |
| `vcs.oauth.openManual` | abrir manualmente | |
| `vcs.oauth.connected` | Conectado | |
| `vcs.oauth.needsReauth` | requer reconexão | |

### vcs.repo (painel Repositório / GitActions)

| Id | Texto | Notas |
|----|-------|-------|
| `vcs.cr.short.pr` | PR | |
| `vcs.cr.short.mr` | MR | `kind === 'gitlab'` |
| `vcs.cr.cta` | Abrir {short} | |
| `vcs.cr.opened` | {short} aberto com sucesso: | |
| `vcs.cr.reused` | {short} já existente reapresentado: | |
| `vcs.badge.github` | GitHub | TODO visual destino |
| `vcs.badge.gitlab` | GitLab | |
| `vcs.badge.bitbucket` | Bitbucket | |
| `vcs.badge.azure` | Azure DevOps | |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{short}` | `PR` ou `MR` |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `vcs.*.subtitle.oauth` | Fonte não tem cards OAuth VCS | TODO |
| `vcs.error.oauthFailed` | PRD: falha/cancelado sem token parcial | TODO |
| `vcs.error.tokenExpired` | PRD: apontar Configuração | TODO |
| `vcs.error.pushRejected` | Reusar stderr resumido F14 | TODO alinhar F14 |

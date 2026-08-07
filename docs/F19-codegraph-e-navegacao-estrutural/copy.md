# Catálogo de copy: F19-codegraph-e-navegacao-estrutural

**Produto:** EngrenaCode  
**Fonte:** LionCodeLabs (`CodegraphSection.tsx`, `CodegraphConsentDialog.tsx`, `codegraph.logic.ts`)  
**Mapa de rename:** `LionCode → EngrenaCode` (sem wordmark nestes slots)  
**Última atualização:** 2026-08-07

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`codegraph.{{slot}}`  
Exemplos: `codegraph.section.title`, `codegraph.badge.ready`, `codegraph.cta.generate`.

## Telas

### codegraph (seção `#principal` + consent)

| Id | Texto | Notas |
|----|-------|-------|
| `codegraph.section.title` | CodeGraph | Summary caps |
| `codegraph.badge.absent` | sem graph | Fonte |
| `codegraph.badge.building` | gerando… | Fonte; painel usa Indexando… |
| `codegraph.badge.building.percent` | gerando… {percent}% | |
| `codegraph.badge.ready` | pronto | Fonte |
| `codegraph.badge.stale` | desatualizado | |
| `codegraph.badge.error` | erro | |
| `codegraph.badge.indexed` | CodeGraph: indexado ({n}h atrás) | **Destino PRD Engrena** |
| `codegraph.badge.indexing` | CodeGraph: indexando… | **Destino PRD Engrena** |
| `codegraph.badge.unsupported` | CodeGraph: não suportado | **Destino PRD Engrena** |
| `codegraph.badge.title.absent` | CodeGraph ausente — clique para criar | tooltip |
| `codegraph.badge.title.building` | Indexação em andamento | |
| `codegraph.badge.title.ready` | CodeGraph pronto — o agente consulta o grafo de símbolos | |
| `codegraph.badge.title.stale` | Graph desatualizado em relação ao worktree — clique em Atualizar | |
| `codegraph.panel.loading` | Carregando status do graph… | |
| `codegraph.panel.indexing` | Indexando… | |
| `codegraph.cta.generate` | Gerar graph | |
| `codegraph.cta.generate.loading` | Iniciando build… | |
| `codegraph.cta.cancel` | Cancelar | |
| `codegraph.cta.cancel.loading` | Cancelando… | |
| `codegraph.cta.update` | Atualizar | |
| `codegraph.cta.update.loading` | Atualizando… | |
| `codegraph.cta.retry` | Tentar de novo | |
| `codegraph.cta.retry.loading` | Tentando… | |
| `codegraph.cta.reindex` | Reindexar | Destino Engrena (HTTP POST reindex) |
| `codegraph.cta.reindexIncomplete` | índice incompleto — reindexar | Fonte |
| `codegraph.stats.files` | Arquivos | |
| `codegraph.stats.symbols` | Símbolos | |
| `codegraph.stats.edges` | Relações | |
| `codegraph.stats.size` | Tamanho | |
| `codegraph.stats.indexed` | Indexado | |
| `codegraph.stats.pending` | Pendentes | |
| `codegraph.stats.unavailable` | Stats indisponíveis: {message} | |
| `codegraph.stats.emptyWhen` | — | placeholder data inválida |
| `codegraph.error.network` | Não foi possível contatar o servidor local. | |
| `codegraph.error.generic` | Falha na ação do CodeGraph. | |
| `codegraph.consent.title` | Criar graph do repositório? | Fonte; opcional Engrena |
| `codegraph.consent.body` | {projectName}: o agente passa a consultar o grafo de símbolos antes de varrer arquivos. | |
| `codegraph.consent.cta.create` | Criar agora | |
| `codegraph.consent.cta.create.loading` | Criando… | |
| `codegraph.consent.cta.later` | Agora não | |
| `codegraph.consent.cta.suppress` | Não perguntar de novo neste repo | Fonte / fora F19 Engrena |
| `codegraph.consent.cliDownload` | Inclui baixar a CLI codegraph automaticamente (~55 MB, uma vez só). | Fonte / fora F19 |
| `codegraph.hint.cliMissing.auto` | CLI codegraph não encontrada — será baixada e instalada automaticamente ao gerar o graph. | Fonte / fora F19 |
| `codegraph.cta.repair` | Reparar graph | Fonte / fora F19 |
| `codegraph.badge.cliInstalling` | instalando CLI… | Fonte / fora F19 |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{percent}` | Progresso 0–100 arredondado |
| `{n}` | Idade do índice em horas (PRD) |
| `{projectName}` | Nome do projeto na oferta |
| `{estimate}` | `~1 min` / `~1–2 min` / `~2–3 min` |
| `{fileCount}` | Contagem de arquivos indexáveis |
| `{message}` | Detalhe de erro/stats |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `codegraph.badge.indexed` vs `badge.ready` | PRD Engrena ≠ label fonte `pronto` — escolher no design | TODO design |
| Copy sem CLI para consent Engrena | Se consent for mantido sem download CLI | TODO design |
| Empty `unsupported` body | PRD não define texto de painel além do badge | TODO |

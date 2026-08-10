# Catálogo de copy: F11-consumo

**Produto:** EngrenaCode  
**Fonte:** sistema legado (`packages/renderer/src/screens/ConsumoScreen.tsx`)  
**Mapa de rename:** `legado → EngrenaCode`  
**Última atualização:** 2026-08-05

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`consumo.{slot}`  
Tela única: `#consumo`.

## Telas

### consumo

| Id | Texto | Notas |
|----|-------|-------|
| `consumo.title` | Consumo | |
| `consumo.subtitle` | Tokens, custos equivalentes e preços por projeto, thread e subagent. | |
| `consumo.period.aria` | Período do consumo | |
| `consumo.period.7d` | 7 dias | |
| `consumo.period.30d` | 30 dias | default |
| `consumo.period.all` | Tudo | |
| `consumo.summary.aria` | Resumo de consumo | |
| `consumo.card.subscription` | Assinatura (estimado) | billingMode `subscription` |
| `consumo.card.apiKey` | API key (equivalente) | billingMode `api-key` |
| `consumo.card.tokenPlan` | Token plan (equivalente API) | billingMode `token-plan` |
| `consumo.card.tokensInOut` | Tokens in / out | |
| `consumo.card.threads` | Threads | valor `{ativas} / {total}` |
| `consumo.card.threads.sr` | ativas / total | `sr-only` |
| `consumo.card.cacheRead` | Cache read | valor percentual |
| `consumo.section.projects` | Projetos | |
| `consumo.section.threads` | Threads · {projectName} | |
| `consumo.section.events` | Eventos · {threadTitle\|threadId} | preferir title; fallback id |
| `consumo.section.pricing` | Preços | |
| `consumo.section.pricing.hint` | Valores por milhão de tokens. Alterações recalculam somente eventos elegíveis sem custo. | |
| `consumo.col.projeto` | Projeto | |
| `consumo.col.custo` | Custo | |
| `consumo.col.tokens` | Tokens | |
| `consumo.col.threads` | Threads | |
| `consumo.col.cacheRead` | Cache read | |
| `consumo.col.ultimoEvento` | Último evento | |
| `consumo.col.thread` | Thread | |
| `consumo.col.providersModels` | Providers / modelos | |
| `consumo.col.shareSubagents` | Share subagents | |
| `consumo.col.quando` | Quando | |
| `consumo.col.turno` | Turno | |
| `consumo.col.origem` | Origem | |
| `consumo.col.providerModel` | Provider / modelo | |
| `consumo.col.billing` | Billing | |
| `consumo.col.cache` | Cache | |
| `consumo.col.fonteCusto` | Fonte custo | |
| `consumo.origem.agent` | agente | chip quando `source=agent` |
| `consumo.origem.subagent.fallback` | subagent | se `subagentName` vazio |
| `consumo.share.partial` | — / custo parcial | splits incompletos |
| `consumo.share.title` | Agente: {agentTokens} tokens; subagents: {subagentTokens} tokens. | tooltip |
| `consumo.flag.approxAgent` | ~ agente | |
| `consumo.flag.approxSubagent` | ~ subagent | |
| `consumo.flag.partialAgent` | ⚠ agente parcial | |
| `consumo.flag.partialSubagent` | ⚠ subagent parcial | |
| `consumo.cost.partialSuffix` | ⚠ parcial | sufixo após `—` ou `$…` |
| `consumo.cost.unavailableTitle` | Custo indisponível: não há preço para os eventos deste recorte. | title quando `costUsd == null` |
| `consumo.cost.partialTitle` | Soma parcial: há eventos sem preço. | title quando parcial com valor |
| `consumo.events.meta` | {loaded} de {total} eventos carregados | |
| `consumo.cta.loadMoreEvents` | Carregar mais eventos | |
| `consumo.cta.loadingMore` | Carregando… | ellipsis tipográfica `…` |
| `consumo.cta.retry` | Tentar novamente | |
| `consumo.cta.edit` | Editar | |
| `consumo.cta.cancel` | Cancelar | |
| `consumo.cta.savePrice` | Salvar preço | |
| `consumo.cta.saving` | Salvando… | |
| `consumo.loading.summary` | Carregando consumo… | |
| `consumo.loading.threads` | Carregando threads… | |
| `consumo.loading.events` | Carregando eventos… | |
| `consumo.loading.pricing` | Carregando preços… | |
| `consumo.empty.projects` | Nenhum projeto encontrado. | |
| `consumo.empty.threads` | Nenhuma thread com consumo neste período. | |
| `consumo.empty.events` | Nenhum evento de consumo nesta thread. | |
| `consumo.empty.pricing` | Nenhum preço configurado. | |
| `consumo.banner.unpriced` | Modelos observados sem preço | |
| `consumo.banner.unpriced.cta` | + {provider} / {model} | |
| `consumo.banner.allPriced` | Todos os modelos observados possuem preço. | |
| `consumo.pricing.badge.approx` | ~aprox. | |
| `consumo.pricing.row.rates` | in ${input} · out ${output} | |
| `consumo.label.inputPerMTok` | Entrada / MTok | |
| `consumo.label.outputPerMTok` | Saída / MTok | |
| `consumo.label.cacheReadPerMTok` | Cache read / MTok | |
| `consumo.label.cacheWritePerMTok` | Cache write / MTok | |
| `consumo.label.source` | Fonte | |
| `consumo.label.approximate` | Aproximado | checkbox |
| `consumo.error.generic` | Não foi possível carregar os dados. | PRD; ver lacuna vs `Error.message` |
| `consumo.error.pricing.requiredIO` | Preencha os preços de entrada e saída. | |
| `consumo.error.pricing.nonNegative` | Os preços devem ser números maiores ou iguais a zero. | |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{projectName}` | nome do projeto selecionado |
| `{threadTitle\|threadId}` | título da thread ou id se título vazio |
| `{agentTokens}` / `{subagentTokens}` | tokens compactados (`formatCompact`) no tooltip de share |
| `{loaded}` / `{total}` | eventos já carregados / total no período |
| `{provider}` / `{model}` | par observado sem preço ou row de pricing |
| `{input}` / `{output}` | USD por MTok na row de preço |
| `{ativas}` / `{total}` | `threadCount` / `threadTotal` no card Threads |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `consumo.error.generic` vs mensagem da API | Fonte mostra `Error.message` quando existe; PRD pede frase fixa | TODO decisão produto |
| `consumo.error.network` | Outras features têm “Verifique se o EngrenaCode está em execução.”; Consumo não tem string dedicada | TODO se unificar |
| `consumo.nav` | Label do item no AppShell (“Consumo”) | implícito = `consumo.title`; confirmar ícone |
| Cards cache write / total tokens | PRD lista totais extras; fonte não tem labels | N/A até decisão no `ui.md` |

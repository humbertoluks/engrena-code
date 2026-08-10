# Catálogo de copy: F23-providers-glm-grok

**Produto:** EngrenaCode  
**Fonte:** `ConfiguracaoScreen.tsx` (`COPY` + `ProviderKeyTestCard`) · `glm-driver.ts` / `grok-driver.ts` (`testConnection`) · `config-handler.ts` (`providers.*.reason`)  
**Mapa de rename:** N/A (fonte = destino)  
**Última atualização:** 2026-08-09

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`{tela}.{slot}`  
Telas: `glm`, `grok`, `composer` (indireto F03).

## Telas

### glm (card GLM em #configuracao)

| Id | Texto | Notas |
|----|-------|-------|
| `glm.title` | GLM | |
| `glm.subtitle` | Zhipu AI / BigModel — key salva no cofre local, sem CLI/assinatura. | |
| `glm.placeholder` | `<id>.<secret>` | quando não configurada |
| `glm.placeholder.masked` | •••••••••••••••• | quando configurada e draft vazio |
| `glm.badge.configured` | configurada | |
| `glm.badge.missing` | não configurada | |
| `glm.cta.save` | Salvar chave | |
| `glm.cta.save.loading` | Salvando... | |
| `glm.cta.test` | Testar conexão | |
| `glm.cta.test.loading` | Testando... | definido no COPY; ver lacuna |
| `glm.success.save` | Chaves salvas localmente (não validadas com o provider). | message do server / fallback |
| `glm.error.spaces` | A chave não pode conter espaços. | |
| `glm.error.short` | Chave muito curta para ser válida. | ≥8 |
| `glm.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. | |
| `glm.error.save` | Não foi possível salvar. Tente novamente. | |
| `glm.error.test` | Não foi possível testar a conexão agora. | catch client |
| `glm.verify.ok` | ✓ GLM respondeu — conectado (cobrando a API). | probe |
| `glm.verify.missing` | Nenhuma key do GLM salva. Salve uma key abaixo antes de testar. | |
| `glm.verify.auth` | Key do GLM inválida ou rejeitada pelo provider. | |
| `glm.verify.network` | Falha de rede ao testar a conexão com o GLM. Verifique sua internet e tente novamente. | |
| `glm.verify.generic` | Não foi possível testar a conexão com o GLM: {message} | |
| `glm.reveal` | Revelar GLM | |
| `glm.hide` | Ocultar GLM | |

### grok (card Grok em #configuracao)

| Id | Texto | Notas |
|----|-------|-------|
| `grok.title` | Grok | |
| `grok.subtitle` | xAI — key salva no cofre local, sem CLI/assinatura. | |
| `grok.placeholder` | xai-… | |
| `grok.placeholder.masked` | •••••••••••••••• | |
| `grok.badge.configured` | configurada | |
| `grok.badge.missing` | não configurada | |
| `grok.cta.save` | Salvar chave | |
| `grok.cta.save.loading` | Salvando... | |
| `grok.cta.test` | Testar conexão | |
| `grok.cta.test.loading` | Testando... | definido no COPY; ver lacuna |
| `grok.success.save` | Chaves salvas localmente (não validadas com o provider). | |
| `grok.error.spaces` | A chave não pode conter espaços. | |
| `grok.error.short` | Chave muito curta para ser válida. | |
| `grok.error.format` | Formato inválido. Esperado: xai-… | |
| `grok.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. | |
| `grok.error.save` | Não foi possível salvar. Tente novamente. | |
| `grok.error.test` | Não foi possível testar a conexão agora. | |
| `grok.verify.ok` | ✓ Grok respondeu — conectado (cobrando a API). | |
| `grok.verify.missing` | Nenhuma key do Grok salva. Salve uma key abaixo antes de testar. | |
| `grok.verify.auth` | Key do Grok inválida ou rejeitada pelo provider. | |
| `grok.verify.network` | Falha de rede ao testar a conexão com o Grok. Verifique sua internet e tente novamente. | |
| `grok.verify.generic` | Não foi possível testar a conexão com o Grok: {message} | |
| `grok.reveal` | Revelar Grok | |
| `grok.hide` | Ocultar Grok | |

### composer (indireto)

| Id | Texto | Notas |
|----|-------|-------|
| `composer.picker.glm` | GLM | `PROVIDER_LABEL` |
| `composer.picker.grok` | Grok | |
| `composer.providerUnavailable.title` | Provider indisponível | |
| `composer.glm.unavailable` | GLM sem key salva — configure em #configuracao. | `providers.glm.reason` |
| `composer.grok.unavailable` | Grok sem key salva — configure em #configuracao. | `providers.grok.reason` |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{message}` | mensagem interna do erro genérico do probe |
| `{label}` | título do card em reveal/hide (GLM / Grok) |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `glm.cta.test.loading` / `grok.cta.test.loading` | String existe no `COPY`, mas `ButtonSecondary` do teste não recebe `loadingLabel` | TODO (wire ou remover do COPY) |

# Plano de Implementação: F23. Providers GLM e Grok

**Pré-requisitos:**
- Herdar stack/tooling de `docs/_shared/codebase-patterns.md` (Electron/TS ESM, vault AES, drivers HTTP no padrão `minimax-driver.ts`, Vitest) — nenhuma ferramenta/biblioteca nova exigida
- Sem variáveis de ambiente novas; sem migração SQL (colunas `provider` já são `TEXT` livre)
- **Sem key real de GLM/Grok disponível nesta sessão** — toda a fase de código/testes usa mock HTTP; smoke E2E real fica pendente de credencial do usuário (ver spec 3.3)

### Fase 1: Vault, validação e tipos de provider

**1. Estender `ThreadProvider`** - Adicionar `'glm' | 'grok'` ao union em `threads.ts` e ao espelho em `threads-service.ts` (frontend); estender o array runtime `PROVIDERS` de `threads-handler.ts`.

**2. Validação de key** - Adicionar `validateGlmKey` (validador loose, mesmo nível de `validateMinimaxKey`) e `validateGrokKey` (prefixo `xai-`) em `provider-keys.ts`.

### Fase 2: Drivers HTTP

**3. `glm-driver.ts`** - Criar `runHttpTurn`/`testConnection` contra a BigModel Chat Completions API, espelhando a forma de `minimax-driver.ts`: `ProviderError` por código (`provider_key_missing`, `provider_auth_error`, `provider_network_error`, `provider_turn_error`), `setFetchForTesting`/`resetFetchForTesting` injetáveis.

**4. `grok-driver.ts`** - Mesma forma de `glm-driver.ts`, endpoint xAI/modelo/prefixo de key distintos.

**5. Roteamento e catálogo** - Estender `PROVIDER_KIND`/roteamento em `cli-driver.ts` (branch `http` para `glm`/`grok`), `PROVIDER_CATALOG` em `provider-catalog.ts` (`multimodal:false`, sem reasoning), `MCP_UNSUPPORTED_PROVIDERS` em `mcp-secrets.ts`, `resolveProviderApiKey`/`resolveBillingMode` em `provider-resolution.ts` (billing sempre `'api-key'`).

### Fase 3: Endpoints de Configuração

**6. Extensão de save/status** - Estender `handleKeysSave` (`config-handler.ts`) para aceitar `glm`/`grok` no corpo (merge/preserve, mesmo padrão dos 3 campos existentes) e `computeConfigStatus` para popular `keys.glm`/`keys.grok`/`providers.glm`/`providers.grok` (`available`/`reason`).

**7. Endpoints de teste de conexão** - Adicionar `handleGlmTest`/`handleGrokTest` chamando `glm-driver.testConnection`/`grok-driver.testConnection` sobre a key já persistida no vault; registrar `POST /api/config/glm/test` e `POST /api/config/grok/test` no router de `config-handler.ts`.

### Fase 4: UI de Configuração (contrato)

**8. Cliente HTTP e tipos do frontend** - Estender `configuracao-service.ts` (`ProviderKeyName`, `ConfigStatus`) e adicionar `testGlm()`/`testGrok()`; estender `PROVIDER_LABEL` em `ComposerModelControls.tsx` (`Record<ThreadProvider,string>` exaustivo).

**9. Cards `GlmCard`/`GrokCard`** - Criar os dois componentes standalone em `ConfiguracaoScreen.tsx` (campo de key com reveal via `Field.tsx`, botão salvar, botão "Testar conexão" com estado de loading/feedback), sem anatomia/copy final — pendente de `ui.md`/`copy.md`.

### Fase 5: Validação e fechamento

**10. Validação e fechamento** - Executar a estratégia de testes da spec (unitário com mock HTTP + integração dos endpoints). Confirmar os 4 critérios de aceitação de F23 (`docs/PRD.md` seção F23) e os critérios cross-feature (provider disponível no Workspace, usage_events agregando em Consumo). Registrar explicitamente: (a) smoke E2E contra endpoint real de GLM/Grok fica **pendente de credencial do usuário**, não bloqueante; (b) fase visual final dos dois cards fica bloqueada até `ui.md`/`copy.md` de F23 existirem. Gate: suite e build verdes.

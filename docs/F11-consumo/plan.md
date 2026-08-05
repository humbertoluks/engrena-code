# Plano de Implementação: F11. Consumo

**Pré-requisitos:**
- Stack herdada do codebase (Seção 3.1 de `spec.md`): `node:sqlite`, migrações registradas em `client.ts`, handler HTTP no padrão `guard`/`sendJson`/`sendError`, `--mcp-config` (mesmo mecanismo já usado por F09), vitest com `ENGRENACODE_USER_DATA` isolado.
- Nenhuma dependência nova — parsing de `usage`/custo e o handshake MCP interno usam só o que já está disponível (`node:child_process`, `node:http`, `node:sqlite`); nenhum SDK MCP é adicionado (spec §3.2).
- `docs/F11-consumo/ui.md` e `copy.md` já existem — fonte de verdade de UX/copy para a Fase de frontend.

### Fase 1: Schema e captura de usage/custo (sucesso e erro)

**1. Migração `usage_events` + `model_pricing`** - Criar `005_consumo.ts` com as duas tabelas, índices e constraints da spec §6, e registrar em `client.ts:MIGRATIONS`.

**2. Contrato de usage no resultado do turno, incluindo o caminho de erro** - Estender `ProviderTurnResult` e `ProviderError` (`provider-types.ts`) com `usage`/`costUsd` opcionais; extrair esses campos do evento `result` do `stream-json` em `cli-driver.ts` tanto no sucesso quanto no único `reject()` que tem acesso ao payload de erro (spec §3.2); extrair `usage` da resposta HTTP em `minimax-driver.ts`.

**3. Repositório `usage-events.ts`** - Implementar `createUsageEvent`, as agregações de leitura (summary/projects/detail/thread paginado) e `recalculateNullCosts`/`distinctUnpricedModels`, seguindo a spec §5/§6.

**4. Write path do agente em `dispatch.ts`** - Gerar `turnId` por `runTurn()`, implementar `resolveBillingMode(provider)` (mapeamento da spec §3.2) e gravar 1 `usage_event source='agent'` tanto quando o turno conclui com sucesso quanto quando falha com `usage` disponível no erro.

### Fase 2: Execução real de `call_subagent`

**5. MCP interno `engrenacode`** - Criar `subagent-mcp-server.ts` com o handshake stdio mínimo (`initialize`/`notifications/initialized`/`tools/list`/`tools/call`, newline-delimited JSON-RPC, spec §3.2) e o schema da ferramenta `call_subagent`; `tools/call` encaminha para o servidor de delegação loopback via HTTP.

**6. Servidor de delegação e execução do turno filho em `delegate.ts`** - Implementar `createDelegationServer` (loopback efêmero por turno, token aleatório) e `runDelegatedSubagentTurn` (gate via `canDelegateSubagent` → `startDelegatedRun` → `runCliTurnImpl` direto para o filho, sem diffs/lease/`--mcp-config` → watchdog reusando `checkIdleTimeout` em `setInterval` → `completeDelegatedRun` → `usage_event source='subagent'` → eventos `subagent.start`/`subagent.result`). Chamadas concorrentes no mesmo turno são serializadas (spec §3.2).

**7. Wiring em `dispatch.ts`** - Quando o projeto tem catálogo de subagents e o provider aceita `--mcp-config`, criar o servidor de delegação e injetar o MCP interno junto dos MCPs do projeto (F09) antes de `buildMcpConfigFile`; remover o branch morto `CALL_SUBAGENT_TOOL_NAME` do `onEvent` (o gate real agora vive no servidor de delegação); encerrar o servidor de delegação no `finally` do turno.

### Fase 3: Preços e API pública

**8. Repositório `pricing.ts`** - CRUD de `model_pricing` (create/update/list/find), unicidade `(provider, model)` com `pricing_conflict`, e o cálculo de custo por tabela usado tanto no turno (`cost_source='table'`) quanto em `recalculateNullCosts`.

**9. Handler `consumo-handler.ts`** - Implementar os 7 endpoints da spec §5 (métricas + preços) com guard 423/401, validação de `from`/`to`/`limit`/`offset`, e disparo de `recalculateNullCosts` após create/update de preço. Ligar o handler em `unlock-handler.ts`.

### Fase 4: Frontend

**10. `ConsumoScreen.tsx` + `consumo-service.ts`** - Implementar a tela `#consumo` seguindo anatomia, tokens, estados e ids de copy documentados em `docs/F11-consumo/ui.md`/`copy.md`; client HTTP tipado espelhando os 7 endpoints. Ligar rota `#consumo` em `App.tsx`.

### Fase 5: Validação e fechamento

**11. Validação e fechamento** - Rodar a estratégia de testes da spec (unitário + integração dos repositórios/handler/providers/dispatch/delegate/MCP interno, `pnpm test`) e o smoke/aceitação manual (spec §7.2: turno real gerando evento de agente, turno real disparando `call_subagent` de verdade com share subagent > 0, bloqueio de gate observável, drill-down, cadastro/edição de preço com congelamento, erro+retry). Confirmar todos os critérios de aceitação do PRD §9 para F11 sem nenhum item *deferred* (spec §7.3). Verificar light/dark e copy vs `ui.md`/`copy.md`. Gate: suíte de testes e `pnpm build`/`tsc -b` verdes.

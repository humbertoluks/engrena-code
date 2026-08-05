# Plano de Implementação: F08. Registros

**Pré-requisitos:**
- Stack herdada do codebase existente (F01–F07 feitas): `node:sqlite` `DatabaseSync`, migrations em `src/services/db/migrations/`, Vitest para testes, HTTP nativo (`http` + regex router) em `src/services/http/`
- Sem novas dependências/env vars/config

### Fase 1: Schema e Repositório

**1. Migração `log_entries`** - Criar `src/services/db/migrations/003_log_entries.ts` com a tabela e índices da spec §6, e registrá-la em `src/services/db/client.ts` junto às migrations existentes.

**2. Repositório `log-entries`** - Criar `src/services/db/repositories/log-entries.ts` com criação e listagem (filtro por `kind`, paginação `limit`/`offset`, ordenação `created_at DESC`) per spec §4/§5.

**3. Reconciliação de boot em `threads`** - Adicionar a `src/services/db/repositories/threads.ts` a função que reconcilia threads presas em `running` (per spec §3.2, decisão de escrita `kind='task'`).

### Fase 2: Endpoint e wiring de escrita automática

**4. Handler `GET /api/logs`** - Criar `src/services/http/logs-handler.ts` com o contrato da spec §5 (validação de `kind`/`limit`/`offset`, `guard()` de sessão/vault).

**5. Bootstrap e roteamento** - Em `src/services/http/unlock-handler.ts`, disparar a reconciliação de boot uma única vez (gravando `log_entries` `kind='task'` para cada thread recuperada) e registrar `handleLogsRequest` no roteamento existente.

**6. Log de tool call** - Em `src/services/runner/dispatch.ts`, gravar `log_entries` `kind='tool'` no branch `tool-result` de `runTurn`, usando o resultado de `updateToolCall` para compor o `event`.

**7. Log de git flow** - Em `src/services/http/git-handler.ts`, gravar `log_entries` `kind='git'` nos três handlers (commit, push, PR); PR também grava em falha (`GitError`), per spec §3.2.

**8. Log de accept/reject de diff** - Em `src/services/runner/apply-diff.ts`, gravar `log_entries` `kind='git'` ao final de `applyDiffAction`, um evento por ação (accept ou reject) sobre o subset processado.

### Fase 3: Frontend `#registros`

**9. Client HTTP** - Criar `src/renderer/services/logs-service.ts` seguindo o padrão de `dashboard-service.ts`, tipado conforme o contrato da spec §5.

**10. `LogTable` e `RegistrosScreen`** - Criar `src/renderer/components/LogTable.tsx` e `src/renderer/screens/RegistrosScreen.tsx` compondo a anatomia, tokens e estados de `docs/F08-registros/ui.md`, com todas as strings vindas de `docs/F08-registros/copy.md` (ids, não texto reinventado).

**11. Navegação thread id → workspace** - Ligar o clique/foco do thread id na tabela à navegação para a thread correspondente no Workspace (F03), resolvendo a rota per `ui.md` §Perguntas em aberto.

### Fase 4: Validação e fechamento

**12. Validação e fechamento** - Executar a estratégia de testes da spec §7.1 (unitário/integração: repositório, handler, wiring de dispatch/git/apply-diff/boot) e §7.2 (smoke manual, incluindo o cenário de restart e os 3 filtros de `kind`). Confirmar os critérios de aceitação do PRD §9 para F08 e os critérios de Integração Cross-Feature que referenciam F08. Verificar `RegistrosScreen`/`LogTable` em light/dark contra `docs/F08-registros/ui/registros-referencia.png`, anatomia vs `ui.md` e strings vs `copy.md`. Gate: `pnpm test` e `pnpm build` verdes.

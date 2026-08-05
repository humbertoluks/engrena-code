# Plano de Implementação: F04. Dashboard

**Pré-requisitos:**
- Stack herdada do codebase existente (Electron + Vite + React, `better-sqlite3` via `getDb()`, servidor HTTP único em `127.0.0.1:5174`, Vitest) — sem ferramentas novas
- F01.1, F02, F03 (core), F05, F06, F07 já implementados (ver `docs/PROGRESS.md`)
- Sem variáveis de ambiente ou arquivos de configuração novos

### Fase 1: Backend — agregação de dados

**1. Contagem global de diffs pendentes** - Adicionar em `diffs.ts` uma função que soma diffs `pending` em todas as threads (hoje só existe a versão por thread). Referenciar spec §5/§6 para o campo que ela alimenta.

**2. Extrair saúde de config reutilizável** - Refatorar `config-handler.ts` para expor a lógica de `GET /api/config/status` como função reaproveitável, mantendo o endpoint existente funcionando sem mudança de contrato. Referenciar spec §3.2 para o motivo do refactor.

**3. Repositório agregado do dashboard** - Criar `dashboard.ts` com as queries read-only de métricas, inbox classificada/ordenada e atividade recente, cruzando `projects`/`threads`/`diffs` conforme regras de precedência e ordenação da spec §3.2/§6.

### Fase 2: Backend — endpoint HTTP

**4. Handler `GET /api/dashboard`** - Criar o router do endpoint agregado seguindo o padrão de guarda (cofre travado / sessão inválida) já usado em `projects-handler.ts`, montando a resposta combinando saúde, métricas, inbox, projetos, catálogo e atividade recente conforme spec §5.

**5. Registrar a rota** - Ligar o novo handler ao servidor HTTP único em `unlock-handler.ts`, ao lado das demais rotas por prefixo de URL.

### Fase 3: Frontend — primitives e tela

**6. Primitive `MetricCard`** - Criar o componente compartilhado de card numérico (label + valor grande) descrito em `ui.md`, pensado para ser reaproveitado futuramente por F11 (Consumo).

**7. Primitive `Skeleton`** - Criar o bloco de loading reutilizável (`pulse` sobre `bg-surface-2`) usado nos estados `loading` da tela.

**8. Client HTTP do dashboard** - Criar `dashboard-service.ts` com a chamada ao endpoint agregado e os tipos de resposta, seguindo o padrão dos demais `*-service.ts` (base URL, header de sessão).

**9. Tela `DashboardScreen`** - Compor a anatomia completa de `ui.md` (cabeçalho, banner de setup, saúde, 4 metric cards, inbox, grade de projetos, resumo de catálogo, atividade recente) usando as strings de `copy.md` e os primitives existentes (`Card`, `Badge`, `StatusDot`, `ButtonPrimary`/`ButtonSecondary`, `InlineFeedback`, mais os dois novos primitives). Implementar fetch on-mount, refresh manual, poll de 30s pausado fora da rota/aba oculta, e a navegação por clique conforme o mapa de destino da spec/`ui.md`.

**10. Roteamento em `App.tsx`** - Trocar o placeholder estático da rota `#dashboard` pela tela real, mantendo o default pós-unlock já existente.

### Fase 4: Validação e fechamento

**11. Validação e fechamento** - Executar a estratégia de testes da spec (unitário/integração dos repositórios e handler, mais a regressão de `config-handler`) e a suíte completa (`pnpm test`, `pnpm build`). Rodar o checklist de smoke/aceitação manual da spec §7.2, incluindo os estados `loading`/`refreshing`/`error`/empties e o comportamento do poll de 30s. Conferir anatomia e tema (light/dark) contra `ui.md` e as strings renderizadas contra `copy.md`. Confirmar os critérios de aceitação de F04 na Seção 9 do PRD antes de fechar a feature.

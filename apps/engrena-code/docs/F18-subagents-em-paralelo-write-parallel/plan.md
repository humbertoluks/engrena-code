# Plano de Implementação: F18. Subagents em Paralelo (Write-Parallel)

**Pré-requisitos:**
- Herdar stack/tooling de `docs/_shared/codebase-patterns.md` e specs F13/F15 (Electron/TS ESM, SQLite, Vitest, MCP `engrenacode`, `delegate.ts`, `worktree.ts`)
- Nenhuma dependência npm nova
- Sem variáveis de ambiente novas
- `ui.md`/`copy.md` de F18 presentes (`docs/F18-subagents-em-paralelo-write-parallel/{ui,copy}.md`, 2026-08-08) — fase visual do DiffViewer/card/kind desbloqueada para implementação

### Fase 1: Schema e contratos de dados

**1. Migração write-parallel** - Adicionar `kind` em subagents, `parallel_batch_id` em subagent_runs, suporte a status `conflict` e metadados de candidatos no modelo de diffs. Usar o próximo índice de migração livre no momento da implementação.

**2. Repositórios** - Estender repositórios de subagents e diffs para persistir/ler os novos campos, com defaults compatíveis com rows existentes (`kind=dev`, batch null).

**3. CRUD HTTP de kind** - Propagar `kind` nos handlers/clientes de subagents sem quebrar o contrato F07.

### Fase 2: Runtime paralelo e worktrees filhos

**4. Extensão MCP `call_subagent`** - Aceitar `tasks[]` (1–4), rejeitar ambiguidade com name/task top-level e lotes acima do limite; manter o path serial F15 intacto.

**5. Worktree por filho paralelo** - Estender a criação de worktree para basear no cwd resolvido do pai e isolar cada `childThreadId`; em falha de criação, marcar só aquele item e seguir com os demais.

**6. Spawn paralelo no delegate** - Com batch, disparar até 4 runs em paralelo reusando gate, idle, hard-cap e `usage_events` por filho; correlacionar com `parallel_batch_id`; emitir WS com dados suficientes para progresso agregado.

### Fase 3: Merge, conflito e revisão no pai

**7. Merge por union de path** - Após o batch, agregar alterações dos worktrees filhos na thread do pai: paths exclusivos como `pending`, paths colidentes como `conflict` com candidatos.

**8. Resolução de conflito e apply** - Endpoint/ação para escolher o vencedor por path; bloquear accept/reject enquanto `conflict`; após promover a `pending`, o fluxo F03 de apply continua válido no cwd do pai.

**9. Cleanup de worktrees filhos** - Remover ou reter worktrees dos filhos com a mesma política segura de F13, sem tocar `project.path`.

### Fase 4: Contratos de UI (sem anatomia final)

**10. History e tipagem renderer** - Expor `parallelBatchId`/`kind`/diffs `conflict` nos serviços e tipos do frontend para o card e o DiffViewer consumirem quando o design existir.

**11. Hooks mínimos de estado** - Garantir que accept/reject e a ação de escolher vencedor respeitam o contrato mesmo com UI provisória (sem inventar copy/anatomia).

### Fase 5: Validação e fechamento

**12. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração + smoke). Confirmar os 4 ACs de F18 e o critério cross-feature de paralelismo com gate/idle/usage/worktree. Fase visual: aplicar `ui.md`/`copy.md` (campo Tipo, agregado no card, seção Conflitos + Usar este). Gate: suite e build verdes + aceite visual do ui.md.

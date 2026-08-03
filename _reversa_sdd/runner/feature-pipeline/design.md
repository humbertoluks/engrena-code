# feature-pipeline, Design Técnico

> Como o motor `/featdevelop` é construído no legado.

## Interface

### Entrada do motor

| Campo | Tipo | Papel | Confiança |
|-------|------|-------|-----------|
| `ctx` | DispatchContext | deps | 🟢 |
| `pipeline` | FeaturePipeline row | estado DB | 🟢 |
| `slug` | string | pasta docs/features/<slug>/ | 🟢 |
| `repoPath` | string | cwd worktree/main | 🟢 |

### Fases (`FEATURE_PIPELINE_PHASES`)

Ordem fixa: `prd → prd-gate → tech → spec → spec-validation → sprints → sprint-validation` 🟢

### `TransitionTarget`

| Campo | Papel | Confiança |
|-------|-------|-----------|
| `globalStatus?` | FeaturePipelineStatus | 🟢 |
| `phase?` | fase corrente | 🟢 |
| `phaseStatus?` | status da fase | 🟢 |

## Fluxo Principal

1. `dispatch.ts` identifica command strategy `feature-pipeline` → chama motor 🟢
2. Motor valida ≤1 ativo (thread + project) 🟢
3. Loop por fase:
   - `transition({ phase, phaseStatus: running })` 🟢
   - Invoca driver com prompt de fase 🟢
   - Escreve artefato em `docs/features/<slug>/` 🟢
   - `transition({ phaseStatus: done })` → próxima fase 🟢
4. Gates: `awaiting-approval` pausa até approve 🟢
5. Terminal: `done` ou `cancelled` 🟢
6. Erro operacional: `error` (retomável) 🟢

## Fluxos Alternativos

- **interrupt:** global → `interrupted`; retoma explicitamente 🟢
- **pending_resume:** flag + scheduler onIdle retoma após thread idle 🟢
- **cancel:** de running/awaiting/interrupted/error → `cancelled` 🟢
- **Build conflict:** build na mesma thread bloqueado se pipeline ativo 🟢
- **Review pinado:** filtra paths `docs/features/<slug>/` do diff pending 🟢

## Dependências

- `shared/feature-pipeline.ts` — fases e enums 🟢
- `repositories/feature-pipelines.ts` — transition atômica 🟢
- `runner/dispatch.ts` — entry point 🟢
- FS repo — artefatos 🟢
- WS — state.change pós-transition 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Fases no código, não no LLM | FEATURE_PIPELINE_PHASES | 🟢 |
| Artefatos no repo, não DB | domain R14 | 🟢 |
| ≤1 ativo (partial indexes) | migration 047 | 🟢 |
| Mensagens sintéticas campo dedicado | message.ts | 🟢 |

## Estado Interno

| Entidade | Persistência | Notas |
|----------|--------------|-------|
| FeaturePipeline row | SQLite | global status + fase corrente |
| Artefatos | repo filesystem | docs/features/<slug>/ |
| pending_resume | flag DB/in-memory | scheduler onIdle 🟡 |

## Observabilidade

- WS state.change após cada transition 🟢
- Mensagens sintéticas distinguíveis na UI 🟢

## Riscos e Lacunas

- 🔴 Diagrama fino gates adversarial (PipelineDecision partition)
- 🟡 Detalhe exacto pending_resume + onIdle coordination

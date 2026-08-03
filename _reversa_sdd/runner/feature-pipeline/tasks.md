# feature-pipeline, Tarefas de Implementação

> Reimplementar motor `/featdevelop` (feature-pipeline-motor).

## Pré-requisitos

- [ ] `shared/src/feature-pipeline.ts` com fases e enums
- [ ] Repository `feature-pipelines` com transition atômica
- [ ] dispatch.ts capaz de despachar motores
- [ ] Índices parciais ≤1 ativo (migration 047)

## Tarefas

- [ ] T-01, Implementar entry no dispatch para strategy feature-pipeline
  - Origem no legado: `packages/server/src/runner/dispatch.ts` (branch motor)
  - Critério de pronto: /featdevelop invoca feature-pipeline-motor
  - Confiança: 🟢

- [ ] T-02, Validar ≤1 pipeline ativo por thread e projeto
  - Origem no legado: `feature-pipeline-motor.ts` + migration 047
  - Critério de pronto: segundo start rejeitado
  - Confiança: 🟢

- [ ] T-03, Loop de fases FEATURE_PIPELINE_PHASES com transitions
  - Origem no legado: `packages/server/src/runner/feature-pipeline-motor.ts`
  - Critério de pronto: ordem prd→…→sprint-validation; phaseStatus correto
  - Confiança: 🟢

- [ ] T-04, Escrita de artefatos em docs/features/<slug>/
  - Origem no legado: `feature-pipeline-motor.ts` (IO repo)
  - Critério de pronto: ficheiros no repo; ausentes do SQLite
  - Confiança: 🟢

- [ ] T-05, Gates awaiting-approval, interrupt/resume, cancel, error
  - Origem no legado: motor + `repositories/feature-pipelines.ts`
  - Critério de pronto: transições conforme state-machines.md §2
  - Confiança: 🟢

- [ ] T-06, pending_resume + pipeline-scheduler onIdle
  - Origem no legado: `packages/server/src/runner/pipeline-scheduler.ts` + bootstrap em `server.ts`; rotas `pipeline-approve` / `pipeline-resume`
  - Critério de pronto: `schedulePipelineContinuation` retoma após thread idle quando flag set
  - Confiança: 🟢

- [ ] T-07, Review pinado: filtrar metadados slug do diff pending
  - Origem no legado: `dispatch.ts` (review pinado)
  - Critério de pronto: paths docs/features/<slug>/ excluídos do diff UI
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Pipeline feliz até done
- [ ] TT-02, Segundo pipeline mesmo projeto → rejeitado
- [ ] TT-03, awaiting-approval → approve → running
- [ ] TT-04, Artefato escrito no repo

## Tarefas de Migração de Dados (se aplicável)

- [ ] Migration 047 partial indexes se ausentes

## Ordem Sugerida

1. T-01, T-02 (entry + invariante)
2. T-03, T-04 (loop + artefatos)
3. T-05, T-06, T-07 (gates + retomada + review)

## Lacunas Pendentes (🔴)

- PipelineDecision adversarial partition no reducer

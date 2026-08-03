# feature-build, Tarefas de Implementação

> Reimplementar motor `/featbuild` + journal write-ahead.

## Pré-requisitos

- [ ] `shared/src/feature-build.ts` com FEATURE_BUILD_STATUS_TRANSITIONS
- [ ] `runner/build-state.ts` journal primitives
- [ ] Repository feature-builds
- [ ] Review baseline em `git/review-baseline.ts`

## Tarefas

- [ ] T-01, Entry dispatch strategy feature-build + guard pipeline ativo
  - Origem no legado: `packages/server/src/runner/dispatch.ts`
  - Critério de pronto: /featbuild bloqueado se pipeline ativo
  - Confiança: 🟢

- [ ] T-02, Implementar journal write-ahead (prepared→running→completed)
  - Origem no legado: `packages/server/src/runner/build-state.ts`
  - Critério de pronto: estados persistidos; recovery dangling funciona
  - Confiança: 🟢

- [ ] T-03, Motor como escritor único de build-state.json
  - Origem no legado: `packages/server/src/runner/feature-build-motor.ts`
  - Critério de pronto: nenhum outro módulo escreve build-state
  - Confiança: 🟢

- [ ] T-04, Loop de sprints com transições guardadas
  - Origem no legado: `feature-build-motor.ts` + `shared/feature-build.ts`
  - Critério de pronto: illegal transitions rejected; done não regride
  - Confiança: 🟢

- [ ] T-05, Distinção failed vs error na agregação
  - Origem no legado: `feature-build-motor.ts` (ADR-19)
  - Critério de pronto: failed funcional; error operacional
  - Confiança: 🟢

- [ ] T-06, Retomar interrupted/error/failed → running
  - Origem no legado: motor + rotas build
  - Critério de pronto: ação Retomar explícita
  - Confiança: 🟢

- [ ] T-07, Review reject restaura baseline código
  - Origem no legado: motor + `git/review-baseline.ts`
  - Critério de pronto: código revertido; metadados build preservados
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Build feliz → done + journal completed
- [ ] TT-02, Sprint failed → build failed (não error)
- [ ] TT-03, Crash recovery journal running dangling
- [ ] TT-04, Pipeline ativo → build rejeitado

## Tarefas de Migração de Dados (se aplicável)

- N/A (build-state.json criado pelo motor)

## Ordem Sugerida

1. T-02 (journal)
2. T-01, T-03 (entry + escritor único)
3. T-04, T-05 (sprints + failed/error)
4. T-06, T-07 (retomada + review)

## Lacunas Pendentes (🔴)

- ADRs numerados como ficheiros no repo

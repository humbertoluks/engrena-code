# shared, Tarefas de Implementação

> Reimplementar o catálogo de contratos tipados `@sistema-legado/shared`.

## Pré-requisitos

- [ ] Workspace TypeScript (pnpm) com path/`exports` para `@sistema-legado/shared`
- [ ] Consumidores server/renderer prontos a apontar para o pacote

## Tarefas

- [ ] T-01, Definir `thread.ts`: PROVIDERS, states, access, execution, `isProvider`
  - Origem no legado: `shared/src/thread.ts`
  - Critério de pronto: unions e arrays exportados; `isProvider` cobre o catálogo
  - Confiança: 🟢

- [ ] T-02, Catálogo de modelos e helpers (`PROVIDER_MODELS`, `findModelById`)
  - Origem no legado: `shared/src/models.ts`
  - Critério de pronto: lookup por id funciona para modelos listados
  - Confiança: 🟢

- [ ] T-03, Validação de dispatch (limites + parsers)
  - Origem no legado: `shared/src/dispatch-validation.ts`
  - Critério de pronto: body inválido rejeitado; seleção efetiva validada
  - Confiança: 🟢

- [ ] T-04, Contratos Feature Pipeline + Feature Build (`canTransition*`)
  - Origem no legado: `shared/src/feature-pipeline.ts`, `feature-build.ts`
  - Critério de pronto: fases/estados e transições alinhados ao legado
  - Confiança: 🟢

- [ ] T-05, Tipos de stream, API DTOs, métricas, vault/mcp/skills/rules/subagents
  - Origem no legado: `shared/src/stream-event.ts`, `api.ts`, demais módulos
  - Critério de pronto: server/renderer compilam contra os tipos
  - Confiança: 🟢

- [ ] T-06, Barrel `index.ts` reexportando a superfície pública
  - Origem no legado: `shared/src/index.ts`
  - Critério de pronto: imports documentados no legado resolvem
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, `isProvider` happy/fail
- [ ] TT-02, `parseDispatchTaskRequest` com payload limite excedido
- [ ] TT-03, Matriz `canTransitionFeatureBuild` (legal vs ilegal)
- [ ] TT-04, Smoke: server + renderer typecheck contra shared

## Tarefas de Migração de Dados (se aplicável)

- N/A (sem persistência)

## Ordem Sugerida

1. T-01, T-02 (núcleo thread/modelos)
2. T-03, T-04 (validação + máquinas)
3. T-05, T-06 (restante + barrel)

## Lacunas Pendentes (🔴)

- OpenAPI formal omitido no nível essencial
- Auditoria 1:1 de cada export vs uso no server/renderer

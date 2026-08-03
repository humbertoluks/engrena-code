# feature-build

> Caso de uso do módulo `runner`: motor `/featbuild` (Feature Build).  
> Escopo: sprints, build-state journal write-ahead, motor como escritor único, failed≠error.

## Visão Geral

Executar o comando `/featbuild` via `feature-build-motor`: percorrer sprints definidos, manter `build-state.json` como journal write-ahead no repositório, garantir que apenas o motor escreve estado de build, e distinguir `failed` (funcional) de `error` (operacional). 🟢

## Responsabilidades

- Despachar motor quando strategy = `feature-build` 🟢
- Escrever/atualizar `build-state.json` (journal write-ahead) 🟢
- Transições guardadas via `canTransitionFeatureBuild` / sprint 🟢
- Executar sprints: pending → in-progress → done/failed/aborted 🟢
- Review final por sprint: pending/accepted/rejected 🟢
- Retomada explícita (não via scheduler onIdle como pipeline) 🟢
- Bloquear se pipeline ativo na mesma thread 🟢

## Regras de Negócio

- Build na mesma thread exige ausência de pipeline ativo 🟢
- `failed` ≠ `error`: failed = ≥1 sprint failed/blocked; error = falha operacional do motor 🟢
- Transições normativas em `FEATURE_BUILD_STATUS_TRANSITIONS` 🟢
- `cancelled` é legado read-only; fluxos novos não transitam para ele 🟢
- Motor é **escritor único** de build-state 🟢
- Journal: estados `prepared→running→completed`; recovery de dangling 🟢
- Reject review restaura código ao baseline; metadados build fora da restauração 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | Iniciar build só sem pipeline ativo na thread | Must | conflito rejeitado |
| RF-02 | Motor único escritor de build-state.json | Must | sem writers concorrentes |
| RF-03 | Journal write-ahead prepared→running→completed | Must | recovery dangling |
| RF-04 | Transições conforme FEATURE_BUILD_STATUS_TRANSITIONS | Must | illegal transitions blocked |
| RF-05 | Sprint lifecycle pending→in-progress→terminal | Must | done/failed/aborted |
| RF-06 | Distinção failed (funcional) vs error (operacional) | Must | ADR-19 semantics |
| RF-07 | Retomar de interrupted/error/failed → running | Should | ação explícita Retomar |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Durabilidade | Write-ahead journal | `build-state.ts` | 🟢 |
| Consistência | Motor escritor único | feature-build-motor | 🟢 |
| Recuperação | Dangling journal recovery | build-state.ts | 🟢 |

## Critérios de Aceitação

```gherkin
Dado pipeline ativo na thread
Quando /featbuild tenta iniciar
Então operação rejeitada

Dado build iniciando
Quando motor prepara journal
Então build-state.json transita prepared→running antes de side-effects

Dado sprint in-progress com falha funcional
Quando critérios de done não atendidos
Então sprint failed e build global pode ir para failed (não error)

Dado crash mid-build com journal running dangling
Quando recovery executa
Então estado reconciliado conforme build-state.ts

Dado review rejected num sprint
Quando usuário rejeita
Então código restaurado ao baseline; metadados build preservados
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-06 | Must | Core /featbuild |
| RF-07 | Should | UX retomada |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/runner/feature-build-motor.ts` | motor build | 🟢 |
| `packages/server/src/runner/build-state.ts` | journal write-ahead | 🟢 |
| `packages/shared/src/feature-build.ts` | transitions, enums | 🟢 |
| `packages/server/src/runner/dispatch.ts` | despacho + conflito pipeline | 🟢 |

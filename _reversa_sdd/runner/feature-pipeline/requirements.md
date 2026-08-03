# feature-pipeline

> Caso de uso do módulo `runner`: motor `/featdevelop` (Feature Pipeline).  
> Escopo: fases imutáveis no código, artefatos em `docs/features/<slug>/`, ≤1 pipeline ativo por thread+projeto.

## Visão Geral

Executar o comando `/featdevelop` via `feature-pipeline-motor`: percorrer fases fixas (`prd → prd-gate → tech → spec → spec-validation → sprints → sprint-validation`), persistir estado no DB, escrever artefatos no repositório (nunca no SQLite) e respeitar invariante de no máximo um pipeline ativo por thread e por projeto. 🟢

## Responsabilidades

- Despachar motor quando strategy = `feature-pipeline` 🟢
- Percorrer `FEATURE_PIPELINE_PHASES` na ordem do código 🟢
- Transições atômicas via `FeaturePipelinesRepository.transition` 🟢
- Escrever artefatos em `docs/features/<slug>/` 🟢
- Gates humanos (`awaiting-approval`) e retomada (`interrupted`/`error`) 🟢
- Mensagens sintéticas via campo dedicado (não prefix matching) 🟢
- Scheduler `onIdle` para `pending_resume` 🟢

## Regras de Negócio

- Fases são **imutáveis e ordenadas no código** (não no modelo) 🟢
- ≤1 pipeline ativo por thread **e** por projeto (índices parciais migration 047) 🟢
- Artefatos ficam no **repo** (`docs/features/<slug>/`), nunca no DB 🟢
- Build na mesma thread exige ausência de pipeline ativo 🟢
- Status global: `running | awaiting-approval | interrupted | error | done | cancelled` 🟢
- Status por fase: `pending | running | done | error | interrupted` 🟢
- Transições persistir → emitir WS (atômicas) 🟢
- Partição PipelineDecision adversarial 🟡

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | Iniciar pipeline só se ≤1 ativo thread+projeto | Must | conflito rejeitado |
| RF-02 | Executar fases na ordem FEATURE_PIPELINE_PHASES | Must | ordem fixa no código |
| RF-03 | Persistir transições via repository.transition | Must | DB + WS atômicos |
| RF-04 | Escrever artefatos em docs/features/<slug>/ | Must | ficheiros no repo |
| RF-05 | Suportar awaiting-approval, interrupt, resume, cancel | Must | estados conforme enum |
| RF-06 | pending_resume retomado via scheduler onIdle | Should | retoma após idle |
| RF-07 | Review pinado filtra metadados slug do diff pending | Should | diffs limpos na UI |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Consistência | Transição atômica DB→WS | repository.transition | 🟢 |
| Isolamento | ≤1 ativo (partial indexes) | migration 047 | 🟢 |
| Durabilidade | Artefatos no repo (VCS) | feature-pipeline docs | 🟢 |

## Critérios de Aceitação

```gherkin
Dado nenhum pipeline ativo na thread e no projeto
Quando /featdevelop inicia
Então pipeline status running e fase prd pending→running

Dado pipeline ativo no mesmo projeto
Quando segunda instância tenta iniciar
Então operação rejeitada (≤1 ativo)

Dado fase prd concluída
Quando motor avança
Então próxima fase é prd-gate na ordem fixa do código

Dado gate humano ativo
Quando status awaiting-approval
Então retoma para running após approve

Dado artefato gerado na fase spec
Quando motor persiste
Então ficheiro aparece em docs/features/<slug>/ no repo, não no SQLite
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-05 | Must | Core /featdevelop |
| RF-06, RF-07 | Should | Retomada e UX review |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/runner/feature-pipeline-motor.ts` | motor pipeline | 🟢 |
| `packages/shared/src/feature-pipeline.ts` | FEATURE_PIPELINE_PHASES | 🟢 |
| `packages/server/src/repositories/feature-pipelines.ts` | transition | 🟢 |
| `packages/server/src/runner/dispatch.ts` | despacho motor | 🟢 |

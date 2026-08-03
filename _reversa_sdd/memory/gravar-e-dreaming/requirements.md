# gravar-e-dreaming

> Spec de gravação de memory.md e consolidação dreaming.  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Sub-unit Memory: escrita curada via tool `save_memory` e UI (PUT), e dreaming que comprime `memory.md` via LLM isolado quando ratios de teto são atingidos. Fail-closed com guardrails, CAS, backups rotacionados e debounce. 🟢

## Responsabilidades

- Tool `save_memory`: seção canônica, dedupe, teto por entrada/chamada 🟢
- PUT UI com CAS (baseHash) e reject acima de MEMORY_MAX_BYTES 🟢
- Dreamer coordinator: pump(), debounce, onIdle, fail streak 🟢
- Consolidator: spawn LLM isolado (Claude/glm/minimax, sem tools) 🟢
- Guardrails: headings, perda >50% linhas, output max 75% teto 🟢
- dreaming-report.md + 3 backups antes de apply 🟢

## Regras de Negócio

- Escrita ≥ DREAM_TRIGGER_RATIO (80%) agenda consolidação auto 🟢
- Output consolidado > DREAM_OUTPUT_MAX_RATIO (75%) ⇒ hard-reject 🟢
- Alvo pedido no prompt: DREAM_TARGET_RATIO (60%) 🟢
- Debounce: máx 1 auto por projeto em DREAM_DEBOUNCE_HOURS (24h) 🟢
- DREAM_MAX_FAIL_STREAK (3) pausa auto até config/manual 🟢
- Codex/grok não executam dreaming 🟢
- Anomalia/truncado bloqueia PUT e dreaming 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | save_memory append/dedupe em seção válida | Must | Tool error se inválido |
| RF-02 | PUT memory rejeita acima MEMORY_MAX_BYTES (422) | Must | UI e tool consistentes |
| RF-03 | Gatilho 80% arma modo auto no dreamer | Must | pending=true após write/read |
| RF-04 | Consolidator roda fora do repo lock | Must | LLM cwd tmp; env mínimo |
| RF-05 | Apply sob lock com CAS + 3 backups | Must | undoAvailable após apply |
| RF-06 | Fail streak ≥3 pausa auto dreaming | Should | enabled continua; auto off |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Segurança | Consolidator fail-closed (--tools "") | consolidator.ts | 🟢 |
| Integridade | validateConsolidation guardrails | dreamer flow | 🟢 |
| Disponibilidade | Dreaming busy → arma onIdle | dreamer-state.ts | 🟢 |

## Critérios de Aceitação

```gherkin
Dado memory em 80% do teto após save_memory
Quando o turno completa e dreaming está ON
Então dreamer pending=true e consolidação agenda debounce

Dado consolidator retorna output acima de 75% do teto
Quando validateConsolidation avalia
Então apply é rejeitado e lastRun.ok=false

Dado 3 falhas consecutivas de dreaming auto
Quando novo gatilho 80% ocorre
Então auto dreaming não dispara até reset manual

Dado memoryTruncated=true
Quando PUT ou force dream
Então operação bloqueada com erro claro
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-05 | Must | Gravação e compressão são core |
| RF-06 | Should | Protege contra loop de falha |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/memory/memory-file.ts` | save_memory, dedupe | 🟢 |
| `packages/server/src/memory/dreamer.ts` | pump, apply | 🟢 |
| `packages/server/src/memory/dreamer-state.ts` | estado por projeto | 🟢 |
| `packages/server/src/memory/consolidator.ts` | spawn LLM isolado | 🟢 |
| `packages/server/src/runner/dispatch.ts` | gatilhos 80%/cheio | 🟢 |
| `shared/src/project-memory.ts` | ratios e tetos dreaming | 🟢 |

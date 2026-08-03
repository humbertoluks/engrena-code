# gravar-e-dreaming, Design Técnico

> Gravação de memory.md e pipeline dreaming/consolidator.

## Interface

### Tool save_memory

| Campo | Tipo | Regra | Confiança |
|-------|------|-------|-----------|
| section | Decisões \| Restrições \| Pendências | enum fechado | 🟢 |
| content | string | ≤ MEMORY_ENTRY_MAX_CHARS pós-sanitize | 🟢 |
| dedupe | implícito | normalizeForDedupe por seção | 🟢 |

### Ratios dreaming (shared)

| Constante | Valor | Papel | Confiança |
|-----------|-------|-------|-----------|
| `DREAM_TRIGGER_RATIO` | 0.8 | agenda auto | 🟢 |
| `DREAM_TARGET_RATIO` | 0.6 | alvo no prompt | 🟢 |
| `DREAM_OUTPUT_MAX_RATIO` | 0.75 | hard-reject apply | 🟢 |
| `DREAM_DEBOUNCE_HOURS` | 24 | janela auto | 🟢 |
| `DREAM_BACKUP_GENERATIONS` | 3 | rotação backup | 🟢 |
| `DREAM_MAX_FAIL_STREAK` | 3 | pausa auto | 🟢 |

### Estado dreaming (GET)

| Campo | Tipo | Notas | Confiança |
|-------|------|-------|-----------|
| enabled | boolean | tri-state resolvido | 🟢 |
| pending | boolean | consolidação agendada | 🟢 |
| lastRun | DreamingLastRun | ok, provider, model | 🟢 |
| undoAvailable | boolean | backup restorable | 🟢 |
| lastReport | string | dreaming-report.md | 🟢 |

## Fluxo Principal (dreaming)

1. Gatilho: write/read ≥80% ou teto cheio (force) 🟢
2. `pump()`: se busy, arma flag; senão inicia 🟢
3. LLM fora do lock: consolidator spawn isolado 🟢
4. `validateConsolidation`: headings, bytes, perda linhas, refs 🟢
5. Apply sob lock: CAS + 3 backups + report + lastRun 🟢
6. Debounce: timestamp último apply bloqueia auto 24h 🟢

## Fluxo Principal (gravação)

1. save_memory ou PUT → sanitize boundary (dado, não instrução) 🟢
2. dedupe por seção (NFC, casefold, bullet normalize) 🟢
3. writeAtomic memory.md; retorna novo hash 🟢
4. Se ≥ trigger ratio → sinaliza dreamer 🟢

## Dependências

- `providers` — Claude env para consolidator 🟢
- `dreamer-state.ts` — coordinator in-memory 🟢
- `dispatch.ts` — gatilhos pós-turno e onIdle 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| LLM fora do repo lock | dreamer.ts | 🟢 |
| Fail-closed consolidator | --tools "", stdin delimitado | 🟢 |
| Hard-reject 75% output | validateConsolidation | 🟢 |
| Codex/grok excluídos | DREAM_PROVIDERS | 🟢 |

## Riscos e Lacunas

- 🔴 Endpoint force-dream manual (se existir rota dedicada)
- 🟡 Selecção exacta de model/provider default dreaming
- 🟡 Conteúdo exacto do prompt de consolidação

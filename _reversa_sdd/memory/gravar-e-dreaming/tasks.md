# gravar-e-dreaming, Tarefas de Implementação

> Gravação memory.md e pipeline dreaming.

## Pré-requisitos

- [ ] Módulo memory base (FS, journal, rotas) concluído
- [ ] Provider Claude (ou glm/minimax) para consolidator
- [ ] dispatch onIdle hook disponível

## Tarefas

- [ ] T-01, Implementar save_memory: seções, dedupe, tetos
  - Origem no legado: `packages/server/src/memory/memory-file.ts`
  - Critério de pronto: tool rejeita entrada inválida ou oversized
  - Confiança: 🟢

- [ ] T-02, PUT memory com CAS baseHash e 422 acima teto
  - Origem no legado: `packages/server/src/routes/project-memory.ts`
  - Critério de pronto: conflito hash → 409
  - Confiança: 🟢

- [ ] T-03, dreamer-state + pump() com busy/onIdle
  - Origem no legado: `packages/server/src/memory/dreamer-state.ts`, `dreamer.ts`
  - Critério de pronto: pending correto; serialização por projeto
  - Confiança: 🟢

- [ ] T-04, consolidator fail-closed (cwd tmp, --tools "")
  - Origem no legado: `packages/server/src/memory/consolidator.ts`
  - Critério de pronto: spawn isolado; stdin delimitado
  - Confiança: 🟢

- [ ] T-05, validateConsolidation + apply com backups/report
  - Origem no legado: `packages/server/src/memory/dreamer.ts`
  - Critério de pronto: reject >75%; 3 backups rotacionados
  - Confiança: 🟢

- [ ] T-06, Gatilhos 80%/cheio no dispatch + debounce/fail streak
  - Origem no legado: `packages/server/src/runner/dispatch.ts`
  - Critério de pronto: auto off após 3 falhas; debounce 24h
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, save_memory dedupe impede linha duplicada
- [ ] TT-02, Output 76% teto → apply rejeitado
- [ ] TT-03, 3 falhas → auto não dispara
- [ ] TT-04, Apply OK → undoAvailable true

## Ordem Sugerida

1. T-01 → T-02 (gravação)
2. T-03 → T-04 → T-05 (dreaming pipeline)
3. T-06 (integração dispatch)

## Lacunas Pendentes (🔴)

- Rota HTTP force-dream (se houver)

# memory, Tarefas de Implementação

> Sequência para reimplementar o módulo Memory a partir do legado.

## Pré-requisitos

- [ ] Contratos `shared/src/project-memory.ts` publicados
- [ ] Git repo-lock operacional
- [ ] Rotas project-scoped com projectScope

## Tarefas

- [ ] T-01, FS base: ensure, anti-symlink, readBounded, writeAtomic
  - Origem no legado: `packages/server/src/memory/project-memory-fs.ts`
  - Critério de pronto: `.lioncode/` criado; symlink rejeitado
  - Confiança: 🟢

- [ ] T-02, Journal: gramática, sanitize, rotação, append
  - Origem no legado: `packages/server/src/memory/journal.ts`
  - Critério de pronto: linhas válidas; tetos entries/bytes
  - Confiança: 🟢

- [ ] T-03, Memory file: template 3 seções, dedupe, CAS hash
  - Origem no legado: `packages/server/src/memory/memory-file.ts`
  - Critério de pronto: PUT rejeita > MEMORY_MAX_BYTES
  - Confiança: 🟢

- [ ] T-04, Head-delta no turno (ancestral, teto 20)
  - Origem no legado: `packages/server/src/memory/head-delta.ts`
  - Critério de pronto: commits não-ancestrais ignorados
  - Confiança: 🟢

- [ ] T-05, Config tri-state + rotas GET/PUT memory e config
  - Origem no legado: `packages/server/src/memory/config.ts`, `routes/project-memory.ts`
  - Critério de pronto: enabled/dreaming resolvem projeto ?? global
  - Confiança: 🟢

- [ ] T-06, composeMemoryBlock + hint line no runner
  - Origem no legado: `packages/server/src/runner/memory-block.ts`
  - Critério de pronto: injeção respeita tetos bytes
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, PUT memory com hash errado → 409
- [ ] TT-02, Arquivo truncado externamente → editable false
- [ ] TT-03, Journal append sob lock → linha sanitizada
- [ ] TT-04, composeMemoryBlock com memory OFF → bloco omitido

## Ordem Sugerida

1. T-01 (FS)
2. T-02, T-03 (journal + memory)
3. T-04 (head-delta)
4. T-05 (HTTP)
5. T-06 (runner)

## Lacunas Pendentes (🔴)

- Diferença exacta clear vs reset journal

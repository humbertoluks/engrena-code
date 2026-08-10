# Plano de Implementação: F15. Runtime de SubAgents

**Pré-requisitos:**
- Herdar stack/tooling de `docs/_shared/codebase-patterns.md` (Electron/Vite/React, SQLite `node:sqlite`, HTTP loopback 5174, Vitest, MCP interno `engrenacode`)
- Dependências de produto já no código: F01.1 tokens; F03 dispatch/DiffViewer/lease/WS; F07 catálogo + gate + componentes de observação; F11/F12 runtime `call_subagent` + usage `source=subagent`
- Sem dependência npm nova prevista
- `docs/F15-runtime-de-subagents/ui.md` e `copy.md` **ainda não existem** — implementação visual final do card/badges depende do processo de design; fases abaixo podem ligar contratos de dados/estado e reutilizar baseline F07 `subagentsRun.*` até o design fechar
- Spec: `docs/F15-runtime-de-subagents/spec.md`

---

### Fase 1: Endurecimento do runtime de delegação

**1. Idle por silêncio de stream** - Em `delegate.ts`, ligar `recordActivity` aos eventos de progresso do filho durante `runDelegatedSubagentTurn`, para o watchdog idle refletir silêncio real (não wall-clock desde o start). Referência: spec §3.2 e §7.1.

**2. Duração e correlação do run** - Ao completar, falhar, cancelar ou timeout, persistir `durationMs` em `subagent_runs` e popular `parentToolCallId` quando o tool-call do pai estiver disponível. Manter emissões WS `subagent.start` / `subagent.result` e o write path `usage_event source=subagent` já existente.

**3. Testes de runtime** - Estender os testes de idle e de delegação com DI para cobrir activity no stream, duração no terminal, usage e gate Codex, conforme a estratégia da spec (sem alterar o plano de asserts aqui).

---

### Fase 2: History e hidratação no workspace

**4. History com `subagentRuns`** - Estender `GET /api/threads/:id/history` para incluir a lista ordenada de runs do pai via repositório existente, e tipar o cliente `threads-service` de acordo com a spec §5.1.

**5. Consumo WS no estado do workspace** - No fluxo do `#principal`, reagir a `subagent.start` / `subagent.result` com atualização da lista de runs (refetch ou patch) sem exigir refresh manual da página.

**6. Testes HTTP de history** - Cobrir presença/ausência e ordenação de `subagentRuns` no handler de threads.

---

### Fase 3: Diffs unificados na revisão do pai

**7. Garantir coleta pós-delegação** - Confirmar (e ajustar só se necessário) que o turno pai, após o retorno bloqueante de `call_subagent`, continua a materializar `diffWorkingTree` do cwd compartilhado como diffs do `threadId` pai. Não introduzir merge-tree nem write-parallel.

**8. Regressão de diffs** - Cobrir com teste de integração ou extensão do dispatch/delegate que alterações feitas no caminho do filho aparecem na lista de diffs do pai após o turno.

---

### Fase 4: Superfícies de observação (contrato de dados/estado)

**9. Card Subagents na sidebar** - Montar `SubagentActivity` na sidebar do workspace com os runs da thread ativa, clique abrindo o audit modal existente, e estados ao vivo vindos da Fase 2.

**10. Bloco na timeline** - Em `ChatHistory`, correlacionar a tool `call_subagent` com o run correspondente e renderizar `SubagentTimelineBlock` (status incluindo `timeout`, nome, provider/model) sem duplicar o work log genérico.

**11. Badge/estado timeout idle** - Expor o estado `status === 'timeout'` com tom âmbar dos tokens Design Lock; literal final “Timeout (idle)” fica para `ui.md`/`copy.md` de F15 (ou ajuste coordenado dos ids F07). Não inventar anatomia nova além do contrato da spec §6.

---

### Fase 5: Validação e fechamento

**12. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração + regressão MCP). Rodar smoke E2E contra binário real (`claude` ou `codex`) com ≥ 1 `call_subagent` bem-sucedido, diffs na aba Diff do pai, share subagent > 0 em `#consumo`, e os erros de gate/nome/idle da checklist §7.2; documentar em `docs/F15-runtime-de-subagents/smoke-results.md`. Confirmar critérios §9 F15 e cross-feature F07↔F03 / usage→F11. Quando `ui.md`/`copy.md` F15 existirem, verificar light/dark, anatomia e copy; até lá, validar só contratos de estado e tokens. Gate: suite e `pnpm build` / `tsc -b` verdes; atualizar `docs/PRD.md` §9 e `docs/PROGRESS.md` ao fechar.

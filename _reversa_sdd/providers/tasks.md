# providers, Tarefas de Implementação

> Reimplementar registry e drivers a partir do legado.

## Pré-requisitos

- [ ] Contratos `@lioncode/shared` (Provider, RawStreamEvent)
- [ ] Vault com resolvers de key (`resolveClaudeKey`, glm, minimax)
- [ ] Runner pronto para consumir AsyncIterable e chamar cancel
- [ ] Sub-unidade `dispatch-provider` para contrato dispatch/cancel

## Tarefas

- [ ] T-01, Definir `ProviderDriver`, `DispatchOptions`, `DispatchCancelledError`
  - Origem no legado: `packages/server/src/providers/types.ts`
  - Critério de pronto: contrato documentado; sem seq no RawStreamEvent
  - Confiança: 🟢

- [ ] T-02, Implementar `createDriverRegistry` com 6 drivers
  - Origem no legado: `packages/server/src/providers/registry.ts`
  - Critério de pronto: singleton por provider; get() total
  - Confiança: 🟢

- [ ] T-03, `ClaudeAgentDriver` (claude + compat glm/minimax)
  - Origem no legado: `packages/server/src/providers/claude-agent.ts`
  - Critério de pronto: dispatch SDK; MCP lioncode; path-guard D13
  - Confiança: 🟢

- [ ] T-04, `CodexCliDriver` (app-server + exec fallback)
  - Origem no legado: `packages/server/src/providers/codex.ts`
  - Critério de pronto: full-access only; usage delta cumulativo
  - Confiança: 🟢

- [ ] T-05, `GrokAcpDriver` e `KimiAcpDriver`
  - Origem no legado: `packages/server/src/providers/grok-acp.ts`, `kimi-acp.ts`, `acp-shared.ts`
  - Critério de pronto: ACP lifecycle; cancel gracioso
  - Confiança: 🟢

- [ ] T-06, `capabilities.ts` + rotas config provider
  - Origem no legado: `packages/server/src/providers/capabilities.ts`, `routes/config-*.ts`
  - Critério de pronto: UI reflete subagents/MCP/skills por provider
  - Confiança: 🟢

- [ ] T-07, `cli-resolver.ts` (Windows unwrap, overrides persistidos)
  - Origem no legado: `packages/server/src/providers/cli-resolver.ts`
  - Critério de pronto: spawn shell-free; env overrides do server boot
  - Confiança: 🟢

- [ ] T-08, Bridges: `subagent-bridge.ts`, `subagent-caller-gate.ts`
  - Origem no legado: `packages/server/src/providers/subagent-bridge.ts`, `subagent-caller-gate.ts`
  - Critério de pronto: delegate HTTP localhost; gates env fail-closed
  - Confiança: 🟢

- [ ] T-09, Usage helpers: `claude-usage.ts`, `kimi-session-usage.ts`, `memory-session.ts`
  - Origem no legado: paths homônimos em `providers/`
  - Critério de pronto: parsing robusto; gate memória por hash
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Registry: available false sem credencial glm
- [ ] TT-02, Dispatch consome eventos sem seq
- [ ] TT-03, cancel mid-stream → DispatchCancelledError
- [ ] TT-04, resolveCli unwrap .cmd no Windows 🟡

## Ordem Sugerida

1. T-01 → T-02 (contrato + registry)
2. T-03, T-04, T-05 (drivers em paralelo)
3. T-07 (CLI) antes de codex/grok/kimi
4. T-06, T-08, T-09 (capabilities e bridges)

## Lacunas Pendentes (🔴)

- Cobertura de testes E2E por provider real (keys/CLI externas)
- Tabela completa tools allowlist × provider

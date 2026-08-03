# providers

> Spec de requisitos da camada de drivers de IA (`packages/server/src/providers`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Registry de **ProviderDriver** para seis providers (`claude`, `codex`, `glm`, `minimax`, `grok`, `kimi`). Cada driver executa `dispatch` emitindo `RawStreamEvent` em **ordem causal** (sem `seq`); o **runner** persiste, carimba sequência e faz fan-out WS. Drivers **não** acessam DB nem WebSocket. 🟢

## Responsabilidades

- `createDriverRegistry` indexando drivers por `Provider` 🟢
- Contrato `ProviderDriver`: `name`, `available`, `dispatch`, `cancel` 🟢
- Família Claude (SDK): `claude`, `glm`, `minimax` via compat Anthropic 🟢
- `codex`: CLI app-server preferido, fallback exec 🟢
- `grok` / `kimi`: drivers ACP (stdio) 🟢
- Capabilities por provider (`capabilities.ts`) 🟢
- Resolução CLI shell-free (`cli-resolver.ts`) 🟢
- Bridges subagent/MCP/repo-graph via closures injetadas pelo runner 🟢

## Regras de Negócio

- Drivers **nunca** tocam SQLite, WS ou allocator de `seq` 🟢
- GLM/Minimax: `available=false` sem key no cofre 🟢
- Claude: sem key → OAuth/subscription; strip env `ANTHROPIC_*` herdado 🟢
- Codex: contrato comum só `full-access`; plan/supervised rejeitados 🟢
- Subagent caller: claude/codex/grok/kimi ON; glm/minimax OFF 🟢
- Allowlist de tools enforced em claude/glm/minimax/codex; não em grok/kimi 🟡
- Freios env fail-closed para codex (`SUBAGENT_CALLER_ENABLED_CODEX`, etc.) 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | Registry retorna driver para todo `Provider` enum | Must | `get('claude')` etc. nunca undefined |
| RF-02 | `dispatch` retorna AsyncIterable RawStreamEvent sem seq | Must | Runner adiciona seq/threadId |
| RF-03 | `cancel(threadId)` interrompe turno em flight | Must | DispatchCancelledError gracioso |
| RF-04 | `available` reflete credenciais/CLI resolvíveis | Must | UI desabilita provider indisponível |
| RF-05 | Capabilities expõem suporte a subagents/skills/MCPs | Should | Config UI coerente |
| RF-06 | Usage parsing por família (Claude/Codex/Kimi wire) | Should | Métricas persistíveis |
| RF-07 | MemorySessionGate evita re-injetar memória redundante | Could | Hash SHA-256 + LRU |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Isolamento | Driver agnóstico de persistência | `providers/types.ts` | 🟢 |
| Segurança | Path-guard D13 em subagent filho | `claude-agent.ts` | 🟢 |
| Portabilidade | CLI resolver unwrap shims Windows | `cli-resolver.ts` | 🟢 |
| Cancelamento | Estado inflight compartilhado por registry | `registry.ts` comentário | 🟢 |

## Critérios de Aceitação

```gherkin
Dado registry criado com cofre destravado e keys GLM/Minimax
Quando get(provider) para cada Provider enum
Então retorna instância única com available coerente

Dado dispatch(prompt, options) em andamento
Quando runner consome AsyncIterable
Então eventos chegam em ordem causal sem campo seq

Dado cancel(threadId) durante dispatch
Quando driver aborta
Então emite DispatchCancelledError e runner volta thread a idle

Dado provider glm sem key no cofre
Quando UI consulta available
Então driver reporta available=false
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-04 | Must | Sem drivers não há agentes |
| RF-05, RF-06 | Should | UX config e billing |
| RF-07 | Could | Otimização de prompt |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/providers/types.ts` | `ProviderDriver`, `DispatchOptions` | 🟢 |
| `packages/server/src/providers/registry.ts` | `createDriverRegistry` | 🟢 |
| `packages/server/src/providers/capabilities.ts` | capabilities matrix | 🟢 |
| `packages/server/src/providers/claude-agent.ts` | ClaudeAgentDriver | 🟢 |
| `packages/server/src/providers/codex.ts` | CodexCliDriver | 🟢 |
| `packages/server/src/providers/grok-acp.ts` / `kimi-acp.ts` | ACP drivers | 🟢 |
| `packages/server/src/providers/cli-resolver.ts` | `resolveCli` | 🟢 |

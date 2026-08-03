# bridge-subagents

> Spec de requisitos do bridge MCP (`lioncode-subagents`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴  
> Unit aninhada de: `mcp-servers`

## Visão Geral

Servidor MCP stdio **`lioncode`** usado por providers que não embutem subagents nativamente (Codex, Grok ACP): expõe `call_subagent`, opcionalmente `save_memory` e família `repo_graph_*`, fazendo proxy HTTP ao endpoint efêmero do driver do sistema legado no loopback. Tools registradas **condicionalmente** por capabilities ENV. 🟢

## Responsabilidades

- Resolver `BridgeConfig` de ENV (URL, token, caps) 🟢
- Registrar `call_subagent` com z.enum dos nomes vinculados ao projeto 🟢
- Registrar `save_memory` se `LIONCODE_MEMORY=1` 🟢
- Registrar 7× `repo_graph_*` se `LIONCODE_REPO_GRAPH=1` 🟢
- Proxy POST delegate/save-memory/repo-graph com Bearer 🟢
- Retornar texto ou `isError`; nunca derrubar server por falha de tool 🟢
- Boot fail stderr se contrato ENV inválido (sem capability) 🟢

## Regras de Negócio

- Bridge exige ≥1 capability: SUBAGENTS JSON / MEMORY=1 / REPO_GRAPH=1 🟢
- `LIONCODE_SUBAGENTS` = catálogo `[{name,description}]`; enum restringe nomes 🟢
- Delegate ligado ao AbortController do turno pai (cancel cascata) 🟢
- Sem heap compartilhado: proxy HTTP, não closure in-process 🟢
- Erros proxy → conteúdo textual + `isError: true` 🟢
- stdout reservado JSON-RPC; boot fail só stderr 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | resolveBridgeConfig valida URL+token+caps | Must | Throw claro se inválido |
| RF-02 | call_subagent proxy delegate com task/context | Must | Texto retornado ao modelo pai |
| RF-03 | save_memory proxy section+content | Should | Só se MEMORY=1 |
| RF-04 | repo_graph_* (7 tools) proxy read-only | Should | Só se REPO_GRAPH=1 |
| RF-05 | z.enum subagent restringe nomes do catálogo | Must | Provider não escolhe fora da lista |
| RF-06 | Falha de tool não encerra processo MCP | Must | isError + mensagem |
| RF-07 | Injeção Codex via TOML mcp_servers.lioncode | Should | command+args dist/index.js |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Segurança | Bearer token uso único por dispatch | protocol proxyDelegate | 🟢 |
| Disponibilidade | Cancel delegate propaga ao filho | comentários index.ts | 🟢 |
| Testabilidade | fetch injetável em protocol | protocol.ts | 🟢 |

## Critérios de Aceitação

```gherkin
Dado ENV sem SUBAGENTS, MEMORY e REPO_GRAPH
Quando main() inicia
Então resolveBridgeConfig falha e processo exit 1

Dado LIONCODE_SUBAGENTS com dois nomes
Quando call_subagent invoca subagent válido
Então proxyDelegate POST retorna texto ao provider

Dado LIONCODE_REPO_GRAPH=1
Quando repo_graph_search é invocada
Então proxyRepoGraph retorna result ou isError

Dado delegate retorna erro HTTP
Quando handler call_subagent captura
Então content textual com isError true e processo vivo
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01, RF-02, RF-05, RF-06 | Must | Bridge core Codex/Grok |
| RF-03, RF-04, RF-07 | Should | Caps extras e wiring |

## Rastreabilidade de Código

| Arquivo | Papel | Cobertura |
|---------|-------|-----------|
| `mcp-servers/lioncode-subagents/src/index.ts` | Registro tools MCP | 🟢 |
| `mcp-servers/lioncode-subagents/src/protocol.ts` | Config + proxies | 🟢 |
| `mcp-servers/lioncode-subagents/test/protocol.test.ts` | Testes puros | 🟢 |
| `packages/server/src/providers/` (Codex driver) | TOML injection | 🟡 |

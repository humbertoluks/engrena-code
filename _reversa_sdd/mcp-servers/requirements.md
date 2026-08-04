# mcp-servers

> Spec de requisitos dos pacotes MCP first-party (`mcp-servers/*`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Workspace **pnpm** de servidores MCP stdio do catálogo do sistema legado: integrações externas (Slack, Linear, n8n, Cartesia, ElevenLabs) e bridges internas (`sistema-legado-secret-wrapper`, `sistema-legado-subagents`). Cada pacote é processo separado spawnado pelo runner/provider; lógica testável em `protocol.ts`; entrypoint em `index.ts`. 🟢

## Responsabilidades

- Expor tools MCP via `@modelcontextprotocol/sdk` + Zod 🟢
- Resolver config/segredos de `process.env` no spawn (vault → runner) 🟢
- Comunicar APIs remotas ou loopback do sistema legado via `fetch` injetável 🟢
- Retornar JSON enxuto ou `isError`; nunca derrubar processo por falha de tool 🟢
- TTS: gravar mp3 em `.sistema-legado/audio/` com git exclude 🟢
- Secret wrapper: pass-through stdio para server real sem vazar canal 🟢
- Bridge subagents: proxy HTTP delegate/memory/repo-graph 🟢

## Regras de Negócio

- Segredos **nunca** em argv, stdout de log ou resultado de tool 🟢
- stdout = JSON-RPC MCP; diagnóstico só stderr 🟢
- Listas/textos truncados (≤50 itens, ~4k chars) 🟢
- Erros de tool → `isError: true` + texto; processo continua 🟢
- Wrapper: `specUrl` restrito a `127.0.0.1` 🟢
- Bridge exige ≥1 capability (SUBAGENTS / MEMORY / REPO_GRAPH) 🟢
- Sentinel spawn: `SISTEMA_LEGADO_MCP_SERVER_DIST:<pkg>` → dist/index.js 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | Cada pacote exporta MCP stdio funcional | Must | Tools registradas; transport connect |
| RF-02 | protocol.ts testável sem rede/stdio | Must | node:test em `test/protocol.test.ts` |
| RF-03 | Slack/Linear/n8n resolvem ENV e chamam API | Must | Boot fail se segredo obrigatório ausente |
| RF-04 | Cartesia/ElevenLabs TTS → audioRelPath | Should | Payload contrato AudioResult |
| RF-05 | Secret wrapper fetch spec + spawn filho | Must | stdio inherit; env scrubbed |
| RF-06 | Bridge subagents proxy delegate HTTP | Must | call_subagent + caps condicionais |
| RF-07 | SIGTERM/SIGINT encaminhados ao filho (wrapper) | Must | Sem processo órfão |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Segurança | Env scrub `SISTEMA_LEGADO_MCP_*` no filho | secret-wrapper protocol | 🟢 |
| Segurança | Token file burn-after-read | readAndBurnToken | 🟢 |
| Testabilidade | fetch/fs injetáveis em protocol | protocol.ts deps | 🟢 |
| Observabilidade | Logs só stderr | comentários index.ts | 🟢 |

## Critérios de Aceitação

```gherkin
Dado spawn slack com SLACK_BOT_TOKEN no env
Quando tool list_channels é invocada
Então retorna JSON enxuto sem ecoar o token

Dado secret-wrapper com token file válido
Quando fetchSpec retorna command/args/env
Então filho spawna com stdio inherit e env limpo

Dado bridge com SISTEMA_LEGADO_SUBAGENTS JSON
Quando call_subagent é invocada
Então proxyDelegate POST ao endpoint loopback do driver

Dado TTS sem voiceId
Quando tool synthesize é chamada
Então isError sem crash do processo MCP
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-03, RF-05–RF-06 | Must | Catálogo e bridges core |
| RF-04, RF-07 | Should | TTS e lifecycle wrapper |

## Rastreabilidade de Código

| Pacote / path | Papel | Cobertura |
|---------------|-------|-----------|
| `mcp-servers/slack/` | Slack Web API MCP | 🟢 |
| `mcp-servers/linear/` | Linear GraphQL MCP | 🟢 |
| `mcp-servers/n8n/` | n8n REST MCP | 🟢 |
| `mcp-servers/cartesia/` | Cartesia TTS | 🟢 |
| `mcp-servers/elevenlabs/` | ElevenLabs TTS | 🟢 |
| `mcp-servers/sistema-legado-secret-wrapper/` | Pass-through spawn | 🟢 |
| `mcp-servers/sistema-legado-subagents/` | Bridge sistema-legado | 🟢 |

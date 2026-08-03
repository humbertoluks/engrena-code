# secret-wrapper

> Spec de requisitos do wrapper MCP (`lioncode-secret-wrapper`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴  
> Unit aninhada de: `mcp-servers`

## Visão Geral

Processo **pass-through** spawnado como `command` do MCP no provider (Claude SDK, Codex TOML, etc.): lê token efêmero de arquivo, busca spec no loopback do sistema legado, spawna o server MCP real com `stdio: 'inherit'`. JSON-RPC flui direto provider↔filho; wrapper não interpreta MCP. 🟢

## Responsabilidades

- Validar argv: `<serverName> <tokenFilePath> <specUrl>` 🟢
- Restringir `specUrl` a `http(s)://127.0.0.1` 🟢
- Ler e apagar token file imediatamente (`readAndBurnToken`) 🟢
- GET mcp-spec autenticado → `{ command, args, env }` 🟢
- Spawn filho com env scrubbed (`buildChildEnv`) 🟢
- Encaminhar SIGTERM/SIGINT e exit code ao filho 🟢
- Diagnosticar só em stderr 🟢

## Regras de Negócio

- argv contém só paths/nomes; conteúdo sensível só no arquivo 🟢
- Token válido no loopback até fim do dispatch; arquivo é canal de entrega 🟢
- Vars `LIONCODE_MCP_*` / `LIONCODE_SECRET_*` **não** passam ao filho 🟢
- Filho herda stdio; wrapper transparente ao protocolo 🟢
- Falha fetch/spawn → exit 1 com mensagem stderr 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | parseArgs rejeita argv incompleta ou specUrl inválida | Must | null → usage stderr + exit 1 |
| RF-02 | readAndBurnToken apaga arquivo após leitura | Must | Arquivo removido best-effort |
| RF-03 | fetchSpec GET com Bearer retorna ServerSpec | Must | command/args/env validados |
| RF-04 | spawn filho stdio inherit + env merged scrubbed | Must | Filho não vê vars wrapper |
| RF-05 | Forward sinais e exit ao processo pai | Must | Sem MCP órfão |
| RF-06 | ELECTRON_RUN_AS_NODE=1 no spawn do provider | Should | Node como execPath |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Segurança | specUrl só loopback | protocol parseArgs regex | 🟢 |
| Segurança | Burn token file | readAndBurnToken | 🟢 |
| Testabilidade | fetch/fs injetáveis | protocol.ts | 🟢 |

## Critérios de Aceitação

```gherkin
Dado argv com specUrl "https://evil.com/spec"
Quando parseArgs executa
Então retorna null e processo encerra com usage

Dado token file com conteúdo válido
Quando readAndBurnToken roda
Então retorna token trimado e arquivo não existe mais

Dado fetchSpec 200 com command e args
Quando spawn executa
Então filho herda stdio e env sem LIONCODE_SECRET_*

Dado provider envia SIGTERM ao wrapper
Quando handler forward dispara
Então filho recebe SIGTERM
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-05 | Must | Sem wrapper secrets vazam ou órfãos |
| RF-06 | Should | Convenção Electron spawn |

## Rastreabilidade de Código

| Arquivo | Papel | Cobertura |
|---------|-------|-----------|
| `mcp-servers/lioncode-secret-wrapper/src/index.ts` | Entry spawn + signals | 🟢 |
| `mcp-servers/lioncode-secret-wrapper/src/protocol.ts` | parseArgs, burn, fetch, buildChildEnv | 🟢 |
| `mcp-servers/lioncode-secret-wrapper/test/protocol.test.ts` | Testes puros | 🟢 |

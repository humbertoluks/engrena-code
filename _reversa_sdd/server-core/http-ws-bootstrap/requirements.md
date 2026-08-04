# http-ws-bootstrap

> Spec de requisitos do transporte HTTP+WebSocket local.  
> Unidade filha de `server-core` · Nível: essencial · Confiança: 🟢/🟡/🔴

## Visão Geral

Camada que **binda** o server em loopback, **roteia** requisições REST JSON e hospeda o **hub WebSocket** por `threadId`. Garante limites de payload e respostas JSON consistentes. 🟢

## Responsabilidades

- `http.createServer` escutando em host/porta resolvidos (default loopback) 🟢
- Router: match `method + path`, params `:id`, query, body JSON 🟢
- Rejeitar corpo HTTP > **1 MiB** antes do parse 🟢
- CORS preflight e headers para origins allowlist 🟢
- WebSocket RFC 6455 nativo: upgrade, subscribe por thread, fan-out de `StreamEvent` 🟢
- Sentinela 404/405 sempre JSON (nunca throw para fora do listener) 🟢

## Regras de Negócio

- Bind default `127.0.0.1` — sem exposição WAN implícita 🟢
- Path desconhecido → 404; método errado → 405 🟢
- `Content-Type: application/json` exigido para bodies parseados 🟡
- WS: token de sessão via subprotocolo `sistema-legado-session`, **nunca** query string 🟢
- Frames WS limitados (1 MiB/frame, 4 MiB mensagem agregada) 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | Server HTTP escuta host/porta configurados | Must | `listen` só após router+WS prontos |
| RF-02 | Router compila rotas e extrai params | Must | `/threads/:id` resolve `id` |
| RF-03 | Body JSON ≤ 1 MiB ou erro de validação | Must | Payload maior rejeitado |
| RF-04 | WS upgrade autenticado (cofre + sessão) | Must | Cliente legítimo recebe 101 |
| RF-05 | Hub emite eventos só aos inscritos na thread | Must | Outra thread não recebe deltas |
| RF-06 | Suporte a terminal PTY via WS (quando rota ativa) | Should | Shell remoto local funciona |
| RF-07 | `requestId` UUID por requisição HTTP | Could | Correlação em logs |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Segurança | originGuard/CORS alinhados ao renderer `app://` e Vite dev | `config.ts`, `http/cors.ts` | 🟢 |
| Robustez | Listener HTTP nunca propaga exceção não tratada | `router.ts` handle | 🟢 |
| Performance | Match de rotas O(n) compilado por segmentos | `matchSegments` | 🟢 |
| Memória | Limite de fila de envio WS 4 MiB | `ws/server.ts` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado createServer com host 127.0.0.1 e porta 4477
Quando listen completa
Então GET /api/config/status responde JSON no loopback

Dado POST com corpo > 1 MiB
Quando readBody acumula chunks
Então a resposta é erro de validação JSON sem processar handler

Dado cliente WS com subprotocolo sistema-legado-session e token válido
Quando handshake upgrade para threadId=T
Então eventos emit(T, event) chegam ao cliente inscrito

Dado path /inexistente
Quando router.match falha
Então resposta 404 JSON padronizada
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-05 | Must | UI depende de HTTP+streaming WS |
| RF-06 | Should | Terminal integrado |
| RF-07 | Could | Observabilidade |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/server.ts` | attach WS ao http.Server | 🟢 |
| `packages/server/src/http/router.ts` | `createRouter`, `readBody`, `MAX_BODY_BYTES` | 🟢 |
| `packages/server/src/http/cors.ts` | preflight, headers | 🟢 |
| `packages/server/src/ws/server.ts` | `createWebSocketHub`, handshake | 🟢 |
| `packages/server/src/config.ts` | origins allowlist | 🟢 |

# http-ws-bootstrap, Design Técnico

> Transporte HTTP e WebSocket do server local.

## Interface

### Router (`createRouter`)

| Método | Entrada | Saída |
|--------|---------|-------|
| `match(method, path)` | verb + pathname | `RouteMatch` \| `method_not_allowed` \| `null` |
| `handle(req, res)` | Node HTTP | Promise<void>; sempre fecha resposta JSON |

Constantes: `MAX_BODY_BYTES = 1024 * 1024` (1 MiB). 🟢

### WebSocket Hub

| Conceito | Detalhe | Confiança |
|----------|---------|-----------|
| Handshake | RFC 6455; valida Origin + vault + sessão | 🟢 |
| Auth WS | `Sec-WebSocket-Protocol: sistema-legado-session, <token>` | 🟢 |
| Subscribe | Query `?threadId=` ou mensagem `subscribe` | 🟢 |
| `emit(threadId, event)` | Fan-out `StreamEvent` ordenado | 🟢 |
| PTY | `spawnPty` para sessão terminal | 🟢 |

### Limites WS (anti-DoS local)

| Limite | Valor |
|--------|-------|
| Frame payload | 1 MiB 🟢 |
| Mensagem agregada | 4 MiB 🟢 |
| Fila de envio | 4 MiB 🟢 |

## Fluxo Principal (HTTP)

1. `handle` recebe request → gera `requestId` 🟢
2. CORS preflight curto-circuita se OPTIONS 🟢
3. `match` → se null/`method_not_allowed`, errorHandler sentinela 🟢
4. `readBody` se método mutável → parse JSON 🟢
5. Monta `RequestContext` com `services`, headers, params, query, body 🟢
6. `runMiddlewareChain` → serializa `JsonResponse` 🟢

## Fluxo Principal (WebSocket)

1. Upgrade no mesmo `http.Server` 🟢
2. Valida origin allowlist (reusa lógica originGuard) 🟢
3. Exige cofre destravado + token subprotocol válido 🟢
4. Cliente associa-se a `threadId`; runner chama `emit` durante dispatch 🟢
5. Ping/pong e close gracioso conforme RFC 6455 🟢

## Fluxos Alternativos

- **Corpo vazio:** `{}` ou undefined conforme método 🟡
- **Content-Type não-JSON:** rejeição ou skip conforme rota 🟡
- **WS sem threadId inicial:** aguarda mensagem subscribe 🟢
- **Cliente desconectado:** eventos descartados ou enfileirados até limite 🟡

## Dependências

- `middleware/index.ts` — cadeia HTTP 🟢
- `http/context.ts` — tipos Route/RequestContext 🟢
- `vault` — gate WS 🟢
- `runner/dispatch.ts` — produtor de eventos WS 🟢
- `terminal/pty.ts` — PTY nativo 🟢

## Decisões de Design

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| WS sem lib externa (RFC 6455 manual) | Comentário `ws/server.ts` | 🟢 |
| Token WS via subprotocol, não query | ALTO-001 em `ws/server.ts` | 🟢 |
| 1 MiB body HTTP alinhado a anti-DoS local | `router.ts` | 🟢 |
| Mesmo server HTTP serve REST e upgrade WS | `server.ts` | 🟢 |

## Estado Interno

| Estado | Onde |
|--------|------|
| Rotas compiladas (`segments[]`) | Router |
| Mapa threadId → Set<socket> | WebSocketHub |
| PTY sessions | Hub / terminal |

## Observabilidade

- Log de handshake WS rejeitado (sem token) 🟢
- `requestId` em logs HTTP 🟢

## Riscos e Lacunas

- 🔴 Política exacta de backpressure quando fila WS estoura
- 🟡 Timeout de idle WS não documentado aqui
- 🟡 Comportamento de upload multipart (imagens) usa limite separado

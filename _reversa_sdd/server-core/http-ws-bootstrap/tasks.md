# http-ws-bootstrap, Tarefas de Implementação

> Reimplementar router HTTP e hub WebSocket a partir do legado.

## Pré-requisitos

- [ ] `ServerServices` montado em `createServer`
- [ ] `MIDDLEWARE_CHAIN` disponível
- [ ] Lista `routes` exportada de `routes/index.ts`
- [ ] Config de origins (`buildOriginGuardConfig`)

## Tarefas

- [ ] T-01, Implementar `createRouter` com compile/match de segmentos `:param`
  - Origem no legado: `packages/server/src/http/router.ts` (`compile`, `matchSegments`)
  - Critério de pronto: params decodificados; 404/405 via sentinela
  - Confiança: 🟢

- [ ] T-02, Implementar `readBody` com teto 1 MiB e parse JSON
  - Origem no legado: `packages/server/src/http/router.ts` (`MAX_BODY_BYTES`, `readBody`)
  - Critério de pronto: overflow → `ValidationError`; JSON inválido tratado
  - Confiança: 🟢

- [ ] T-03, Integrar CORS preflight e `setCorsHeaders`
  - Origem no legado: `packages/server/src/http/cors.ts`
  - Critério de pronto: OPTIONS ok para origins allowlist; renderer `app://` aceito
  - Confiança: 🟢

- [ ] T-04, `http.createServer(router.handle)` + bind loopback
  - Origem no legado: `packages/server/src/server.ts`
  - Critério de pronto: escuta host/porta de `loadServerConfig`
  - Confiança: 🟢

- [ ] T-05, Implementar `createWebSocketHub` (handshake, frames, subscribe)
  - Origem no legado: `packages/server/src/ws/server.ts`
  - Critério de pronto: upgrade 101; subprotocol `lioncode-session`; emit por thread
  - Confiança: 🟢

- [ ] T-06, Autenticação WS: origin + vault unlocked + verifySessionToken
  - Origem no legado: `packages/server/src/ws/server.ts`, `middleware/origin-guard.ts`
  - Critério de pronto: token só via subprotocol; query string rejeitada
  - Confiança: 🟢

- [ ] T-07, Limites de frame/mensagem/fila WS
  - Origem no legado: `packages/server/src/ws/server.ts` (MAX_* constants)
  - Critério de pronto: payload excessivo fecha conexão sem derrubar processo
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, GET rota válida → 200 JSON
- [ ] TT-02, Body 1 MiB + 1 byte → erro
- [ ] TT-03, WS handshake feliz com token válido
- [ ] TT-04, emit thread A não vaza para subscriber de thread B

## Ordem Sugerida

1. T-01, T-02, T-03 (HTTP puro)
2. T-04 (bind)
3. T-05 → T-06 → T-07 (WS)

## Lacunas Pendentes (🔴)

- Contrato exacto mensagem `subscribe` vs query `threadId`
- Integração PTY: rotas e permissões de terminal

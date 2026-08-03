# renderer

> Spec de requisitos do pacote UI (`packages/renderer`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Frontend **React 18 + Vite + Tailwind** da IDE desktop do sistema legado. SPA servida pelo shell (`app://bundle/` ou Vite dev); comunica com o server local via HTTP e WebSocket no loopback; usa `window.lioncode` (IPC) para token de sessão, dialog nativo e evento de vault lock. Roteamento por **hash** (`#login`, `#principal`, …). 🟢

## Responsabilidades

- Bootstrap da app (`main.tsx`, `App.tsx`): tema, client API, estado unlocked 🟢
- Gate de cofre (`LoginScreen`) antes do shell autenticado 🟢
- Roteamento hash + guarda de rotas protegidas (`routes.ts`, `useHashRoute`) 🟢
- Client tipado HTTP/WS/PTY com header `X-sistema-legado-Session` 🟢
- Workspace principal e telas lazy (consumo, catálogos, config) via `AppShell` 🟢
- Streaming de conversa, diffs, terminal dock, command palette 🟢

## Regras de Negócio

- Token de sessão **somente** em header HTTP e subprotocolo WS; nunca query string 🟢
- Rotas protegidas inacessíveis com cofre travado; hash desconhecido → `#login` 🟢
- Após unlock: IPC `getSessionToken` → injeta no client **antes** do AppShell 🟢
- Vault lock IPC descarta token e força retorno ao gate 🟢
- Defaults API `localhost:4477`; override `VITE_LIONCODE_*` 🟢
- Sem bridge Electron (Vite puro): rotas públicas OK; token opcional 🟡

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | Exibir gate de login enquanto cofre travado | Must | `#login` ou rota protegida redireciona ao gate |
| RF-02 | Após unlock, carregar AppShell lazy com token válido | Must | Primeira chamada protegida leva session header |
| RF-03 | Navegar entre rotas via hash canônico | Must | `#principal`, `#mcps`, etc. conforme `ROUTE_IDS` |
| RF-04 | Client HTTP/WS autenticado no loopback | Must | 401/403 em vault lock; reconexão WS com backoff |
| RF-05 | Reagir a `onVaultLocked` descartando sessão | Must | UI volta ao login; chamadas protegidas falham |
| RF-06 | Workspace principal: projetos, threads, chat, diffs | Must | Seleção persiste; stream por `seq` |
| RF-07 | Telas de catálogo e config lazy no AppShell | Should | Montagem conforme hash ativo |
| RF-08 | Command palette acionável via WorkspaceContext | Should | Ações nomeadas expostas pelo workspace |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Segurança | Sem Node no renderer; token só memória + header | `App.tsx`, `api/client.ts` | 🟢 |
| Performance | AppShell lazy pós-unlock | `App.tsx` `lazy()` | 🟢 |
| Disponibilidade | WS dedupe + re-hidrata history | `api/ws.ts`, `useThreadConversation` | 🟢 |
| UX | CSP alinhada ao host loopback default | Vite config / client | 🟡 |

## Critérios de Aceitação

```gherkin
Dado o cofre travado e hash "#principal"
Quando useHashRoute avalia a rota
Então a UI exibe LoginScreen e memoriza a rota pretendida

Dado unlock bem-sucedido via HTTP
Quando handleUnlocked obtém token via window.lioncode.getSessionToken
Então api.setSessionToken é chamado antes de montar AppShell

Dado sessão ativa e evento lioncode:vault:locked
Quando o IPC dispara
Então token vira null, unlocked=false e LoginScreen reaparece

Dado thread aberta no workspace principal
Quando eventos WS chegam com seq crescente
Então o reducer atualiza timeline sem duplicar deltas antigos
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-06 | Must | Sem UI autenticada não há IDE |
| RF-07, RF-08 | Should | Catálogo/palette; core funciona sem |
| Dev sem bridge | Could | Só desenvolvimento local |

## Rastreabilidade de Código

| Arquivo | Papel | Cobertura |
|---------|-------|-----------|
| `packages/renderer/src/App.tsx` | Root SPA, unlock, vault lock | 🟢 |
| `packages/renderer/src/router/routes.ts` | ROUTE_IDS, guards | 🟢 |
| `packages/renderer/src/router/useHashRoute.ts` | Hash + intendedRef | 🟢 |
| `packages/renderer/src/api/client.ts` | HTTP tipado + session | 🟢 |
| `packages/renderer/src/api/ws.ts` | WS + dedupe seq | 🟢 |
| `packages/renderer/src/screens/AppShell.tsx` | Shell lazy pós-unlock | 🟢 |

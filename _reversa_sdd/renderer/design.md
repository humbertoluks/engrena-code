# renderer, Design Técnico

> Como o pacote UI (`packages/renderer`) é construído, com base no legado.

## Interface

### Bridge Electron (`window.sistemaLegado`)

| Símbolo | Uso no renderer | Confiança |
|---------|-----------------|-----------|
| `getSessionToken()` | Pós-unlock → `api.setSessionToken` | 🟢 |
| `onVaultLocked(cb)` | Descarta token; `unlocked=false` | 🟢 |
| `pickDirectory()` | Modais de path (projetos, etc.) | 🟢 |
| `versions` | Diagnóstico opcional | 🟢 |

### Rotas hash (`RouteId`)

| Hash | Tela | Protegida |
|------|------|-----------|
| `#login` | LoginScreen (gate) | Não 🟢 |
| `#principal` | Workspace IDE | Sim 🟢 |
| `#consumo`, `#registros` | Métricas / logs | Sim 🟢 |
| `#subagents`, `#skills`, `#mcps`, `#rules` | Catálogos | Sim 🟢 |
| `#configuracao` | Settings | Sim 🟢 |

### Client API

| Módulo | Canal | Session |
|--------|-------|---------|
| `api/http.ts` | REST loopback | Header `X-Sistema-Legado-Session` 🟢 |
| `api/ws.ts` | WebSocket thread events | Subprotocolo / header 🟢 |
| `api/pty.ts` | PTY interativo | Idem 🟢 |
| `api/client.ts` | Facade `ApiClient` | `setSessionToken` in-memory 🟢 |

## Fluxo Principal

1. `main.tsx` aplica tema (`useTheme`) → monta `App` 🟢
2. `createApiClient()` singleton; `unlocked=false` 🟢
3. `useHashRoute(unlocked)`: hash inválido → `#login` 🟢
4. Cofre travado → `LoginScreen`; unlock HTTP → `handleUnlocked` → IPC token → `resumeAfterUnlock()` 🟢
5. `lazy(AppShell)`: sidebar + rota ativa (PrincipalScreen ou catálogo) 🟢
6. Principal: `usePrincipalWorkspace` + `useThreadConversation` + WS subscribe 🟢

## Fluxos Alternativos

- **Vite dev sem Electron:** bridge ausente; unlock ainda via HTTP; token IPC omitido 🟡
- **Vault lock mid-session:** IPC → limpa token; guard redireciona `#login` 🟢
- **WS disconnect:** backoff; re-fetch history; dedupe `message.delta` por high-water `seq` 🟢
- **Message queue:** follow-ups em localStorage; lease via server 🟢

## Dependências

- `@sistema-legado/shared` — tipos de domínio (Project, Thread, Message…) 🟢
- Server loopback — única fonte de dados 🟢
- xterm.js, shiki, react-markdown — terminal e render 🟢
- Tailwind — design tokens da IDE 🟢

## Decisões de Design

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Hash routing (sem react-router URL path) | `routes.ts` design lock | 🟢 |
| Lazy AppShell pós-unlock | `App.tsx` comentário budget | 🟢 |
| Token via IPC, credenciais via HTTP | `App.tsx` feat-005 | 🟢 |
| Reducer de conversa por `seq` | `useThreadConversation` | 🟢 |
| `terminalRunning` sempre false (dívida) | code-analysis | 🟢 |

## Estado Interno (App)

| Estado | Onde | Evolução |
|--------|------|----------|
| `unlocked` | `App.tsx` | false → true no unlock; false no lock |
| `workspaceName` | `App.tsx` | set no unlock; clear no lock |
| `sessionToken` | `ApiClient` | IPC inject; null no lock |
| `intendedRef` | `useHashRoute` | rota antes do redirect login |

Persistência UI: localStorage (message queue, tema, prefs) 🟡

## Riscos e Lacunas

- 🔴 Matriz completa CSP vs origins em todos os modos de build
- 🟡 Comportamento exato quando unlock OK mas IPC token null
- 🟡 Cobertura E2E do renderer isolado sem shell

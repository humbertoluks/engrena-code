# renderer, Tarefas de Implementação

> Sequência para reimplementar o pacote UI a partir do legado.

## Pré-requisitos

- [ ] Server loopback com vault unlock e rotas protegidas
- [ ] Shell com preload `window.sistemaLegado` (produção) ou Vite dev standalone
- [ ] Pacote `@sistema-legado/shared` com contratos de API
- [ ] Build Vite → `packages/renderer/dist` para `app://bundle`

## Tarefas

- [ ] T-01, Bootstrap Vite/React: `main.tsx`, tema, Tailwind
  - Origem: `packages/renderer/src/main.tsx`
  - Critério de pronto: app monta sem erros; tema aplicado antes do paint
  - Confiança: 🟢

- [ ] T-02, `createApiClient` com session header e base URL configurável
  - Origem: `packages/renderer/src/api/client.ts`, `api/http.ts`
  - Critério de pronto: header `X-Sistema-Legado-Session` quando token setado
  - Confiança: 🟢

- [ ] T-03, Rotas hash: `routes.ts` + `useHashRoute` com guard e intendedRef
  - Origem: `packages/renderer/src/router/routes.ts`, `useHashRoute.ts`
  - Critério de pronto: protegida + locked → `#login`; resume pós-unlock
  - Confiança: 🟢

- [ ] T-04, `App.tsx`: LoginScreen, lazy AppShell, IPC vault lock/unlock
  - Origem: `packages/renderer/src/App.tsx`
  - Critério de pronto: token injetado antes do shell; lock limpa sessão
  - Confiança: 🟢

- [ ] T-05, Client WS com dedupe seq e reconexão
  - Origem: `packages/renderer/src/api/ws.ts`
  - Critério de pronto: deltas antigos ignorados; reconnect re-hidrata
  - Confiança: 🟢

- [ ] T-06, `AppShell` + telas lazy (consumo, catálogos, config)
  - Origem: `packages/renderer/src/screens/AppShell.tsx`
  - Critério de pronto: hash seleciona screen correta
  - Confiança: 🟢

- [ ] T-07, Integração PTY (`api/pty.ts`, `XtermView`, `TerminalDock`)
  - Origem: `packages/renderer/src/api/pty.ts`, `components/XtermView.tsx`
  - Critério de pronto: terminal abre WS; buffer pré-open drenado
  - Confiança: 🟢

- [ ] T-08, Command palette via WorkspaceContext
  - Origem: `packages/renderer/src/components/CommandPalette/*`
  - Critério de pronto: ações do workspace invocáveis pelo palette
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Hash desconhecido cai em `#login`
- [ ] TT-02, Unlock → token IPC → primeira listProjects autenticada
- [ ] TT-03, Vault lock IPC retorna ao gate
- [ ] TT-04, WS dedupe não reaplica delta com seq menor

## Ordem Sugerida

1. T-01 → T-02 → T-03 → T-04 (gate + routing + API)
2. T-05 → T-06 (streaming + shell)
3. T-07, T-08 (terminal + palette em paralelo)

## Lacunas Pendentes (🔴)

- Política CSP completa por ambiente (dev vs bundle)

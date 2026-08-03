# bootstrap-janela, Design Técnico

> Como o arranque main → server → protocol → janela → tray é construído.

## Interface

### Entrada / ambiente

| Sinal | Tipo | Efeito | Confiança |
|-------|------|--------|-----------|
| `app.isPackaged` | boolean | Prod vs possível Vite | 🟢 |
| `RENDERER_DEV_SERVER_URL` | env string? | Load Vite se não empacotado | 🟢 |
| `LIONCODE_E2E_HERMETIC` | `'1'` | Drivers fake + openExternal no-op | 🟢 |
| `app.getPath('userData')` | path | Passado a `createServer` | 🟢 |

### Funções principais

| Símbolo | Assinatura | Retorno | Observação |
|---------|------------|---------|------------|
| `bootstrap` | `()` | `Promise<void>` | Loop retry até `bootstrapReady` ou quit 🟢 |
| `startLocalServer` | `()` | `Promise<void>` | Idempotente se `localServer` já existe 🟢 |
| `registerAppProtocol` | `()` | `void` | `protocol.handle('app', …)` bundle+media 🟢 |
| `createMainWindow` | `()` | `BrowserWindow` | Segurança + guards 🟢 |
| `createTray` | `()` | `void` | Menu Mostrar / Sair 🟢 |
| `cleanupBootstrapAttempt` | `()` | `Promise<void>` | Desfaz tray/janela/IPC/protocol/server 🟢 |
| `writeBootstrapFailure` | `(error)` | `void` | Append `bootstrap-errors.log` mode 0o600 🟢 |

### Privileges do scheme `app`

`standard`, `secure`, `supportFetchAPI`, `corsEnabled`, `stream` — registados **antes** de `ready`. 🟢

## Fluxo Principal

1. Single-instance lock; se perder → `app.quit()` 🟢
2. Pré-ready: Linux `class=lioncode`; `protocol.registerSchemesAsPrivileged` 🟢
3. `whenReady` → `bootstrap()`:
   1. `startLocalServer()` (import ESM `@lioncode/server`) 🟢
   2. `registerDialogIpc()` 🟢
   3. `registerAppProtocol()` 🟢
   4. macOS: `dock.setIcon` 🟢
   5. `createMainWindow()` + `createTray()` 🟢
   6. `bootstrapReady = true` 🟢
4. Regista `activate` (recria janela se zero windows) 🟢
5. `will-quit`: `stopLocalServer` com `preventDefault` até close 🟢

## Fluxos Alternativos

- **Falha no bootstrap:** log → `cleanupBootstrapAttempt` → MessageBox “Tentar novamente” / “Sair”; retry no `while` 🟢
- **Falha fatal no whenReady catch:** cleanup + `app.quit()` 🟢
- **second-instance:** se ready, mostra/recria `mainWindow` 🟢
- **window-all-closed:** macOS mantém app (tray); outros `quit` 🟢
- **Dev URL:** load Vite em vez de `app://bundle/index.html` 🟢
- **Hermético:** `createE2eDriverRegistry` obrigatório; `worktreeGc: false` 🟢

## Dependências

- `@lioncode/server.createServer` — HTTP/WS/vault/SQLite 🟢
- Electron `app`, `protocol`, `BrowserWindow`, `Tray`, `dialog`, `shell` 🟢
- `bootstrap-cleanup.ts` — destroy seguro de recursos parciais 🟢
- Build `renderer/dist` em produção 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Server antes da UI (renderer nunca toca SQLite) | comentário em `bootstrap()` | 🟢 |
| Retry com dialog em vez de crash silencioso | `bootstrap` while + MessageBox | 🟢 |
| `bootstrapReady` só após janela **e** tray | comentário linhas 492–499 | 🟢 |
| Single-instance + second-instance foca janela | `requestSingleInstanceLock` | 🟢 |
| macOS: app vive no tray após fechar janelas | `window-all-closed` | 🟢 |
| Tray icon @2x (16pt lógico) no macOS | `createTray` scaleFactor 2 | 🟢 |
| Scheme privileges incluem `stream` para `<audio>` | registerSchemesAsPrivileged | 🟢 |

## Estado Interno

| Campo | Valores | Notas |
|-------|---------|-------|
| `bootstrapReady` | false→true | Gate second-instance / window-all-closed |
| `localServer` | handle \| null | Close no quit/cleanup |
| `mainWindow` / `tray` | refs \| null | Recriáveis |
| `appProtocolRegistered` | boolean | unhandle no cleanup |

## Observabilidade

- `console.error` em falhas de boot/cleanup 🟢
- `userData/bootstrap-errors.log` com timestamp + stack 🟢

## Riscos e Lacunas

- 🔴 Textos i18n exactos do MessageBox em todos os locales instalados (hoje PT no código)
- 🟡 Comportamento se `renderer/dist` ausente em “produção” (fetch falha na load)
- 🟡 Interação exacta entre retry e handlers IPC duplicados (cleanup remove dialog handler)

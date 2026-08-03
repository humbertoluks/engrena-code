# shell, Design Técnico

> Como o módulo Electron (`packages/shell`) é construído, com base no legado.

## Interface

### Bridge preload → renderer (`window.lioncode`)

| Símbolo | Assinatura | Retorno | Observação |
|---------|------------|---------|------------|
| `pickDirectory` | `()` | `Promise<string \| null>` | Dialog nativo; `null` se cancelado 🟢 |
| `getSessionToken` | `()` | `Promise<string \| null>` | IPC `lioncode:vault:session-token`; `null` se travado 🟢 |
| `onVaultLocked` | `(cb: () => void)` | `() => void` | Unsubscribe; evento `lioncode:vault:locked` 🟢 |
| `versions` | — | `{ node, chrome, electron }` | Somente leitura 🟢 |
| `appName` | — | `'sistema legado'` | Constante 🟢 |

### Canais IPC (main)

| Canal | Direção | Papel | Confiança |
|-------|---------|-------|-----------|
| `lioncode:dialog:open-directory` | invoke | Seletor de diretório | 🟢 |
| `lioncode:vault:session-token` | invoke | Entrega token de sessão | 🟢 |
| `lioncode:vault:locked` | push main→renderer | Invalida sessão na UI | 🟢 |

### Protocolo `app://`

| Método | Caminho | Entrada | Saída | Status |
|--------|---------|---------|-------|--------|
| GET | `app://bundle/<path>` | path relativo a `renderer/dist` | asset estático | 200 / erro se traversal 🟢 |
| GET | `app://media/<projectId>/<rel>` | projectId + rel sob `.lioncode/audio/` | bytes áudio + Range | 200 / 206 / 416 / 4xx 🟢 |

### Server handle (estrutural)

| Campo | Tipo | Uso |
|-------|------|-----|
| `host` / `port` | string / number | Loopback do server 🟢 |
| `vault.getSessionToken` / `onLock` | bridge | IPC sessão 🟢 |
| `repositories.projects.getById` | `{ path } \| null` | Resolve cwd para `serveMedia` 🟢 |
| `close()` | `Promise<void>` | Shutdown 🟢 |

## Fluxo Principal

1. Antes de `ready`: Linux `class=lioncode`; `protocol.registerSchemesAsPrivileged(['app'])` 🟢 (`main.ts`)
2. `app.whenReady` → `startLocalServer()` via `importEsmModule('@lioncode/server')` → `createServer({ userDataPath, openExternal, … })` 🟢
3. Registra IPC (dialog + session token) e `vault.onLock` → emite `lioncode:vault:locked` 🟢
4. `registerAppProtocol()` (`serveBundle` / `serveMedia`) 🟢
5. `createMainWindow()` → load `app://bundle/index.html` (ou Vite dev URL) 🟢
6. Tray + handlers de ciclo de vida; em quit: cleanup handlers, protocol, `server.close()` 🟢

## Fluxos Alternativos

- **Dev:** `RENDERER_DEV_SERVER_URL` → janela carrega Vite; navegação in-app inclui essa origin 🟢
- **E2E hermético:** `LIONCODE_E2E_HERMETIC=1` → `createE2eDriverRegistry` + `openExternal` no-op 🟢
- **Falha de boot:** `writeBootstrapFailure` + `bootstrap-cleanup` remove recursos parciais 🟢
- **Link https / open:** `setWindowOpenHandler` e `will-navigate` abrem no browser do sistema e negam in-app 🟢
- **Clique em `app://media` (download):** navegação bloqueada; download real via fetch+blob no renderer 🟢

## Dependências

- `@lioncode/server` — processo de domínio in-process (ESM importado do shell CJS) 🟢
- Electron (`app`, `BrowserWindow`, `ipcMain`, `protocol`, `Tray`, `dialog`, `shell`) 🟢
- FS Node — `realpath` / streams para mídia segura 🟢
- `@lioncode/shared` — acoplamento tipado mínimo (estrutural no shell) 🟡

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Scheme `app://` em vez de `file://` para Origin estável (CORS/originGuard) | `main.ts` comentário APP_SCHEME | 🟢 |
| Vault credentials só HTTP; shell só token IPC | `VaultSessionBridge` + comentários | 🟢 |
| Bridges estruturais (não importar tipos runtime do server) | `VaultSessionBridge`, `ProjectsRepositoryBridge` | 🟢 |
| `importEsmModule` via `Function` para CJS→ESM | `main.ts` | 🟢 |
| Sandbox + contextIsolation + sem nodeIntegration | `window.ts` webPreferences | 🟢 |
| Title travado em `sistema legado` | `page-title-updated` preventDefault | 🟢 |

## Estado Interno

| Estado | Onde | Evolução |
|--------|------|----------|
| `localServer` | módulo main | set no boot; `null` após close |
| `mainWindow` / `tray` | módulo main | criados pós-server; destruídos no quit |
| `unsubscribeVaultLock` | módulo main | registrado após server; limpo no shutdown |
| `bootstrapReady` / `appProtocolRegistered` | flags | cleanup parcial se boot falhar |

Sem persistência própria: userData/SQLite/vault vivem no server. 🟢

## Observabilidade

- Falha de bootstrap escrita em ficheiro de log (`writeBootstrapFailure`) 🟢
- Sem métricas próprias do shell 🟡

## Riscos e Lacunas

- 🔴 Detalhe completo do menu Tray por plataforma (itens exatos)
- 🟡 Ordem exacta de cleanup em todos os caminhos de crash
- 🟡 Port/host default do server quando overrides de env (ver server config)

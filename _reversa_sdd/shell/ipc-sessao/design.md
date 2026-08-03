# ipc-sessao, Design Técnico

> Como o shell entrega o token de sessão e propaga o lock do vault via IPC.

## Interface

### Canais

| Canal | Tipo Electron | Payload | Confiança |
|-------|---------------|---------|-----------|
| `lioncode:vault:session-token` | `ipcMain.handle` / `invoke` | retorno `string \| null` | 🟢 |
| `lioncode:vault:locked` | `webContents.send` / `ipcRenderer.on` | sem args | 🟢 |

### Preload (`window.lioncode`)

| Símbolo | Assinatura | Retorno |
|---------|------------|---------|
| `getSessionToken` | `()` | `Promise<string \| null>` 🟢 |
| `onVaultLocked` | `(callback: () => void)` | `() => void` unsubscribe 🟢 |

### Contrato estrutural do vault (server → shell)

```ts
interface VaultSessionBridge {
  getSessionToken(): string | null;
  onLock(listener: () => void): () => void;
}
```
🟢 — subconjunto tipado estruturalmente; shell não importa a classe Vault.

## Fluxo Principal

1. `startLocalServer` obtém `localServer.vault` 🟢
2. Regista `ipcMain.handle(VAULT_SESSION_TOKEN_CHANNEL, () => localServer?.vault.getSessionToken() ?? null)` 🟢
3. `unsubscribeVaultLock = vault.onLock(() => mainWindow?.webContents.send(VAULT_LOCKED_EVENT))` 🟢  
   - Closure lê `mainWindow` **tarde** (janela criada depois no bootstrap) 🟢
4. Renderer, pós-unlock HTTP: `await window.lioncode.getSessionToken()` → guarda em memória → header `X-sistema-legado-Session` 🟢 (renderer; contrato)
5. Em lock: push IPC → renderer descarta token e bloqueia rotas protegidas 🟢

## Fluxos Alternativos

- **Sem server / travado:** invoke devolve `null` sem throw 🟢
- **Janela destruída no lock:** send omitido (`isDestroyed` check) 🟢
- **Shutdown:** `stopLocalServer` chama `unsubscribe?.()` antes de `close()` 🟢
- **Nota:** `pickDirectory` partilha o preload mas não faz parte deste caso de uso 🟢

## Dependências

- Vault do `@lioncode/server` (emissão de token e eventos de lock) 🟢
- Electron `ipcMain` / `ipcRenderer` / `contextBridge` 🟢
- Renderer: fluxo unlock HTTP + consumo do header (fora do shell) 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Credenciais só HTTP; shell só token IPC | comentários `main.ts` / `preload.ts` (2.1) | 🟢 |
| Push de lock em vez de polling | `onLock` → `send` | 🟢 |
| Bridge estrutural evita acoplar tipos runtime do server | `VaultSessionBridge` | 🟢 |
| Token nunca exposto ao contexto web por outro path | preload mínimo | 🟢 |

## Estado Interno

| Estado | Onde | Notas |
|--------|------|-------|
| `unsubscribeVaultLock` | main module | limpo em `stopLocalServer` |
| Token em si | **server vault** + cópia em memória no **renderer** | shell não cacheia 🟢 |

## Observabilidade

- Sem logs dedicados no caminho feliz do token (evita vazar segredo) 🟢
- Falhas de boot/cleanup usam `console.error` genérico (bootstrap) 🟡

## Riscos e Lacunas

- 🟢 Nome exacto do header HTTP: `x-lioncode-session` (`SESSION_HEADER` em `packages/server/src/middleware/session-auth.ts:19`) [Revisão]
- 🟡 Corrida: lock entre invoke e uso do token no renderer (mitigado por push + descarte)
- 🟡 Múltiplas janelas futuras: hoje só `mainWindow` recebe o push

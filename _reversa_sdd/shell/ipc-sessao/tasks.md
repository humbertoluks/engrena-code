# ipc-sessao, Tarefas de Implementação

> Reimplementar entrega do token de sessão e push de lock via IPC.

## Pré-requisitos

- [ ] Server com vault expondo `getSessionToken()` e `onLock(listener)`
- [ ] Bootstrap sobe `localServer` antes dos handlers IPC (ver `bootstrap-janela`)
- [ ] Specs pai `shell/design.md` alinhadas (canais e preload mínimo)

## Tarefas

- [ ] T-01, Definir constantes de canal espelhadas main ↔ preload
  - Origem no legado: `packages/shell/src/main.ts` (VAULT_SESSION_TOKEN_CHANNEL, VAULT_LOCKED_EVENT); `packages/shell/src/preload.ts`
  - Critério de pronto: strings idênticas `lioncode:vault:session-token` e `lioncode:vault:locked`
  - Confiança: 🟢

- [ ] T-02, Tipar `VaultSessionBridge` estrutural (sem import runtime do server)
  - Origem no legado: `packages/shell/src/main.ts` (interface VaultSessionBridge)
  - Critério de pronto: compile-time duck-typing; shell não importa classe Vault
  - Confiança: 🟢

- [ ] T-03, Registrar `ipcMain.handle` de session-token após `createServer`
  - Origem no legado: `packages/shell/src/main.ts` (`startLocalServer`, ~176–179)
  - Critério de pronto: invoke devolve token ou `null`; sem throw se `localServer` null
  - Confiança: 🟢

- [ ] T-04, Subscrever `vault.onLock` com send tardio a `mainWindow`
  - Origem no legado: `packages/shell/src/main.ts` (~185–189)
  - Critério de pronto: lock com janela viva → evento; destruída → sem throw
  - Confiança: 🟢

- [ ] T-05, Expor `getSessionToken` e `onVaultLocked` no `contextBridge`
  - Origem no legado: `packages/shell/src/preload.ts`
  - Critério de pronto: `window.lioncode` tem ambos; unsubscribe remove listener
  - Confiança: 🟢

- [ ] T-06, Cleanup: `removeHandler` + `unsubscribeVaultLock` em shutdown
  - Origem no legado: `packages/shell/src/main.ts` (`stopLocalServer` / will-quit path)
  - Critério de pronto: segundo boot não acumula handlers; lock após close não envia
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Após unlock HTTP simulado, IPC devolve token não vazio
- [ ] TT-02, Lock dispara `onVaultLocked` e invoke seguinte → null
- [ ] TT-03, Unsubscribe impede segundo callback
- [ ] TT-04, Invoke antes de `startLocalServer` → null

## Tarefas de Migração de Dados (se aplicável)

- N/A

## Ordem Sugerida

1. T-01, T-02 (contratos)
2. T-03, T-04 (main)
3. T-05 (preload)
4. T-06 (lifecycle)

## Lacunas Pendentes (🔴)

- Nome exacto do header HTTP no renderer/server (`X-sistema-legado-Session` inferido)
- Política se houver múltiplas BrowserWindows no futuro

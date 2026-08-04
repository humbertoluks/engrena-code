# shell, Tarefas de Implementação

> Sequência para reimplementar o módulo Electron a partir do legado.

## Pré-requisitos

- [ ] Pacote `@sistema-legado/server` (ou equivalente) exporta `createServer` ESM com vault + projects repo
- [ ] Build do renderer em `packages/renderer/dist` (produção) ou `RENDERER_DEV_SERVER_URL` (dev)
- [ ] Electron com suporte a `protocol.handle` / schemes privilegiados
- [ ] Dependência estrutural dos contratos de sessão alinhada ao server (token + onLock)

## Tarefas

- [ ] T-01, Registrar scheme privilegiado `app` e Linux `class=sistema-legado` antes de `ready`
  - Origem no legado: `packages/shell/src/main.ts` (LINUX_APP_ID, APP_SCHEME)
  - Critério de pronto: scheme registado; no Linux WM_CLASS/`StartupWMClass` coerente
  - Confiança: 🟢

- [ ] T-02, Implementar `startLocalServer` com import ESM dinâmico e `createServer({ userDataPath, openExternal })`
  - Origem no legado: `packages/shell/src/main.ts` (`importEsmModule`, `LocalServerHandle`)
  - Critério de pronto: server escuta em loopback; handle expõe `vault` e `repositories.projects`
  - Confiança: 🟢

- [ ] T-03, IPC `sistema-legado:dialog:open-directory` → dialog nativo; retorna path ou `null`
  - Origem no legado: `packages/shell/src/main.ts` + `preload.ts`
  - Critério de pronto: invoke do preload devolve string|null
  - Confiança: 🟢

- [ ] T-04, IPC session token + push `sistema-legado:vault:locked` ligado a `vault.onLock`
  - Origem no legado: `packages/shell/src/main.ts` (VAULT_SESSION_TOKEN_CHANNEL, VAULT_LOCKED_EVENT)
  - Critério de pronto: getSessionToken reflete lock; evento chega ao renderer
  - Confiança: 🟢

- [ ] T-05, `serveBundle`: mapear `app://bundle/*` → `renderer/dist` com bloqueio de traversal
  - Origem no legado: `packages/shell/src/main.ts` (`serveBundle`)
  - Critério de pronto: index.html e assets OK; `../` fora do dist rejeitado
  - Confiança: 🟢

- [ ] T-06, `serveMedia`: `app://media/<projectId>/<rel>` sob `.sistema-legado/audio/`, realpath anti-symlink, Range 200/206/416
  - Origem no legado: `packages/shell/src/main.ts` (`serveMedia`)
  - Critério de pronto: áudio válido serve; symlink escape e path inválido falham
  - Confiança: 🟢

- [ ] T-07, `createMainWindow` com sandbox, contextIsolation, title fixo, guards `will-navigate` / `setWindowOpenHandler`
  - Origem no legado: `packages/shell/src/window.ts`
  - Critério de pronto: load `app://bundle/index.html` ou Vite; https externo no browser do SO
  - Confiança: 🟢

- [ ] T-08, Preload `contextBridge.exposeInMainWorld('sistema-legado', …)` sem Node no renderer
  - Origem no legado: `packages/shell/src/preload.ts`
  - Critério de pronto: API pickDirectory / getSessionToken / onVaultLocked / versions disponível
  - Confiança: 🟢

- [ ] T-09, Tray + ícones; shutdown limpa handlers, protocol e `server.close()`
  - Origem no legado: `packages/shell/src/main.ts`, `assets/tray-icon.ts`, `assets/app-icon.ts`
  - Critério de pronto: quit encerra server sem órfãos
  - Confiança: 🟢

- [ ] T-10, Bootstrap cleanup em falha de boot + modo `SISTEMA_LEGADO_E2E_HERMETIC`
  - Origem no legado: `packages/shell/src/bootstrap-cleanup.ts`, `main.ts` (E2E)
  - Critério de pronto: falha parcial não deixa protocol/server a meio; hermético no-op openExternal
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Boot feliz: server up + janela carrega bundle (ver RF-01)
- [ ] TT-02, Traversal em bundle e media rejeitado
- [ ] TT-03, Vault lock emite evento e token fica null
- [ ] TT-04, Range request em media retorna 206 quando aplicável
- [ ] TT-05, will-navigate bloqueia `app://media` top-level

## Tarefas de Migração de Dados (se aplicável)

- N/A (shell não persiste dados de domínio)

## Ordem Sugerida

1. T-01 → T-02 (sem server não há sessão/mídia)
2. T-03, T-04, T-08 (bridge IPC em paralelo após server)
3. T-05, T-06 (protocolo antes ou junto da janela)
4. T-07 (janela depende de protocolo em produção)
5. T-09, T-10 (ciclo de vida e resiliência)

## Lacunas Pendentes (🔴)

- Itens exactos do menu Tray por OS
- Política completa de userDataPath / overrides de porta (coordenar com server-core)

# bootstrap-janela, Tarefas de Implementação

> Reimplementar o arranque main → server → protocol → janela → tray.

## Pré-requisitos

- [ ] `@lioncode/server` com `createServer` (+ opcional `createE2eDriverRegistry`)
- [ ] `renderer/dist` ou `RENDERER_DEV_SERVER_URL`
- [ ] Ícones embutidos (tray/app data URLs) ou assets equivalentes
- [ ] Specs pai `shell/design.md` alinhadas (canais IPC / scheme)

## Tarefas

- [ ] T-01, Single-instance lock + handlers `second-instance` / `window-all-closed` / `will-quit`
  - Origem no legado: `packages/shell/src/main.ts` (~529–596)
  - Critério de pronto: segunda instância foca janela; quit fecha server; macOS sobrevive a fechar janelas
  - Confiança: 🟢

- [ ] T-02, Pré-ready: `LINUX_APP_ID` + `protocol.registerSchemesAsPrivileged` (stream/cors/fetch)
  - Origem no legado: `packages/shell/src/main.ts` (linhas 34–37, 552–569)
  - Critério de pronto: scheme `app` registado antes de `ready` sem erro Electron
  - Confiança: 🟢

- [ ] T-03, `startLocalServer` com import ESM, userDataPath, openExternal (e ramo hermético)
  - Origem no legado: `packages/shell/src/main.ts` (`startLocalServer`)
  - Critério de pronto: server up; hermético exige registry ou falha explícita
  - Confiança: 🟢

- [ ] T-04, `registerAppProtocol` com `serveBundle` (confine a `renderer/dist`)
  - Origem no legado: `packages/shell/src/main.ts` (`serveBundle`, `registerAppProtocol`)
  - Critério de pronto: `app://bundle/index.html` resolve; traversal → 403
  - Confiança: 🟢

- [ ] T-05, `createMainWindow` (prefs de segurança, title lock, will-navigate, load prod/dev)
  - Origem no legado: `packages/shell/src/window.ts`
  - Critério de pronto: janela 1280×800; SPA carrega; https não navega in-app
  - Confiança: 🟢

- [ ] T-06, `createTray` (ícone @2x, menu Mostrar/Sair, click mostra janela)
  - Origem no legado: `packages/shell/src/main.ts` (`createTray`)
  - Critério de pronto: tray visível; “Mostrar janela” recria se destruída
  - Confiança: 🟢

- [ ] T-07, Orquestrar `bootstrap()` na ordem server → dialog IPC → protocol → dock → window → tray
  - Origem no legado: `packages/shell/src/main.ts` (`bootstrap`)
  - Critério de pronto: `bootstrapReady` só após window+tray; UI não abre sem server
  - Confiança: 🟢

- [ ] T-08, Retry com MessageBox + `cleanupBootstrapAttempt` + `writeBootstrapFailure`
  - Origem no legado: `packages/shell/src/main.ts` + `bootstrap-cleanup.ts`
  - Critério de pronto: falha limpa recursos; “Tentar novamente” reentra o loop; “Sair” quita
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Boot feliz empacotado (RF-01…RF-04)
- [ ] TT-02, Boot com Vite (`RENDERER_DEV_SERVER_URL`)
- [ ] TT-03, Falha simulada de `createServer` → dialog + cleanup + retry
- [ ] TT-04, Hermético sem registry → erro explícito
- [ ] TT-05, second-instance com janela destruída recria BrowserWindow

## Tarefas de Migração de Dados (se aplicável)

- N/A

## Ordem Sugerida

1. T-01, T-02 (esqueleto Electron)
2. T-03, T-04 (backend + protocol antes da UI)
3. T-05, T-06, T-07 (janela/tray + orquestração)
4. T-08 (resiliência)

## Lacunas Pendentes (🔴)

- Copy exacta / i18n do diálogo de erro de bootstrap
- Política se `renderer/dist` estiver em falta no pacote

# bootstrap-janela

> Caso de uso do módulo `shell`: arranque da app até a janela principal visível.  
> Escopo: scheme `app`, server in-process, `BrowserWindow`, tray inicial — sem detalhar IPC de sessão (ver `ipc-sessao`).

## Visão Geral

Garantir que, ao abrir o sistema legado, o processo main configure identidade Linux, registe o scheme privilegiado, suba o server local, sirva o renderer via `app://bundle` (ou Vite em dev) e mostre a janela principal com defaults de segurança. 🟢

## Responsabilidades

- Fixar `LINUX_APP_ID` / WM_CLASS antes de `ready` 🟢
- Registar scheme `app` privilegiado 🟢
- Subir `@lioncode/server` com `userDataPath` e `openExternal` 🟢
- Registar protocol handler bundle (e media, necessário ao protocol único) 🟢
- Criar e mostrar `BrowserWindow` (1280×800, sandbox, title travado) 🟢
- Tray e ícone de dock (macOS) quando aplicável 🟢
- Cleanup e log se o bootstrap falhar 🟢

## Regras de Negócio

- Scheme `app://` obrigatório em produção (não `file://`) por causa do originGuard/CORS 🟢
- Server deve estar up **antes** da janela carregar a SPA empacotada 🟢
- Em hermético E2E: registry fake + `openExternal` no-op; falha se registry ausente 🟢
- Janela só navega em `app://bundle/` ou URL Vite; https → browser do sistema 🟢
- Erros de boot vão para `userData/bootstrap-errors.log` (mode 0o600) 🟢
- Ordem exacta tray vs window em todos os OS 🟡

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | Antes de ready: Linux class + schemes privilegiados | Must | Sem warning de scheme; app_id `lioncode` no Linux |
| RF-02 | whenReady inicia server com userData do Electron | Must | HTTP loopback responde |
| RF-03 | Protocolo `app://bundle` serve `renderer/dist` | Must | `index.html` carrega na janela |
| RF-04 | createMainWindow com isolation/sandbox e load URL correcta (prod vs dev) | Must | Janela visível; title `sistema legado` |
| RF-05 | Guards de navegação e window-open activos na criação | Must | Link https não substitui a SPA |
| RF-06 | Em falha de bootstrap, log + cleanup parcial | Should | Sem protocol/server órfão óbvio |
| RF-07 | Modo E2E hermético injecta drivers e silencia openExternal | Could | Flag env respeitada |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Sandbox + contextIsolation + sem nodeIntegration | `window.ts` | 🟢 |
| Segurança | Origin estável `app://bundle` | `main.ts` APP_SCHEME | 🟢 |
| Disponibilidade | Log de falha em ficheiro dedicado | `writeBootstrapFailure` | 🟢 |
| UX | show:false até ready-to-show | `window.ts` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado um build empacotado válido com renderer/dist
Quando o utilizador inicia o sistema legado
Então o server local sobe e a janela carrega app://bundle/index.html com título sistema legado

Dado RENDERER_DEV_SERVER_URL definido e app não empacotada
Quando a janela é criada
Então loadURL usa o Vite e isInAppNavigation aceita essa origin

Dado LIONCODE_E2E_HERMETIC=1 sem createE2eDriverRegistry no server
Quando startLocalServer corre
Então o bootstrap falha com erro explícito e regista log

Dado a janela pronta
Quando o utilizador clica um link https
Então o browser do sistema abre e a SPA permanece na janela
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-05 | Must | Sem isto a app não abre |
| RF-06 | Should | Resiliência de boot |
| RF-07 | Could | Só CI/E2E |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/shell/src/main.ts` | boot, `startLocalServer`, protocol, tray | 🟢 |
| `packages/shell/src/window.ts` | `createMainWindow`, `isInAppNavigation` | 🟢 |
| `packages/shell/src/bootstrap-cleanup.ts` | cleanup parcial | 🟢 |
| `packages/shell/src/assets/*` | ícones | 🟡 |

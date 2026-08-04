# shell

> Spec de requisitos do módulo Electron (`packages/shell`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Processo **main** do Electron que hospeda o server do sistema legado in-process, serve o renderer pelo scheme `app://` (bundle + mídia de áudio) e expõe um bridge IPC mínimo ao preload (`window.sistemaLegado`). Não manipula credenciais do cofre: só entrega token de sessão e notifica lock. 🟢

## Responsabilidades

- Bootstrap da app (scheme privilegiado, Linux app id, `whenReady`) 🟢
- Subir e encerrar o server local (`@sistema-legado/server`) 🟢
- Servir UI empacotada (`app://bundle/…`) e áudio (`app://media/…`) com guards anti-traversal 🟢
- Criar `BrowserWindow` com isolamento de contexto e navegação restrita 🟢
- IPC: `pickDirectory`, `getSessionToken`, `onVaultLocked`, `versions` 🟢
- Tray e cleanup parcial em falha de boot 🟢

## Regras de Negócio

- Credenciais do vault **somente** via HTTP renderer↔server; shell não lê secrets 🟢
- Origin estável `app://bundle` (evita `Origin: null` de `file://`) 🟢
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` 🟢
- Navegação in-app só `app://bundle/` ou URL Vite de dev; https externo → browser do sistema 🟢
- Path traversal bloqueado em `serveBundle` / `serveMedia` (prefixo + `realpath` anti-symlink) 🟢
- `serveMedia` sob `.sistema-legado/audio/` com suporte a `Range` (200/206/416) 🟢
- E2E hermético: `SISTEMA_LEGADO_E2E_HERMETIC=1` injeta driver registry e `openExternal` no-op 🟢
- Comportamento exato do tray por OS (menus) 🟡

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | Ao iniciar, registrar scheme `app` e subir server local antes da janela | Must | Server responde em localhost; janela carrega UI |
| RF-02 | Expor `window.sistemaLegado` via preload com pickDirectory, getSessionToken, onVaultLocked, versions | Must | Renderer obtém token sem Node no renderer |
| RF-03 | Servir assets de `renderer/dist` em `app://bundle/` sem path escape | Must | Request fora do dist → erro; UI carrega |
| RF-04 | Servir áudio de projeto em `app://media/<projectId>/<rel>` com Range | Should | Player inline reproduz; symlink escape rejeitado |
| RF-05 | Em vault lock, notificar renderer via IPC | Must | UI volta ao gate de login |
| RF-06 | Em shutdown, fechar server e remover handlers/protocol | Must | Processo encerra sem server órfão |
| RF-07 | Modo hermético E2E desativa openExternal real | Could | Flag env ativa; openExternal no-op |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Isolamento de contexto + sandbox; sem nodeIntegration | `packages/shell/src/window.ts` | 🟢 |
| Segurança | Anti-traversal e anti-symlink em mídia | `packages/shell/src/main.ts` (`serveMedia`) | 🟢 |
| Segurança | Secrets fora do shell (só HTTP) | `code-analysis` / comentários main | 🟢 |
| Disponibilidade | Cleanup parcial se boot falhar | `packages/shell/src/bootstrap-cleanup.ts` | 🟢 |
| Observabilidade | Import ESM do server via Function indirection (CJS→ESM) | `packages/shell/src/main.ts` (`importEsmModule`) | 🟢 |

## Critérios de Aceitação

```gherkin
Dado o Electron iniciando em ambiente normal
Quando app.whenReady completa
Então o server local está escutando e a janela principal carrega app://bundle/

Dado o renderer autenticado com sessão
Quando o vault é travado no server
Então o shell emite sistema-legado:vault:locked e o renderer perde o token de sessão

Dado um request app://bundle/../../etc/passwd
Quando serveBundle processa a URL
Então o acesso é rejeitado (sem ler fora de renderer/dist)

Dado áudio em .sistema-legado/audio/ de um projectId válido
Quando o player pede app://media/<projectId>/audio/<file>.mp3 com Range
Então a resposta é 206 (ou 200) com bytes corretos e sem escape de diretório
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01, RF-02, RF-03, RF-05, RF-06 | Must | Sem shell não há app desktop |
| RF-04 | Should | TTS/player; app funciona sem áudio |
| RF-07 | Could | Só pipelines E2E |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/shell/src/main.ts` | `startLocalServer`, `serveBundle`, `serveMedia`, protocol, tray | 🟢 |
| `packages/shell/src/preload.ts` | `contextBridge` / `SistemaLegadoBridge` | 🟢 |
| `packages/shell/src/window.ts` | `createMainWindow`, `isInAppNavigation` | 🟢 |
| `packages/shell/src/bootstrap-cleanup.ts` | cleanup de boot | 🟢 |
| `packages/shell/src/assets/*` | ícones tray/app | 🟡 |

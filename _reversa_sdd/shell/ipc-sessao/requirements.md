# ipc-sessao

> Caso de uso do módulo `shell`: entrega do token de sessão do cofre e notificação de lock via IPC.  
> Credenciais (unlock/keys) ficam no HTTP do server — fora deste caso.

## Visão Geral

Após o unlock HTTP bem-sucedido, o renderer obtém o token de sessão só pelo canal IPC dedicado (`sistema-legado:vault:session-token`) e anexa-o às chamadas protegidas. Quando o cofre trava, o main faz push de `sistema-legado:vault:locked` para o renderer descartar o token. 🟢

## Responsabilidades

- Expor `getSessionToken` no preload via `contextBridge` 🟢
- Handler main que lê `localServer.vault.getSessionToken()` 🟢
- Subscrever `vault.onLock` e enviar evento à `mainWindow` 🟢
- Expor `onVaultLocked` com unsubscribe no preload 🟢
- Garantir que o token não trafega por HTTP nem por outro path web 🟢

## Regras de Negócio

- Token só após unlock HTTP; IPC apenas **entrega** o valor já emitido pelo vault do server 🟢
- Travado / sem server → `getSessionToken` devolve `null` 🟢
- Push de lock só se `mainWindow` existir e não estiver destruída 🟢
- Sem IPC de unlock/provider-keys/github-token no shell (removido por desenho) 🟢
- Renderer mantém token só em memória 🟢
- Formato/TTL exacto do token é do server (vault) — shell é pass-through 🟡

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | `window.sistemaLegado.getSessionToken()` invoca o canal de sessão | Must | Promise resolve string ou null |
| RF-02 | Handler main devolve token vigente do vault in-process | Must | Após unlock HTTP, IPC devolve o mesmo token que o server considera válido |
| RF-03 | Em lock, main emite `sistema-legado:vault:locked` ao renderer | Must | Callback `onVaultLocked` dispara |
| RF-04 | `onVaultLocked` permite cancelar a inscrição | Must | Após unsubscribe, novos locks não chamam o cb |
| RF-05 | Preload não expõe Node nem APIs de vault além do bridge mínimo | Must | Só pickDirectory + sessão + versions (+ appName) |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Token nunca via HTTP no shell; canal IPC dedicado | `main.ts` comentários 2.1 | 🟢 |
| Segurança | contextBridge com API mínima | `preload.ts` | 🟢 |
| Disponibilidade | Handler tolera `localServer` null → null | `?? null` no handler | 🟢 |

## Critérios de Aceitação

```gherkin
Dado o cofre desbloqueado via HTTP e o server com token vigente
Quando o renderer chama window.sistemaLegado.getSessionToken()
Então recebe uma string não vazia para usar em X-Sistema-Legado-Session

Dado o cofre acaba de ser travado no server
Quando vault.onLock dispara
Então o renderer recebe sistema-legado:vault:locked e getSessionToken passa a devolver null

Dado o renderer cancelou onVaultLocked
Quando ocorre um novo lock
Então o callback antigo não é invocado

Dado o bootstrap ainda sem localServer
Quando getSessionToken é invocado
Então o resultado é null (sem throw)
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-04 | Must | Sem isto a UI não autentica no loopback |
| RF-05 | Must | Isolamento do renderer |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/shell/src/preload.ts` | `getSessionToken`, `onVaultLocked` | 🟢 |
| `packages/shell/src/main.ts` | `ipcMain.handle(VAULT_SESSION_TOKEN_CHANNEL)`, `vault.onLock` | 🟢 |
| Server vault (fora do shell) | emissão do token / lock | 🟢 (contrato) |

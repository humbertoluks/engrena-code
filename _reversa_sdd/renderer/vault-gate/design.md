# vault-gate, Design Técnico

> Gate de cofre local no renderer.

## Interface

### LoginScreen props

| Prop | Tipo | Papel |
|------|------|-------|
| `api` | `ApiClient` | POST unlock vault 🟢 |
| `onUnlocked` | `(workspace: string) => void` | Sinaliza sucesso 🟢 |

### Estados UI (`ErrorKind`)

| Kind | Origem típica | Mensagem |
|------|---------------|----------|
| `invalid` | 401 unlock | Genérica anti-enum 🟢 |
| `corrupted` | payload ilegível | Orienta backup 🟢 |
| `backoff` | 429 + Retry-After | Contador regressivo 🟢 |
| `network` | fetch fail | Server local down 🟢 |

### Guarda hash (`useHashRoute`)

| Campo | Tipo | Uso |
|-------|------|-----|
| `unlocked` | boolean | Input da guarda 🟢 |
| `intendedRef` | `RouteId \| null` | Destino pós-unlock 🟢 |
| `resumeAfterUnlock()` | fn | Navega intended ou `#principal` 🟢 |

## Fluxo Principal

1. App monta com `unlocked=false` → sempre `LoginScreen` se rota login ou locked 🟢
2. Usuário preenche workspace/senha → `api.unlockVault` (HTTP) 🟢
3. Sucesso → `handleUnlocked`: `bridge.getSessionToken()` → `api.setSessionToken` → `setUnlocked(true)` → `resumeAfterUnlock()` 🟢
4. App renderiza `lazy(AppShell)` na rota efetiva 🟢

## Fluxos Alternativos

- **Submit duplo:** `submitting` bloqueia reentrada 🟢
- **Unmount durante fetch:** `mountedRef` evita setState 🟢
- **Backoff expira:** limpa ErrorKind backoff; reabilita botão 🟢
- **Sem bridge:** unlock OK; token null; APIs públicas only 🟡
- **Deep link hash protegido:** guard redireciona; resume após unlock 🟢

## Integração IPC (App.tsx)

```
onVaultLocked → api.setSessionToken(null)
              → setUnlocked(false)
              → setWorkspaceName('')
              → LoginScreen remonta
```

Confiança: 🟢 (`App.tsx` feat-005-c3)

## Dependências

- Server vault routes (unlock, rate limit, session token) 🟢
- Shell preload `getSessionToken`, `onVaultLocked` 🟢
- `ApiError` / `NetworkError` / `retryAfterMsOf` 🟢

## Decisões de Design

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Credenciais só HTTP; token só IPC | comentários App/Login | 🟢 |
| AppShell lazy só pós-unlock | reduz bundle inicial | 🟢 |
| intendedRef em ref (não URL) | evita vazar rota em query | 🟢 |

## Riscos e Lacunas

- 🔴 Fluxo completo de primeiro unlock (vault inexistente) vs unlock subsequente
- 🟡 Comportamento se unlock OK mas getSessionToken retorna null
- 🟡 Testes E2E do backoff visual

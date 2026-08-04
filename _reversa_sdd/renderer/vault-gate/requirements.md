# vault-gate

> Spec de requisitos do gate de cofre local (`LoginScreen` + guarda hash).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴  
> Unit aninhada de: `renderer`

## Visão Geral

Tela **`#login`** e mecanismos associados que desbloqueiam o cofre cifrado local (workspace + senha) via HTTP no server. Não é autenticação remota multi-usuário: libera sessão efêmera (`X-Sistema-Legado-Session`) obtida depois via IPC. Enquanto travado, rotas protegidas redirecionam ao gate. 🟢

## Responsabilidades

- Formulário workspace/senha e submit para API unlock 🟢
- Classificação de erros: inválido, corrompido, backoff, rede 🟢
- UI de backoff com contador (rate limit server-side) 🟢
- Callback `onUnlocked(workspace)` → App injeta token IPC 🟢
- Guarda hash: memoriza rota pretendida (`intendedRef`) 🟢
- Reação a vault lock: descarta token e força gate 🟢

## Regras de Negócio

- Unlock **somente** HTTP renderer→server; shell não lê senha 🟢
- Mensagem genérica em credencial inválida (anti-enumeração) 🟢
- Cofre corrompido → mensagem distinta com orientação de backup 🟢
- Backoff: desabilita submit até expirar `Retry-After` 🟢
- Sem bridge Electron: unlock HTTP funciona; token IPC opcional 🟡
- Hash vazio ou desconhecido → `#login` (evita telas fantasma) 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | Exibir gate com workspace e senha | Must | Submit só com campos preenchidos |
| RF-02 | Chamar API unlock com workspace/senha | Must | Sucesso → `onUnlocked` |
| RF-03 | Tratar 401/429/5xx e erros de rede | Must | Mensagens por ErrorKind |
| RF-04 | Redirecionar rotas protegidas ao gate | Must | intendedRef guarda destino |
| RF-05 | Após unlock, obter token IPC antes do shell | Must | Primeira API protegida autenticada |
| RF-06 | Vault lock retorna ao gate imediatamente | Must | Token null; unlocked false |
| RF-07 | Resume hash pretendido pós-unlock | Should | Default `#principal` se nenhum |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Segurança | Senha não persistida no renderer | LoginScreen state local | 🟢 |
| Segurança | Token nunca em query string | domain R2 | 🟢 |
| UX | Botão desabilitado durante submit/backoff | `LoginScreen.tsx` | 🟢 |
| Disponibilidade | Tick 500ms durante backoff | useEffect interval | 🟢 |

## Critérios de Aceitação

```gherkin
Dado cofre travado e usuário em "#mcps"
Quando useHashRoute detecta rota protegida
Então navega para "#login" e intendedRef="mcps"

Dado workspace e senha válidos
Quando submit do LoginScreen completa unlock HTTP
Então onUnlocked é chamado e App busca getSessionToken via IPC

Dado resposta 429 com Retry-After
Quando LoginScreen processa o erro
Então botão fica desabilitado até expirar o backoff

Dado sessão ativa
Quando shell emite vault locked
Então LoginScreen reaparece e chamadas perdem session header
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-06 | Must | Gate bloqueia todo o produto |
| RF-07 | Should | UX de deep-link hash |

## Rastreabilidade de Código

| Arquivo | Papel | Cobertura |
|---------|-------|-----------|
| `packages/renderer/src/screens/LoginScreen.tsx` | UI unlock | 🟢 |
| `packages/renderer/src/App.tsx` | IPC token + lock handler | 🟢 |
| `packages/renderer/src/router/useHashRoute.ts` | Guard + resume | 🟢 |
| `packages/renderer/src/router/routes.ts` | LOGIN_ROUTE, PROTECTED_ROUTES | 🟢 |
| `packages/renderer/src/api/errors.ts` | ApiError, retryAfterMsOf | 🟢 |

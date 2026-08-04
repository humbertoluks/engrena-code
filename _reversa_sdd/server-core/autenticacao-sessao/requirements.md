# autenticacao-sessao

> Spec de requisitos de cofre, sessão HTTP/WS e superfícies públicas.  
> Unidade filha de `server-core` · Nível: essencial · Confiança: 🟢/🟡/🔴

## Visão Geral

Gate de **credenciais em repouso** (`vaultGuard`) e **autenticidade do cliente local** (`sessionAuth`) via header `X-Sistema-Legado-Session`. Rotas marcadas `public` bypassam ambos os gates de sessão, mas não o `originGuard`. 🟢

## Responsabilidades

- Bloquear rotas protegidas enquanto cofre travado 🟢
- Após unlock, exigir token de sessão válido em rotas não-`public` 🟢
- Validar token com comparação em tempo constante (`timingSafeEqual`) 🟢
- Expor apenas `vault-unlock` como rota HTTP `public: true` confirmada 🟢
- WS: autenticar via subprotocolo (coordenação com http-ws-bootstrap) 🟢
- Nunca logar token de sessão 🟢

## Regras de Negócio

- App **single-user**: sessão ≠ multi-tenant 🟢
- Token **nunca** em query string (HTTP header ou WS subprotocol) 🟢
- Rotas novas nascem protegidas; `public` é opt-in explícito 🟢
- `sessionPolicy.required === false` relaxa sessionAuth (testes); vaultGuard permanece 🟢
- Unlock com rate limit dedicado (config separada) 🟢
- Shell entrega token ao renderer via IPC; renderer envia header 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | Cofre travado → rotas não-public retornam VaultLockedError | Must | Antes de sessionAuth |
| RF-02 | POST unlock (`public`) destrava e emite token de sessão | Must | Renderer obtém token |
| RF-03 | Header `X-Sistema-Legado-Session` válido em rotas protegidas | Must | 401 se ausente/inválido |
| RF-04 | Rotas `public` passam vaultGuard e sessionAuth | Must | Unlock acessível travado |
| RF-05 | Lock do cofre invalida sessões existentes | Must | UI volta ao gate |
| RF-06 | WS exige mesma sessão válida no handshake | Must | Sem token → upgrade negado |
| RF-07 | Rate limit em tentativas de unlock | Should | Brute-force local mitigado |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Segurança | Comparação constant-time do token | `vault.verifySessionToken` | 🟢 |
| Segurança | originGuard precede vault/session | `middleware/index.ts` | 🟢 |
| Privacidade | Token omitido de logs | `session-auth.ts` comentário | 🟢 |
| UX | Mensagem 401 padronizada `session_invalid` | `session-auth.ts` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado cofre travado
Quando GET /projects é chamado sem unlock
Então vaultGuard bloqueia com erro de cofre travado

Dado cofre destravado e sem header X-Sistema-Legado-Session
Quando GET /projects é chamado
Então sessionAuth retorna 401 session_invalid

Dado unlock bem-sucedido com token T
Quando request inclui X-Sistema-Legado-Session: T
Então handler da rota executa normalmente

Dado rota vault-unlock marcada public
Quando cofre travado
Então unlock ainda é alcançável (após originGuard)

Dado cofre locked após sessão ativa
Quando verifySessionToken(T) é chamado
Então retorna false e clientes WS desconectam
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-06 | Must | Sem gate não há confidencialidade local |
| RF-07 | Should | Endurecimento unlock |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/middleware/vault-guard.ts` | `vaultGuard` | 🟢 |
| `packages/server/src/middleware/session-auth.ts` | `sessionAuth`, `SESSION_HEADER` | 🟢 |
| `packages/server/src/routes/vault-unlock.ts` | `public: true` | 🟢 |
| `packages/server/src/vault/index.ts` | unlock, verifySessionToken, onLock | 🟢 |
| `packages/server/src/config.ts` | `buildSessionAuthConfig`, unlock rate limit | 🟢 |
| `packages/shell/src/main.ts` | IPC session token | 🟢 |

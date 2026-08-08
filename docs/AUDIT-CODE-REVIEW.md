# Auditoria de código — EngrenaCode

Artefato vivo das revisões full-base (`audit-full-base` → `review-architecture` → `review-robustness` → `review-delivery`).  
**Não** substitui [`docs/AUDIT-PRD-S9-MIGRATION.md`](AUDIT-PRD-S9-MIGRATION.md) (matriz de produto §9).

| Campo | Valor |
|-------|--------|
| **Passagem atual** | 2026-08-08 |
| **Escopo** | `src/` (base completa) |
| **Método** | Skill `.claude/skills/audit-full-base` + 3 subagentes sequenciais (leitura) |
| **Correção de código nesta passagem** | Sim — todos os achados 🔴/🟡 exceto D07 (evidência de smoke) |
| **Histórico** | 2026-08-07 — Lotes 1–2 de remediação pós-review (commits `00674ea`…`7b48930` + follow-ups); 2026-08-08 — reauditoria com este artefato; 2026-08-08 (mesmo dia, passagem seguinte) — remediação de A01/A02/R01-R11/D01-D06/D08, gates reconfirmados (working tree, sem commit ainda) |


### Taxonomia de Stack (esta passagem)

| Stack | Uso |
|-------|-----|
| `Electron` | main, preload, IPC, PTY |
| `React` | renderer |
| `Node.js` | services HTTP, vault, runner, git, mcps, codegraph |
| `SQLite` | `src/services/db/` |
| `TypeScript` | tipagem pura (raro; prefira Stack do arquivo) |
| `Vitest` | testes, smoke, gates de entrega |

### Contagem (passagem 2026-08-08)

| | 🔴 | 🟡 | Tiposas (tipos de regra) |
|--|----|----|---------------------------|
| Achados abertos | 1 | 0 | 1 |
| Problemas corrigidos (tipos) | — | — | 30 |

---

## 1. Resumo executivo

**Veredito:** base **desbloqueada** para robustez/arquitetura/entrega. Todos os achados 🔴/🟡 desta passagem (A01/A02, R01–R11, D01–D06, D08) foram corrigidos e reconfirmados via gates (`pnpm test` 785/785, `tsc --noEmit` limpo, `pnpm build` ok). Arquitetura Electron (isolamento renderer, preload nomeado, HTTP loopback para domínio) está íntegra. Dívidas do Lote 1–2 (guard 423, CORS, OAuth https, vault_corrupted, transport compartilhado, preload tipado, escrita atômica) **permanecem corrigidas**.

**Único item aberto**

1. Smoke-results F20/F21/F23/F26 ainda faltam (`missing-smoke-evidence`, D07) — exige smoke real via `playwright-cli` + Electron, fora do escopo desta remediação de código.

**Nota de processo:** correções aplicadas no working tree; commits ainda não criados nesta passagem (aguardando decisão do usuário sobre granularidade/mensagens).

### Por Stack (abertos)

| Stack | 🔴 | 🟡 |
|-------|----|----|
| `Vitest` | 1 | 0 |
| `Node.js` | 0 | 0 |
| `React` | 0 | 0 |
| `Electron` | 0 | 0 |
| `SQLite` | 0 | 0 |
| `TypeScript` | 0 | 0 |

---

## 2. Achados abertos

| ID | Stack | Sev | Frente | Local | Problema | Regra |
|----|--------|-----|--------|-------|----------|-------|
| D07 | `Vitest` | 🔴 | del | `docs/F20|F21|F23|F26-*` | UI Feito / ACs sem `smoke-results.md` | [R-missing-smoke-evidence](#r-missing-smoke-evidence) |

---

## 3. Regras — achados abertos (1× por tipo × Stack)

<a id="r-missing-smoke-evidence"></a>

### Critério de UI Feito exige `smoke-results.md`
Esforço: 1–2 horas por feature (smoke real)  
Classificação: Alto  
Stack: `Vitest` · Tipo: `missing-smoke-evidence`

#### Por que isso é um problema?
PROGRESS/PRD `[x]` sem artefato de smoke torna o fechamento não auditável. Critérios “usuário vê/clica/toggle/dock” dependem de DOM — unitário não basta (`CLAUDE.md` TESTE).

```
// Não conforme
// docs/F26-*/ sem smoke-results.md; PROGRESS diz Feito com UI
```

Rode smoke via `playwright-cli` + Electron real e grave `docs/F<ID>-*/smoke-results.md` com o que foi exercitado.

```
// Conforme
// docs/F26-terminal-pty-dock/smoke-results.md com passos light/dark e copy
```

#### Exceções
Features só de vault/crypto/API sem superfície UI; features ainda `Pendente` no PROGRESS. Smoke “opcional” declarado na spec não bloqueia se o AC de UI não estiver `[x]`.

---

## 4. Problemas corrigidos

Fonte: auditoria 2026-08-07 (Lotes 1–2) + follow-ups técnicos em commits posteriores + lições reutilizáveis de migração/PROGRESS.  
Cada tipo aparece **uma vez** com evidência de commit. Itens da matriz §9 de produto não entram aqui.

| ID | Stack | Tipo | Evidência | Regra |
|----|--------|------|-----------|-------|
| C01 | `Node.js` | `guard-423-before-401` | `1075879`, `_transport.ts` guard | [RC-guard-423](#rc-guard-423) |
| C02 | `Node.js` | `handler-route-overclaim` | `85e5e07` skills-handler | [RC-route-claim](#rc-route-claim) |
| C03 | `Node.js` | `unlock-payload-validation` | `28ea298` | [RC-unlock-validate](#rc-unlock-validate) |
| C04 | `Node.js` | `oauth-https-allowlist` | `b8b79d1` | [RC-oauth-https](#rc-oauth-https) |
| C05 | `Node.js` | `vault-corrupted-422` | `60d5fb6`, `4d343d2` | [RC-vault-corrupted](#rc-vault-corrupted) |
| C06 | `Node.js` | `cors-wildcard-loopback` | `95d1662` | [RC-cors-local](#rc-cors-local) |
| C07 | `React` | `silent-catch` | `83465ed` | [RC-no-silent-catch](#rc-no-silent-catch) |
| C08 | `React` | `duplicated-fetch-client` | `4fba3a4` `api-client` | [RC-shared-api-request](#rc-shared-api-request) |
| C09 | `Node.js` | `duplicated-http-boilerplate` | `0a3d627` `_transport` | [RC-shared-transport](#rc-shared-transport) |
| C10 | `Electron` | `preload-generic-passthrough` | `787c281` | [RC-named-preload](#rc-named-preload) |
| C11 | `Electron` | `hardcoded-vite-url` | `cf4f013` | [RC-vite-env-url](#rc-vite-env-url) |
| C12 | `Electron` | `dead-scaffold` | `00674ea` | [RC-no-dead-scaffold](#rc-no-dead-scaffold) |
| C13 | `Node.js` | `non-atomic-vault-write` | `bee58cc` | [RC-atomic-vault](#rc-atomic-vault) |
| C14 | `Node.js` | `raw-stderr-to-ui` | `eb716d5` | [RC-sanitize-stderr](#rc-sanitize-stderr) |
| C15 | `Electron` | `electron-spawn-as-node` | F15 / PROGRESS (`ELECTRON_RUN_AS_NODE=1`) | [RC-electron-run-as-node](#rc-electron-run-as-node) |
| C16 | `SQLite` | `premature-repo-factory` | `ade3286` | [RC-module-repo](#rc-module-repo) |
| C17 | `Node.js` | `artifacts-outside-userdata` | `2061cf2` | [RC-artifacts-userdata](#rc-artifacts-userdata) |
| C18 | `Node.js` | `http-body-type-trust` | working tree 2026-08-08 (sem commit); `skills-handler.ts`, `config-handler.ts`, `rules-handler.ts` | [RC-http-body-type-trust](#rc-http-body-type-trust) |
| C19 | `Node.js` | `error-message-path-leak` | working tree 2026-08-08 (sem commit); `codegraph-handler.ts` | [RC-error-message-path-leak](#rc-error-message-path-leak) |
| C20 | `Node.js` | `http-unhandled-hang` | working tree 2026-08-08 (sem commit); `memory-handler.ts`, `codegraph-handler.ts`, `unlock-handler.ts` | [RC-http-unhandled-hang](#rc-http-unhandled-hang) |
| C21 | `Node.js` | `ws-auth-status-collapse` | working tree 2026-08-08 (sem commit); `ws-upgrade.ts` | [RC-ws-auth-status-collapse](#rc-ws-auth-status-collapse) |
| C22 | `Electron` | `ipc-numeric-bounds` | working tree 2026-08-08 (sem commit); `main/index.ts` | [RC-ipc-numeric-bounds](#rc-ipc-numeric-bounds) |
| C23 | `Node.js` | `error-code-vocabulary-drift` | working tree 2026-08-08 (sem commit); `skills-handler.ts`, `config-handler.ts` | [RC-error-code-vocabulary-drift](#rc-error-code-vocabulary-drift) |
| C24 | `Node.js` | `http-body-size-unbounded` | working tree 2026-08-08 (sem commit); `_transport.ts` (`MAX_BODY_BYTES`, `PayloadTooLargeError`) | [RC-http-body-size-unbounded](#rc-http-body-size-unbounded) |
| C25 | `Node.js` | `partial-destructive-effect` | working tree 2026-08-08 (sem commit); `apply-diff.ts` reject tudo-ou-nada | [RC-partial-destructive-effect](#rc-partial-destructive-effect) |
| C26 | `Node.js` | `error-message-locale` | working tree 2026-08-08 (sem commit); `unlock-handler.ts` 404 PT-BR | [RC-error-message-locale](#rc-error-message-locale) |
| C27 | `Node.js` | `layer-inversion` | working tree 2026-08-08 (sem commit); `services/config/defaults.ts` novo, `dispatch.ts` importa de lá | [RC-layer-inversion](#rc-layer-inversion) |
| C28 | `Node.js` | `export-should-be-local` | working tree 2026-08-08 (sem commit); `composer-images.ts` `estimateBase64ByteLength` local | [RC-export-should-be-local](#rc-export-should-be-local) |
| C29 | `React` | `business-rule-in-tsx` | working tree 2026-08-08 (sem commit); 8 telas/componentes → `*.logic.ts` + `*.logic.test.ts` | [RC-business-rule-in-tsx](#rc-business-rule-in-tsx) |
| C30 | `Vitest` | `missing-sibling-test` | working tree 2026-08-08 (sem commit); `messages.test.ts`, `_transport.test.ts`, `store.test.ts`, `vault-service.test.ts`, `git-client.test.ts` (785/785 `pnpm test`) | [RC-missing-sibling-test](#rc-missing-sibling-test) |

### Regras — problemas corrigidos

<a id="rc-guard-423"></a>

### Guard HTTP: vault locked antes de sessão
Esforço: 30 minutos  
Classificação: Crítico  
Stack: `Node.js`  
Tipo corrigido: `guard-423-before-401`

#### Por que isso é um problema?
Checar só o token com o cofre travado devolve 401 e pode fazer um handler reivindicar a rota, sombreando o 423 correto de outro handler na cadeia.

```
// Não conforme
if (req.headers['x-engrenacode-session'] !== token) {
  sendError(res, 401, 'unauthorized', '...')
  return true // reivindica a rota
}
```

```
// Conforme
if (vaultService.isLocked()) {
  sendError(res, 423, 'vault_locked', '...')
  return false // ou return após send, sem engolir rotas alheias
}
if (!isAuthorized(req)) {
  sendError(res, 401, 'unauthorized', '...')
}
```

#### Exceções
Rotas públicas (unlock/health) declaradas sem `guard`.

---

<a id="rc-route-claim"></a>

### Handler só reivindica paths do seu domínio
Esforço: 45 minutos  
Classificação: Alto  
Stack: `Node.js`  
Tipo corrigido: `handler-route-overclaim`

#### Por que isso é um problema?
Prefixo largo (`/api/projects/`) + falha de auth faz o handler responder 401/404 para rotas de outro domínio (ex.: MCPs), antes da cadeia chegar ao dono.

```
// Não conforme
if (url.startsWith('/api/projects/')) {
  if (!auth) { sendError(401); return true }
}
```

```
// Conforme
if (!isSkillsProjectShape(url)) return false
```

#### Exceções
Router central único (se um dia existir) que despacha por tabela — não a cadeia atual de `return false`.

---

<a id="rc-unlock-validate"></a>

### Unlock valida typeof e JSON; erros no envelope padrão
Esforço: 30 minutos  
Classificação: Crítico  
Stack: `Node.js`  
Tipo corrigido: `unlock-payload-validation`

#### Por que isso é um problema?
JSON malformado ou `password` não-string virava 500 ou resposta fora de `{ error: { code, message } }`, quebrando a LoginScreen.

```
// Não conforme
const body = JSON.parse(raw) // throw → 500
await unlock(body.password)
```

```
// Conforme
const data = parseBody(raw)
if (data === null || typeof data.password !== 'string') {
  return sendError(res, 400, 'invalid_request', '...')
}
```

#### Exceções
Resposta de unlock bem-sucedida continua no contrato `{ unlocked, sessionToken? }` documentado na F01.

---

<a id="rc-oauth-https"></a>

### Endpoint OAuth remoto só via https
Esforço: 20 minutos  
Classificação: Crítico  
Stack: `Node.js`  
Tipo corrigido: `oauth-https-allowlist`

#### Por que isso é um problema?
Abrir `http://` ou esquema arbitrário no fluxo OAuth permite interceptação ou handlers locais perigosos.

```
// Não conforme
openExternal(authorizationEndpoint) // qualquer string
```

```
// Conforme
if (typeof url !== 'string' || !url.startsWith('https://')) return false
```

#### Exceções
Nenhuma para autorização/token endpoint remoto.

---

<a id="rc-vault-corrupted"></a>

### Envelope estruturalmente ilegível → 422 vault_corrupted
Esforço: 1 hora  
Classificação: Crítico  
Stack: `Node.js`  
Tipo corrigido: `vault-corrupted-422`

#### Por que isso é um problema?
A spec F01 exige distinguir cofre corrompido de senha errada. Senha errada permanece `unlocked: false`; arquivo ilegível precisa de 422 sem backoff de auth.

```
// Não conforme
catch { return { unlocked: false } } // mascara corrupção
```

```
// Conforme
catch (e) {
  if (isCorruptEnvelope(e)) {
    return sendError(res, 422, 'vault_corrupted', 'O cofre local está danificado...')
  }
}
```

#### Exceções
Falha de auth tag (senha errada) **não** é `vault_corrupted`.

---

<a id="rc-cors-local"></a>

### CORS do loopback só origens locais
Esforço: 30 minutos  
Classificação: Crítico  
Stack: `Node.js`  
Tipo corrigido: `cors-wildcard-loopback`

#### Por que isso é um problema?
`Access-Control-Allow-Origin: *` no unlock server permite que uma página estrangeira no browser do usuário chame a API local (com as limitações de browser), ampliando a superfície.

```
// Não conforme
res.setHeader('Access-Control-Allow-Origin', '*')
```

```
// Conforme
// permitir só 127.0.0.1 / localhost (Vite) e null (file://)
```

#### Exceções
Origin ausente em clientes não-browser (curl/smoke) conforme política já testada.

---

<a id="rc-no-silent-catch"></a>

### Não engula rejeição de fetch com catch vazio
Esforço: 15 minutos  
Classificação: Médio  
Stack: `React`  
Tipo corrigido: `silent-catch`

#### Por que isso é um problema?
`.catch(() => {})` esconde falha de status/catálogo; o usuário vê UI stale sem feedback.

```
// Não conforme
loadStatus().catch(() => {})
```

```
// Conforme
loadStatus().catch((err) => console.error('[workspace]', err))
// + estado de erro na UI quando aplicável
```

#### Exceções
Cancelamento deliberado (AbortError) pode ser silencioso se o unmount for a causa.

---

<a id="rc-shared-api-request"></a>

### Um cliente HTTP no renderer para o loopback
Esforço: 1 hora  
Classificação: Médio  
Stack: `React`  
Tipo corrigido: `duplicated-fetch-client`

#### Por que isso é um problema?
N cópias de `fetch` + header de sessão divergem no tratamento de 401/423 e duplicam bugs.

```
// Não conforme
// cada *-service.ts com seu próprio fetch + headers
```

```
// Conforme
// api-client.ts → apiRequest(); services só montam path/body
```

#### Exceções
Unlock pré-sessão em `LoginScreen` (rota pública) pode usar `fetch` direto.

---

<a id="rc-shared-transport"></a>

### Handlers compartilham guard/parseBody/sendJson
Esforço: 1–2 horas  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `duplicated-http-boilerplate`

#### Por que isso é um problema?
Copiar `guard`/`parseBody` em 12 arquivos garante drift (um esquece 423, outro formata erro diferente).

```
// Não conforme
// cada handler reimplementa parseBody e sendError
```

```
// Conforme
import { guard, parseBody, sendJson, sendError, readBody } from './_transport.js'
```

#### Exceções
Nenhuma para novos handlers no loopback 5174.

---

<a id="rc-named-preload"></a>

### Preload só expõe APIs nomeadas
Esforço: 45 minutos  
Classificação: Alto  
Stack: `Electron`  
Tipo corrigido: `preload-generic-passthrough`

#### Por que isso é um problema?
`invoke`/`send`/`on` genéricos permitem ao renderer falar qualquer canal IPC, furando o princípio de superfície mínima.

```
// Não conforme
contextBridge.exposeInMainWorld('electronAPI', { invoke, send, on })
```

```
// Conforme
contextBridge.exposeInMainWorld('electronAPI', {
  vault: { getSessionToken, isLocked, lock },
  dialog: { openFolder },
  shell: { openExternal },
})
```

#### Exceções
Nenhuma para canais novos — sempre método nomeado + `ipcMain.handle` correspondente.

---

<a id="rc-vite-env-url"></a>

### loadURL de dev lê VITE_DEV_SERVER_URL
Esforço: 10 minutos  
Classificação: Médio  
Stack: `Electron`  
Tipo corrigido: `hardcoded-vite-url`

#### Por que isso é um problema?
Porta 5173 costuma estar ocupada; hardcode desalinha `.env.local` e o Electron carrega a URL errada.

```
// Não conforme
mainWindow.loadURL('http://localhost:5173')
```

```
// Conforme
mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173')
```

#### Exceções
Produção usa `loadFile` do `dist/index.html`, não esta URL.

---

<a id="rc-no-dead-scaffold"></a>

### Remova scaffold/middleware sem consumidor
Esforço: 15 minutos  
Classificação: Baixo  
Stack: `Electron`  
Tipo corrigido: `dead-scaffold`

#### Por que isso é um problema?
Arquivos órfãos (`session-middleware`, `App.tsx` raiz de scaffold) confundem agentes e humanos sobre a fronteira real.

```
// Não conforme
// session-middleware.ts estilo Express sem importadores
```

Delete o módulo ou ligue-o a um uso concreto na mesma mudança.

#### Exceções
Fixtures de teste sob tmpdir / `.playwright-cli/` gitignored.

---

<a id="rc-atomic-vault"></a>

### Escrita de vault.enc é atômica (tmp + rename)
Esforço: 30 minutos  
Classificação: Alto  
Stack: `Node.js`  
Tipo corrigido: `non-atomic-vault-write`

#### Por que isso é um problema?
Write in-place pode deixar `vault.enc` truncado se o processo cair no meio → corrupção real.

```
// Não conforme
writeFileSync(vaultPath, ciphertext)
```

```
// Conforme
writeFileSync(tmpPath, ciphertext)
renameSync(tmpPath, vaultPath)
```

#### Exceções
Nenhuma para o blob principal do cofre.

---

<a id="rc-sanitize-stderr"></a>

### Sanitise stderr de processo antes da UI
Esforço: 30 minutos  
Classificação: Alto  
Stack: `Node.js`  
Tipo corrigido: `raw-stderr-to-ui`

#### Por que isso é um problema?
Stderr de CLI/provider pode conter paths, tokens parciais ou ruído; mostrar cru na timeline vaza detalhe e assusta o usuário.

```
// Não conforme
appendTimeline(err.stderr)
```

```
// Conforme
appendTimeline(sanitizeProcessError(err.stderr))
```

#### Exceções
Logs de desenvolvedor no console do main (não na UI).

---

<a id="rc-electron-run-as-node"></a>

### Spawn de script Node a partir do Electron usa ELECTRON_RUN_AS_NODE
Esforço: 30 minutos  
Classificação: Crítico  
Stack: `Electron`  
Tipo corrigido: `electron-spawn-as-node`

#### Por que isso é um problema?
`process.execPath` no main é o binário Electron. Sem `ELECTRON_RUN_AS_NODE=1`, MCP interno / bridges falham em produção e passam nos unitários (que usam Node).

```
// Não conforme
spawn(process.execPath, [script], { env: process.env })
```

```
// Conforme
spawn(process.execPath, [script], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
})
```

#### Exceções
Spawn do CLI `claude`/`codex` instalado no PATH (não o `execPath` do Electron).

---

<a id="rc-module-repo"></a>

### Prefira funções de módulo a factory sem polimorfismo
Esforço: 1 hora  
Classificação: Baixo  
Stack: `SQLite`  
Tipo corrigido: `premature-repo-factory`

#### Por que isso é um problema?
`createSubagentsRepository()` sem implementações alternativas é abstração sem uso concreto (KISS).

```
// Não conforme
export function createSubagentsRepository() { return { list, create, ... } }
```

```
// Conforme
export function listSubagents() { ... }
export function createSubagent(...) { ... }
```

#### Exceções
Factory justificada por fake injetável em teste **e** segunda implementação real.

---

<a id="rc-artifacts-userdata"></a>

### Artefatos de turno ficam sob userData
Esforço: 45 minutos  
Classificação: Alto  
Stack: `Node.js`  
Tipo corrigido: `artifacts-outside-userdata`

#### Por que isso é um problema?
Escrever anexos/worktree fora de `app.getPath('userData')` (ou vazar para `project.path` em modo worktree) quebra o contrato F13 e polui o repo do usuário.

```
// Não conforme
writeFileSync(join(project.path, '.engrenacode-tmp', file), data)
```

```
// Conforme
writeFileSync(join(userData, 'turns', threadId, file), data)
```

#### Exceções
Diffs aplicados de propósito no working tree / worktree do projeto após Accept.

---

<a id="rc-http-body-type-trust"></a>

### Estreite cada campo do JSON na fronteira HTTP
Esforço: 1–2 horas (handlers afetados + testes)  
Classificação: Alto / Crítico  
Stack: `Node.js`  
Tipo corrigido: `http-body-type-trust`

#### Por que isso é um problema?
`parseBody<T>` só tipa em compile-time. Em runtime o body é `unknown`. Confiar em `data.name` como `string` e chamar `.trim()` no repositório transforma payload malicioso/malformado em `TypeError` → 500, em vez de 400 `invalid_request`.

```
// Não conforme
const data = parseBody<SkillCreateInput>(await readBody(req))
if (data === null) return sendError(...)
skillsRepository.create(data) // data.name pode ser number
```

Valide `typeof` (e enums/limites) no handler antes do repositório, no padrão de `rules-handler` create.

```
// Conforme
if (typeof data.name !== 'string' || typeof data.content !== 'string') {
  return sendError(res, 400, 'invalid_request', '...')
}
```

#### Exceções
Rotas públicas deliberadas (unlock) ainda validam tipos, só dispensam `guard`. Campos opcionais ausentes (`undefined`) diferem de presentes com tipo errado — aceite ausência; rejeite tipo errado.

---

<a id="rc-error-message-path-leak"></a>

### Não propague Error.message cru ao cliente HTTP
Esforço: 20 minutos  
Classificação: Alto / Crítico  
Stack: `Node.js`  
Tipo corrigido: `error-message-path-leak`

#### Por que isso é um problema?
Mensagens de FS/`renameSync`/`ENOENT` costumam carregar paths absolutos do usuário. Expor isso no JSON viola privacidade e o contrato de erro estável (`{ error: { code, message } }` com copy PT-BR controlada).

```
// Não conforme
sendError(res, 500, 'codegraph_index_failed', `Falha: ${err.message}`)
```

Logue o erro no console do main; responda mensagem genérica (ou passe por sanitizer).

```
// Conforme
console.error('[codegraph]', err)
sendError(res, 500, 'codegraph_index_failed', 'Falha ao indexar o CodeGraph.')
```

#### Exceções
Erros de domínio já mapeados com `code` + mensagem canônica (ex.: `rule_not_found`) podem ir ao cliente. Nunca interpolar `err.message` de Node/`fs`/`child_process` sem sanitização.

---

<a id="rc-http-unhandled-hang"></a>

### Todo handler async precisa catch que fecha a resposta
Esforço: 45 minutos  
Classificação: Alto / Crítico  
Stack: `Node.js`  
Tipo corrigido: `http-unhandled-hang`

#### Por que isso é um problema?
Se a Promise do handler rejeita sem `try/catch` e sem catch no `createServer`, headers podem nunca ser enviados e o cliente fica pendurado. Outros handlers do repo já usam catch + 500.

```
// Não conforme
async function handleStatus(req, res) {
  sendJson(res, 200, getStatus()) // getStatus() pode throw
}
```

Envolva o corpo em try/catch (local e/ou no topo do server) e chame `sendError` se `!res.headersSent`.

```
// Conforme
try {
  sendJson(res, 200, getStatus())
} catch (err) {
  console.error('[memory]', err)
  if (!res.headersSent) sendError(res, 500, 'internal_error', '...')
}
```

#### Exceções
Nenhuma para handlers registrados no loopback 5174.

---

<a id="rc-ws-auth-status-collapse"></a>

### Distinga vault_locked (423) de unauthorized (401) no upgrade WS
Esforço: 20 minutos  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `ws-auth-status-collapse`

#### Por que isso é um problema?
O `guard` HTTP emite 423 com cofre travado e 401 com sessão inválida. Colapsar ambos em 401 no WS impede o renderer de redirecionar/tratar lock de forma coerente com o resto da API.

```
// Não conforme
if (vaultService.isLocked() || !tokenOk) {
  socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
}
```

Espelhe a ordem do `guard`: locked → 423; token inválido → 401.

```
// Conforme
if (vaultService.isLocked()) { /* 423 */ return }
if (!tokenOk) { /* 401 */ return }
```

#### Exceções
Nenhuma; mesmo que o cliente WS ignore body, o status HTTP do handshake importa.

---

<a id="rc-ipc-numeric-bounds"></a>

### Números IPC perigosos precisam de faixa finita
Esforço: 20 minutos  
Classificação: Médio  
Stack: `Electron`  
Tipo corrigido: `ipc-numeric-bounds`

#### Por que isso é um problema?
`typeof x === 'number'` aceita `NaN`, `Infinity` e negativos. Dimensões de PTY inválidas quebram o host ou o driver nativo.

```
// Não conforme
if (typeof cols !== 'number' || typeof rows !== 'number') return { ok: false }
```

Exija `Number.isFinite`, inteiro e faixa (ex. 1–500).

```
// Conforme
function validDim(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 500 && Number.isInteger(n)
}
```

#### Exceções
Flags booleanas e enums string não usam esta regra; continuam com narrowing próprio.

---

<a id="rc-error-code-vocabulary-drift"></a>

### Um caso semântico, um error.code
Esforço: 45 minutos  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `error-code-vocabulary-drift`

#### Por que isso é um problema?
O renderer e os testes acoplam-se a `error.code`. Body JSON inválido como `invalid_json` num handler e `invalid_request` noutro quebra contratos e complica agentes/UI.

```
// Não conforme
sendError(res, 400, 'invalid_json', '...')   // skills
sendError(res, 400, 'invalid_request', '...') // rules
```

Padronize o código canônico do repo (`invalid_request` para body/campos inválidos) e alinhe testes.

```
// Conforme
sendError(res, 400, 'invalid_request', 'Corpo inválido.')
```

#### Exceções
Códigos de domínio específicos (`rule_name_conflict`, `vault_corrupted`) permanecem distintos — a regra cobre sinônimos do mesmo caso genérico.

---

<a id="rc-http-body-size-unbounded"></a>

### Limite o tamanho do body no transport compartilhado
Esforço: 30 minutos  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `http-body-size-unbounded`

#### Por que isso é um problema?
`readBody` que concatena o stream inteiro sem teto permite pressão de memória (ex.: base64 enorme), mesmo em loopback.

```
// Não conforme
for await (const chunk of req) chunks.push(chunk)
return Buffer.concat(chunks).toString('utf8')
```

Aborte acima de um teto alinhado aos limites de imagem/composer; responda 413/`payload_too_large`.

```
// Conforme
if (total > MAX_BODY_BYTES) { /* destroy + 413 */ }
```

#### Exceções
Nenhuma no transport compartilhado; rotas que precisem de upload maior devem ter teto explícito e documentado.

---

<a id="rc-partial-destructive-effect"></a>

### Efeito destrutivo em lote: tudo-ou-nada ou compensação
Esforço: 1 hora  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `partial-destructive-effect`

#### Por que isso é um problema?
Marcar itens no DB como rejeitados enquanto `discardFile` ainda pode falhar deixa estado inconsistente (DB diz rejected, arquivo ainda no working tree).

```
// Não conforme
for (const id of ids) {
  discardFile(path)
  markRejected(id) // se o próximo discard falhar, já houve efeito parcial
}
```

Descarte todos os arquivos primeiro; só então persista status — ou use transação/compensação explícita.

```
// Conforme
for (const f of files) discardFile(f)
for (const id of ids) markRejected(id)
```

#### Exceções
Operações idempotentes onde retentar o restante é seguro e o status parcial é documentado na API.

---

<a id="rc-error-message-locale"></a>

### Mensagens de erro ao usuário em PT-BR
Esforço: 5 minutos  
Classificação: Baixo  
Stack: `Node.js`  
Tipo corrigido: `error-message-locale`

#### Por que isso é um problema?
O produto contrato copy em português. Envelope `Not found` em inglês quebra consistência da UI e de `copy.md`.

```
// Não conforme
sendError(res, 404, 'not_found', 'Not found')
```

```
// Conforme
sendError(res, 404, 'not_found', 'Rota não encontrada.')
```

#### Exceções
Logs de console do processo main podem permanecer em inglês. Códigos (`not_found`) permanecem em inglês.

---

<a id="rc-layer-inversion"></a>

### Módulo de domínio não importa handler HTTP
Esforço: 30 minutos  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `layer-inversion`

#### Por que isso é um problema?
Handlers HTTP são a borda do loopback. Um módulo de domínio/runner que importa um handler puxa a fronteira para dentro da lógica de turno (ESM avalia o módulo inteiro) e inverte a direção esperada handler → serviço.

```
// Não conforme
// runner/dispatch.ts
import { DEFAULT_PROMPT } from '../http/config-handler.js'
```

Mova constantes compartilhadas para um módulo neutro de domínio (sem `IncomingMessage`/`ServerResponse`) e importe dos dois lados.

```
// Conforme
// services/config/defaults.ts
export const DEFAULT_PROMPT = '...'

// http/config-handler.ts e runner/dispatch.ts
import { DEFAULT_PROMPT } from '../config/defaults.js'
```

#### Exceções
`import type` de tipos compartilhados colocados de propósito num arquivo de contrato (sem side effects) é aceitável. Import de valor de `*-handler.ts` a partir de runner/db/git não é.

---

<a id="rc-export-should-be-local"></a>

### Não exporte símbolo sem consumidor de produção
Esforço: 10 minutos  
Classificação: Baixo  
Stack: `Node.js`  
Tipo corrigido: `export-should-be-local`

#### Por que isso é um problema?
Export público amplia a superfície da API interna e congela nomes/assinaturas sem necessidade. Se só o próprio módulo (e testes via API pública) usam a função, ela deve ser local.

```
// Não conforme
export function estimateBase64ByteLength(s: string): number { ... }
// só chamada no mesmo arquivo em produção
```

Remova o `export` ou extraia para módulo compartilhado só quando um segundo consumidor de produção existir.

```
// Conforme
function estimateBase64ByteLength(s: string): number { ... }
```

#### Exceções
Export usado apenas por testes irmãos via a API pública do módulo (testando comportamento observável) pode permanecer se a função for parte do contrato documentado. Preferência: testar via função pública que a encapsula.

---

<a id="rc-business-rule-in-tsx"></a>

### Extraia regra de `.tsx` para `*.logic.ts` testável
Esforço: 1–2 horas por tela  
Classificação: Alto  
Stack: `React`  
Tipo corrigido: `business-rule-in-tsx`

#### Por que isso é um problema?
`vitest.config.ts` só inclui `src/**/*.test.ts`. Validação, filtro e formatação vivos no `.tsx` nascem sem cobertura possível e forçam smoke para regressão trivial.

```
// Não conforme — ConfiguracaoScreen.tsx
function validateGithubToken(token: string) { return token.startsWith('ghp_') }
```

Extraia para `*.logic.ts` + `*.logic.test.ts`; o `.tsx` só renderiza e chama.

```
// Conforme — configuracaoScreen.logic.ts
export function validateGithubToken(token: string): boolean { ... }
```

#### Exceções
Wiring puro de evento (`onClick={() => service.save()}`), JSX e composição visual. Formatação one-liner já coberta por lógica compartilhada importada conta como conforme.

---

<a id="rc-missing-sibling-test"></a>

### Módulo que exige teste precisa de `*.test.ts` irmão
Esforço: 1–3 horas por módulo  
Classificação: Alto  
Stack: `Vitest` (cobre testes de Node.js / SQLite / React logic)  
Tipo corrigido: `missing-sibling-test`

#### Por que isso é um problema?
Cobertura só “de fora” (handler exercita repo) deixa gaps em constraints, ordenação e erros do módulo. Regressões locais passam despercebidas.

```
// Não conforme
// messages.ts existe; messages.test.ts não
```

Adicione irmão cobrindo happy path + conflitos/`code` de erro relevantes.

```
// Conforme
// messages.ts + messages.test.ts
```

#### Exceções
Arquivos só de tipos (`provider-types.ts`), wrappers de uma linha já cobertos pelo consumidor com asserção direta, e `main`/`preload` (viram smoke). Infra `client.ts` pode viver via testes de repositório se o schema for exercitado.

---

## 5. Fora de escopo / dívida consciente

| Item | Estado 2026-08-08 |
|------|-------------------|
| Remediação dos achados abertos (A01/A02, R01-R11, D01-D06, D08) | **Concluída** nesta passagem (working tree, sem commit) — ver §4 C18-C30 |
| Smoke-results F20/F21/F23/F26 | Débito de entrega confirmado (D07) — único item ainda aberto |
| Polling do Dashboard vs hub WS por thread | Justificado (sem evento agregado) — não flag |
| Servidores `listen(0)` por turno (MCP/OAuth/ask-user/memory) | Por design |
| `AUDIT-PRD-S9-MIGRATION.md` | Encerrada; não reabrir como matriz de código |

### Fatiamento sugerido (para D07, único item aberto)

Rodar smoke real via `playwright-cli` + Electron para F20 (memória persistente), F21 (askUserQuestion), F23 (providers GLM/Grok) e F26 (terminal PTY dock); gravar `docs/F<ID>-*/smoke-results.md` com passos e evidência de tema light/dark + copy.

---

## 6. Como atualizar este artefato

Use a skill [`.claude/skills/audit-full-base/SKILL.md`](../.claude/skills/audit-full-base/SKILL.md): rode as 3 reviews em sequência, mova itens corrigidos da §2 para a §4 (com commit), dedupe regras por Stack, atualize contagens e a data no cabeçalho.

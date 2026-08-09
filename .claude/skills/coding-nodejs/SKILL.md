---
name: coding-nodejs
description: >-
  Aplica os padrões de Node.js do EngrenaCode (handlers HTTP loopback, vault,
  runner, git, vcs, mcps, codegraph) e as lições já registradas em auditoria —
  guard 423/401, narrowing de body, erro sem path leak, catch obrigatório,
  segredo só no vault, redação completa de stderr — para não repetir erros de
  fronteira ou robustez. Use ao escrever ou editar código em src/services/http/,
  vault/, runner/, git/, vcs/, mcps/, codegraph/ ou process-error.
---

# Coding — Node.js

Guia proativo para **escrever** código de serviço/handler. Não é review (isso é `review-architecture`/`review-robustness`): aplique antes de o código existir.

Fonte de verdade: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (Stack `Node.js`) + `CLAUDE.md` → "HTTP · Guard". A lista de abertos abaixo é **espelho** da última passagem — releia o código antes de agir sobre um item.

## Padrões obrigatórios em handler HTTP novo

Referência viva: `src/services/http/rules-handler.ts` (padrão do `create`) + `_transport.ts`.

1. `guard(req, res)` primeiro, sempre nesta ordem: `vaultService.isLocked()` → **423** `vault_locked`; header `x-engrenacode-session` ausente/divergente → **401** `unauthorized`. Cofre travado nunca some atrás de 401.
2. Handler só reivindica rota do seu domínio — `return false` para path que não é dele, nunca `true`/401 para prefixo alheio (isso sombreia o handler dono na cadeia).
3. `parseBody<T>` só tipa em compile-time; o body real é `unknown`. **Estreite todo campo com `typeof` explícito** antes de tocar o repositório (`typeof data.name !== 'string'` → 400 `invalid_request`). Nunca `data as SubagentInput` / cast pós-parse sem narrowing.
4. Envolva o corpo async em `try/catch`; se `!res.headersSent`, responda `sendError(res, 500, 'internal_error', ...)`. Promise que rejeita sem catch pendura o request.
5. Nunca interpole `err.message` de `fs`/`child_process`/`ENOENT` (carrega path absoluto) no JSON de erro — `console.error('[<módulo>]', err)` + mensagem genérica em PT-BR.
6. Um `error.code` por caso semântico em todo o repo (`invalid_request` para body/campo inválido; não invente `invalid_json` num handler novo).
7. `readBody` (transport compartilhado) já tem teto de tamanho — rota que aceite payload maior (imagem, anexo) declara teto explícito próprio, nunca sem limite.
8. Efeito destrutivo em lote é tudo-ou-nada: aplique o efeito em disco/processo em todos os itens antes de persistir qualquer status no DB — nunca marque status e só depois arrisque falhar o efeito real no meio do loop.
9. Mensagem de erro ao usuário em PT-BR sempre (`{ error: { code, message } }`), inclusive CORS (`cors_denied`) e catch-all 404 — logs de console do main podem ficar em inglês.
10. Handlers compartilham `guard`/`parseBody`/`sendJson`/`sendError`/`readBody` de `_transport.ts` — repetir esse boilerplate entre handlers é o padrão aceito; a **divergência** entre eles (status diferente, header renomeado, ordem 423/401 trocada) é o bug.

## Outros padrões obrigatórios

- Domínio (`runner/`, `db/`, `git/`, `vcs/`) **nunca importa de `*-handler.ts`**. Constante/config compartilhada vai para um módulo neutro (`services/<domínio>/defaults.ts` ou `vault/provider-keys.ts`) importado dos dois lados.
- Não exporte símbolo sem consumidor de produção fora do próprio arquivo — mantenha local até existir um segundo consumidor real (ex.: após F24, `injectTokenIntoHttpsUrl` ficou órfã; `ByKind` é a API).
- Endpoint OAuth/remoto só abre `https://`, validado com `typeof === 'string' && url.startsWith('https://')`.
- Envelope de vault estruturalmente ilegível → `422 vault_corrupted`; senha errada continua `{ unlocked: false }` — nunca colapse os dois.
- CORS do loopback só origens locais (`127.0.0.1`/`localhost`/`null` de `file://`); nunca `Access-Control-Allow-Origin: *`. `Access-Control-Allow-Methods` precisa listar **todo** método que algum handler roteado por `createUnlockServer` usa — a Electron renderer window faz preflight real de qualquer `fetch`, então um método faltando (ex.: `PATCH`) quebra a feature em produção, não só em teste sem preflight.
- **`401`/`423` são vocabulário reservado para "sessão do EngrenaCode inválida"/"vault travado"** (`api-client.ts` trata qualquer `401` de qualquer endpoint como motivo para relockar o vault inteiro). Erro de credencial de provider terceiro (GLM/Grok/OpenAI/Groq/Minimax rejeitando a key) nunca usa `401`/`423` — use `200` com `success:false` no corpo se o endpoint for um "test connection" (padrão `handleGlmTest`/`handleGrokTest`), ou um 4xx não reservado (`422`) se for uma ação que pode falhar por credencial (padrão `voice-handler.ts`).
- **Stderr / message que pode chegar à UI passa por `sanitizeProcessError`.** Ao adicionar esquema de credencial em URL (F24: `oauth2:`, `x-token-auth:`, `https://:<token>@`) ou prefixo de provider (`xai-`, `gsk_`, `sk-ant-`, …), **atualize o sanitizer no mesmo diff** e cubra com teste que falha se o segredo sobreviver. Preferência: redigir userinfo HTTPS genérico (`https://[^/@\s]*:[^/@\s]+@` → `https://***@`), não só `x-access-token:`.
- Artefato de turno (anexo, worktree temporário) sempre sob `app.getPath('userData')`; nunca em `project.path` fora do fluxo de Accept explícito no working tree.
- Escrita do `vault.enc` é atômica: `writeFileSync(tmpPath, ...)` + `renameSync(tmpPath, vaultPath)`. Nunca write in-place no blob principal.
- Segredo (chave de provider, credencial de MCP/VCS) só no vault. Nunca em coluna SQLite, arquivo do projeto, `.env` commitado ou resposta HTTP — endpoint de config expõe só status "configurada", nunca o valor.
- Upgrade WS: vault travado → 423 antes de token inválido → 401. Autentique via subprotocol; **não** aceite `?token=` na query (vaza em logs/proxy/histórico).
- Validação de formato de key/token vive em módulo puro (`vault/provider-keys.ts`, `http/github-token.ts`). Handler importa dali; o renderer também (ver `coding-react`) — não re-declare literals no handler.

## Erros já registrados aqui — não repita

Abertos: nenhum nesta Stack.

Já corrigidos — não regrida:

- `RC-error-message-locale-residual` — `cors_denied` responde `'Origem não permitida.'`; toda message de erro voltada ao usuário nasce em PT-BR, inclusive CORS e catch-all.
- `RC-ws-query-token-legacy` — `ws-upgrade.ts` autentica **só** por subprotocol; não reintroduza fallback `?token=` na query.
- `RC-http-body-narrowing-gap` — `subagents-handler.ts` estreita `model`/`reasoningLevel`/`category`/`tools`/`enabled` antes de `createSubagent`; nunca volte ao `data as SubagentInput`.
- `RC-dead-export` — `injectTokenIntoHttpsUrl` e `vcs/oauth.getTokens` deixaram de ser exportados. Export novo só com consumidor de produção fora do próprio arquivo.
- `RC-vcs-url-redaction` — `process-error.ts` redige userinfo HTTPS genérico (`oauth2:`, `x-token-auth:`, `https://:<token>@`) + `xai-`/`gsk_`, com teste por scheme. A ordem importa: o encurtamento de path roda **antes** da redação, e o padrão de senha exclui `*` inicial para não comer o marcador `x-access-token:***@`. Não reordene nem "simplifique" essas regex.
- `RC-guard-423`, `RC-route-claim`, `RC-unlock-validate`, `RC-oauth-https`, `RC-vault-corrupted`, `RC-cors-local`, `RC-shared-transport`, `RC-sanitize-stderr`, `RC-artifacts-userdata`, `RC-atomic-vault`, `RC-http-body-type-trust` (skills/rules/config), `RC-error-message-path-leak`, `RC-http-unhandled-hang`, `RC-ws-auth-status-collapse`, `RC-error-code-vocabulary-drift`, `RC-http-body-size-unbounded`, `RC-partial-destructive-effect`, `RC-error-message-locale` (404 unlock), `RC-layer-inversion`, `RC-export-should-be-local` (`estimateBase64ByteLength` local em `composer-images.ts`; a cópia exportada em `voice/voice-audio.ts` é duplicação conhecida — ao tocar as duas, unifique num módulo puro em vez de criar uma terceira).
- `RC-cors-methods-allowlist-gap` — `unlock-handler.ts` listava só `GET, POST, PUT, DELETE, OPTIONS` em `Access-Control-Allow-Methods`; faltava `PATCH` (usado por `memory-handler.ts`), quebrando o toggle de Memória (F20) em produção — achado ao vivo em smoke real, não em teste unitário (que chama o handler direto, sem preflight). Ao adicionar handler com método novo, atualize o allowlist no mesmo diff.
- `RC-http-status-code-collision` — `voice-handler.ts` respondia `401` para `voice_auth_error` (key de voz rejeitada pelo provider); como `401` é reservado app-wide para sessão do vault, isso derrubava a sessão inteira do usuário. Corrigido para `422`. Achado ao vivo em smoke real (gravação de mic real + key falsa) — o `catch` genérico do renderer não expôs o sintoma até a sessão cair de verdade.

## Se encontrar um padrão novo

Se um erro não listado aqui aparecer no caminho, registre em `docs/AUDIT-CODE-REVIEW.md` (via `audit-full-base`) ou, se for regra transferível e não-óbvia, em `CLAUDE.md` no formato `Origem · Categoria · [Sempre/Nunca] X porque Y`.

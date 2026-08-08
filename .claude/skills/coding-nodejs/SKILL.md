---
name: coding-nodejs
description: >-
  Aplica os padrões de Node.js do EngrenaCode (handlers HTTP loopback, vault,
  runner, git, mcps, codegraph) e as lições já registradas em auditoria —
  guard 423/401, narrowing de body, erro sem path leak, catch obrigatório,
  segredo só no vault — para não repetir erros de fronteira ou robustez. Use
  ao escrever ou editar código em src/services/http/, vault/, runner/, git/
  ou mcps/.
---

# Coding — Node.js

Guia proativo para **escrever** código de serviço/handler. Não é review (isso é `review-architecture`/`review-robustness`): aplique antes de o código existir. É a Stack com mais achados abertos na auditoria — leia por completo antes de tocar um handler novo.

Fonte: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (Stack `Node.js`) + `CLAUDE.md` → "HTTP · Guard".

## Padrões obrigatórios em handler HTTP novo

Referência viva: `src/services/http/rules-handler.ts` (padrão do `create`).

1. `guard(req, res)` primeiro, sempre nesta ordem: `vaultService.isLocked()` → **423** `vault_locked`; header `x-engrenacode-session` ausente/divergente → **401** `unauthorized`. Cofre travado nunca some atrás de 401.
2. Handler só reivindica rota do seu domínio — `return false` para path que não é dele, nunca `true`/401 para prefixo alheio (isso sombreia o handler dono na cadeia).
3. `parseBody<T>` só tipa em compile-time; o body real é `unknown`. **Estreite todo campo com `typeof` explícito** antes de tocar o repositório (`typeof data.name !== 'string'` → 400 `invalid_request`). Nunca confie na anotação de tipo do body.
4. Envolva o corpo async em `try/catch`; se `!res.headersSent`, responda `sendError(res, 500, 'internal_error', ...)`. Promise que rejeita sem catch pendura o request.
5. Nunca interpole `err.message` de `fs`/`child_process`/`ENOENT` (carrega path absoluto) no JSON de erro — `console.error('[<módulo>]', err)` + mensagem genérica em PT-BR.
6. Um `error.code` por caso semântico em todo o repo (`invalid_request` para body/campo inválido; não invente `invalid_json` num handler novo).
7. `readBody` (transport compartilhado) já tem teto de tamanho — rota que aceite payload maior (imagem, anexo) declara teto explícito próprio, nunca sem limite.
8. Efeito destrutivo em lote é tudo-ou-nada: aplique o efeito em disco/processo em todos os itens antes de persistir qualquer status no DB — nunca marque status e só depois arrisque falhar o efeito real no meio do loop.
9. Mensagem de erro ao usuário em PT-BR sempre (`{ error: { code, message } }`); logs de console do main podem ficar em inglês.
10. Handlers compartilham `guard`/`parseBody`/`sendJson`/`sendError`/`readBody` de `_transport.ts` — repetir esse boilerplate entre handlers é o padrão aceito; a **divergência** entre eles (status diferente, header renomeado, ordem 423/401 trocada) é o bug.

## Outros padrões obrigatórios

- Domínio (`runner/`, `db/`, `git/`) **nunca importa de `*-handler.ts`**. Constante/config compartilhada vai para um módulo neutro (`services/<domínio>/defaults.ts`) importado dos dois lados.
- Não exporte símbolo sem consumidor de produção fora do próprio arquivo — mantenha local até existir um segundo consumidor real.
- Endpoint OAuth/remoto só abre `https://`, validado com `typeof === 'string' && url.startsWith('https://')`.
- Envelope de vault estruturalmente ilegível → `422 vault_corrupted`; senha errada continua `{ unlocked: false }` — nunca colapse os dois.
- CORS do loopback só origens locais (`127.0.0.1`/`localhost`/`null` de `file://`); nunca `Access-Control-Allow-Origin: *`.
- Stderr de processo (CLI/provider) passa por `sanitizeProcessError` antes de qualquer timeline/UI — nunca cru.
- Artefato de turno (anexo, worktree temporário) sempre sob `app.getPath('userData')`; nunca em `project.path` fora do fluxo de Accept explícito no working tree.
- Escrita do `vault.enc` é atômica: `writeFileSync(tmpPath, ...)` + `renameSync(tmpPath, vaultPath)`. Nunca write in-place no blob principal.
- Segredo (chave de provider, credencial de MCP) só no vault (`vault/provider-keys.ts`, `runner/mcp-secrets.ts`). Nunca em coluna SQLite, arquivo do projeto, `.env` commitado ou resposta HTTP — endpoint de config expõe só status "configurada", nunca o valor.
- Upgrade WS espelha a mesma ordem do `guard` HTTP: vault travado → 423 antes de token inválido → 401 (não colapse ambos em 401 no handshake).

## Erros já registrados aqui — não repita

Abertos nesta auditoria (corrija ao tocar o arquivo, não espere um lote):

- `R-http-body-type-trust` — `skills-handler.ts:43-62` (create/update sem `typeof`), `config-handler.ts:218-239,311-313` (`prompt`/keys sem narrowing), `rules-handler.ts:48-50` (update sem `typeof`, create já valida). Aplique o padrão 3 acima ao tocar qualquer um.
- `R-error-message-path-leak` — `codegraph-handler.ts:23-26` interpola `err.message` cru no `sendError`.
- `R-http-unhandled-hang` — `memory-handler.ts:56-77`, `codegraph-handler.ts:35-38`, topo do `createServer` em `unlock-handler.ts` sem catch que fecha a resposta.
- `R-ws-auth-status-collapse` — `ws-upgrade.ts:30-32` responde 401 tanto para vault travado quanto para token inválido.
- `R-error-code-vocabulary-drift` — `invalid_json` (skills) vs `invalid_request` (rules) para o mesmo caso.
- `R-http-body-size-unbounded` — `_transport.ts:21-29` concatena o stream sem teto.
- `R-partial-destructive-effect` — `apply-diff.ts:77-87` marca `rejected` no DB mesmo se `discardFile` do próximo item falhar no meio do loop.
- `R-error-message-locale` — `unlock-handler.ts:294-295` responde `Not found` em inglês no catch-all 404.
- `R-layer-inversion` — `runner/dispatch.ts:45` importa `DEFAULT_PROMPT` de `config-handler.ts` (handler HTTP).
- `R-export-should-be-local` — `composer-images.ts:26` exporta `estimateBase64ByteLength` sem consumidor de produção fora do arquivo.

Já corrigidos — não regrida:

- `RC-guard-423`, `RC-route-claim`, `RC-unlock-validate`, `RC-oauth-https`, `RC-vault-corrupted`, `RC-cors-local`, `RC-shared-transport`, `RC-sanitize-stderr`, `RC-artifacts-userdata`, `RC-atomic-vault`.

## Se encontrar um padrão novo

Se um erro não listado aqui aparecer no caminho, registre em `docs/AUDIT-CODE-REVIEW.md` (via `audit-full-base`) ou, se for regra transferível e não-óbvia, em `CLAUDE.md` no formato `Origem · Categoria · [Sempre/Nunca] X porque Y`.

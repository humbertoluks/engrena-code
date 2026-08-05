# F09 Smoke Results — OAuth Connect live

**Feature:** F09 MCPs — verificação adicional (catálogo/CRUD já tinham smoke confirmado; esta rodada fecha especificamente o OAuth live)
**Data:** 2026-08-05 (~19:03–19:04 BRT + confirmação ~19:09 BRT)
**Ambiente:** `pnpm dev` (Electron real) com `ENGRENACODE_USER_DATA=%TEMP%\engrena-smoke-onda-final` + API direta (`curl`) para start/status + browser real do usuário para o consentimento
**Vendor:** Linear (`authMode: oauth`, preset não-experimental, DCR automático)

## Fluxo real (Conectar → browser → Conectado)

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| 1 | Instalar preset `linear` do catálogo (`POST /api/mcp-catalog/linear/install`) | MCP criado, `oauthStatus: disconnected` | pass |
| 2 | Iniciar OAuth (`POST /api/mcps/:id/oauth/start`) | `authorizeUrl` com DCR (`client_id` gerado), PKCE S256, loopback `127.0.0.1:518x/callback` | pass — `client_id=CsE93s5vJuVrC74p`, discovery RFC 8414 resolvido, sem cadastro manual de app |
| 3 | Consentimento manual do usuário no browser | tela "EngrenaCode is requesting access" com Approve/Cancel | pass — client_name `EngrenaCode` correto na tela da Linear |
| 4 | Usuário aprova (ação fora do meu controle — login/senha da conta Linear do usuário) | callback loopback captura `code`, troca por token | pass |
| 5 | Status pós-consentimento (`GET /api/mcps/:id/oauth/status`) | `connected` | pass |
| 6 | UI `#mcps` | card mostra badge "Conectado" (verde) + botão "Desconectar" | pass — `f09-mcps-linear-connected.png` |
| 7 | Token não vaza no SQLite/API | resposta de status e de listagem nunca incluem token bruto, só `oauthStatus`/`oauthClientId` | pass — confirmado no payload de `GET /api/mcps` |
| 8 | Vínculo do MCP conectado a um projeto real | `PUT /api/projects/:id/mcps/:mcpId` → `needsCredential: false` | pass |

## Notas

- O client é self-registrado via Dynamic Client Registration (RFC 7591) no momento do `start` — nenhuma credencial de app OAuth pré-cadastrada foi necessária para a Linear.
- Passo 3–4 exigiu ação manual do usuário (login na própria conta Linear); não é automatizável nem deveria ser (credencial de terceiro).
- Vendor único testado (Linear) serve como evidência representativa: os outros 3 presets OAuth do catálogo (Notion, Asana, Sentry) usam exatamente o mesmo mecanismo genérico (`src/services/mcps/oauth.ts`), sem lógica específica por vendor.

## Critérios PRD §9

| Critério | Status |
|----------|--------|
| Secret ausente omite MCP sem abortar o turno | já **pass** (smoke anterior) |
| OAuth Connect funciona em server suportado | **pass** (nesta rodada, Linear, ponta a ponta) |

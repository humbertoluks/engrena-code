# F30. Avisos de runtime e permissão — Plano de implementação

**Feature:** F30 Avisos de runtime e permissão  
**Complexidade:** simples  
**UI:** `ui.md` / `copy.md` desta pasta  

---

## Prerequisites

- F02 (`#configuracao`, probe de CLIs) e F03 (tarja, gate, `PermissionPrompt`) feitos.
- `readClaudeCliVersion`, `checkClaudeCliVersion`, `announceClaudeCliVersionOnce` e `PERMISSION_TIMEOUT_MS` já existem. Esta feature não os redesenha; só muda destino da copy e um campo opcional no probe.
- Fonte de verdade de UX: `ui.md` e `copy.md` desta pasta. Card/chips: `docs/F03-workspace/copy.md`.

---

## Fase 1 — Versão do CLI fora da tarja

1. **Log sem WS** - Fazer `announceClaudeCliVersionOnce` gravar `log_entries` e **não** emitir `cli.version_notice`. Ajustar o teste do notice para provar ausência de emit.

2. **Renderer sem kind de UI** - Remover o branch `cli.version_notice` em `usePrincipalWorkspace`. `streamNotices.logic` deixa de produzir notice de tarja para versão; `cliVersionNoticeMessage` longo fica só se ainda servir o log (o log já tem `claudeCliVersionLogLine`). Limpar testes D3 da tarja.

3. **Caption na Config** - No probe full do Claude, preencher `version` / `versionStatus` via cache `readClaudeCliVersion` + `checkClaudeCliVersion`. `GET /api/config/status` permanece PATH-only. A `CliRow` do Claude renderiza as captions de `copy.md`.

## Fase 2 — Expiry como evento de produto

4. **Copy da tarja** - Reescrever `nativeDenialMessage` com os ids de `copy.md`. `decisionReason*` sai da tarja. `cliVersionStatus` só acrescenta `denial.never.cliCause` no caso never-brokered. O runner anexa esse campo quando o cache já tiver leitura.

5. **Countdown no card** - `PermissionPrompt` mostra `remainingLabel(expiresAt)` no header, amber nos últimos 15 s, conforme `ui.md`. Helper puro + teste. Não alterar `PERMISSION_TIMEOUT_MS`.

## Fase 3 — Validação e fechamento

6. **Validação e fechamento** - Rodar a estratégia de testes da spec (unitário da copy/countdown/notice + probe Config). `pnpm --filter engrena-code exec tsc -b` e a suíte da área duas vezes se houver spawn/git. Confirmar AC do PRD §9 F30. Light/dark e copy contra `ui.md`/`copy.md`. Smoke: primeiro turno sem tarja de versão; Config mostra a versão; card Bash com relógio; expiry gera só as duas frases curtas.

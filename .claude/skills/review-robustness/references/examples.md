# Exemplos — review-robustness

## Relatório completo (veredito bloqueado)

```
Review Robustez — base completa `src/`
Veredito: bloqueado

🔴 Bloqueia merge
- `src/services/process-error.ts:4-9` — sanitize não redige `oauth2:`/`x-token-auth:`/`https://:<token>@`; o push F24 leva `stderrTail` até a message de `git_push_failed`, exibida em `GitActions`. Correção: redigir userinfo HTTPS genérico + teste que falha se o token sobreviver.

🟡 Ajustar antes de fechar a feature
- `src/services/http/unlock-handler.ts:63` — `cors_denied` com message em inglês. Correção: PT-BR acionável.
- `src/services/http/subagents-handler.ts:61` — `data as SubagentInput` sem `typeof` no handler. Correção: estreitar campo a campo antes do repositório.

🟢 Opcional
- `minimax-driver.ts:87` — 401/403 viram `provider_turn_error` genérico; glm/grok distinguem `provider_auth_error`.

Fronteiras tocadas neste diff:
- HTTP loopback — validada (`guard` 423→401 em `_transport.ts:68`)
- IPC — validada (`shell:open-external` https-only; dims de PTY com faixa finita)
- Spawn / git — gap de redação acima
- Vault / segredo — keys só no vault; endpoint devolve status, não valor

Checklist:
✓ 1. Validação HTTP — `parseBody` null → 400; `typeof` por campo em rules/skills/config
✓ 2. IPC / FS / spawn — allowlist https; worktree sob userData
✓ 3. Tipagem estrita — `rg ": any|as any|<any>" src` sem acertos
✓ 4. Duplicação — validação de key importada de `provider-keys.ts` nos dois lados
✗ 5. Erro útil — CORS em inglês
✗ 6. Segredo — sanitizer incompleto para schemes F24

Não verificado:
- Forma exata do stderr do `git` por host/OS em runtime
```

## Achados 🔴 típicos deste repo

```
- `configuracaoScreen.logic.ts:11` — regra de formato de key re-declarada com literals. Correção: importar `validateGrokKey` de `vault/provider-keys.ts`.
- `src/services/http/foo-handler.ts:40` — `err.message` de `fs` interpolado no JSON de erro (path absoluto do usuário). Correção: `console.error` + message genérica PT-BR.
- `src/renderer/hooks/useFoo.ts:22` — `.catch(() => {})`. Correção: log + estado de erro visível com retry.
```

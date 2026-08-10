---
name: coding-nodejs
description: >-
  Applies portable Node.js service patterns for local HTTP handlers, vault,
  runners, git/VCS, and process error redaction: guard order, body narrowing,
  secrets only in vault, atomic vault writes, and no layer inversion. Use when
  writing or editing HTTP handlers, vault, runner, git, VCS, MCP, or
  process-error modules. Read rules/*.md for the matched concern; read
  project.md for this repository's path and audit bindings.
---

# Coding — Node.js

Guia proativo para **escrever** código de serviço/handler. Não é review (`review-architecture` / `review-robustness`): aplique antes de o código existir.

**Camadas:** `SKILL.md` (roteamento) · `rules/*.md` (regras portáveis) · `project.md` (bindings deste repo).

## When to Apply

- Novo handler HTTP ou mudança em guard/CORS/body
- Vault, spawn de CLI, git push, OAuth, MCP, codegraph
- Redação de stderr / mensagem que chega à UI

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | HTTP handlers | CRITICAL | `http-` |
| 2 | Secrets | CRITICAL | `secret-` |
| 3 | Errors | HIGH | `error-` |
| 4 | Filesystem | HIGH | `fs-` |
| 5 | Layers | MEDIUM | `layer-` |

## Quick Reference

### 1. HTTP (CRITICAL / HIGH)

- `http-guard-order` — Vault lock before session auth
- `http-route-claim` — Claim only your own routes
- `http-body-narrowing` — Narrow every body field
- `http-shared-transport` — Share transport helpers; never diverge
- `http-cors-local-only` — CORS only local origins
- `http-cors-methods-allowlist` — Allow-Methods sync with every verb
- `http-reserved-session-status` — Reserve 401/423 for session/vault
- `http-body-size-limit` — Bound request body size
- `http-error-code-vocabulary` — One stable error code per case
- `http-oauth-https-only` — OAuth URLs must be HTTPS
- `http-pure-validation-module` — Key/token validators in a pure module

### 2. Secrets (CRITICAL)

- `secret-vault-only` — Secrets only in the encrypted vault
- `secret-sanitize-stderr` — Sanitize process stderr before UI
- `secret-ws-subprotocol-auth` — WS auth via subprotocol, not query

### 3. Errors (HIGH)

- `error-async-try-catch` — Wrap async handler bodies
- `error-no-path-leak` — Never leak filesystem paths in API errors
- `error-user-locale` — User-facing errors in product locale

### 4. Filesystem (HIGH)

- `fs-artifacts-under-userdata` — Turn artifacts under userData
- `fs-atomic-vault-write` — Atomic vault write via temp + rename

### 5. Layers (MEDIUM / HIGH)

- `layer-no-handler-imports` — Domain must not import handlers
- `layer-no-dead-exports` — No export without production consumer
- `layer-vault-corrupt-vs-password` — Distinguish corrupt vs wrong password
- `layer-all-or-nothing-destructive` — Destructive batches all-or-nothing

## How to Use

1. Escolha o slug · 2. Leia `rules/<slug>.md` · 3. Paths/`RC-*` deste repo → `project.md` · 4. Achado novo de audit atualiza `project.md`, não a regra portável.

## New rule

Copy `rules/_template.md` → `rules/<prefix>-<slug>.md`. Sections: `rules/_sections.md`.

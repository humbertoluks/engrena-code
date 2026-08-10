---
title: Build PTY environment from an allowlist, not process.env
impact: CRITICAL
impactDescription: inheriting host env exposes provider keys to the dock shell
tags: process, pty, env, secrets
---

## Build PTY environment from an allowlist, not process.env

PTY não herda `process.env` inteiro. Passe allowlist mínima (`PATH`, `HOME`/`USERPROFILE`, `TERM`, locale, `COMSPEC` no Windows, e o estritamente necessário ao shell).

**Incorrect:**

```typescript
pty.spawn(shell, [], { env: process.env })
```

**Correct:**

```typescript
pty.spawn(shell, [], { env: buildPtyEnv(process.env) })
// buildPtyEnv copies only allowlisted keys
```

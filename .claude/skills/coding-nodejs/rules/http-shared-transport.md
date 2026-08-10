---
title: Share transport helpers; never diverge status or header names
impact: HIGH
impactDescription: duplicated guard with swapped order is a silent security bug
tags: http, transport, dry
---

## Share transport helpers; never diverge status or header names

Handlers compartilham `guard` / `parseBody` / `sendJson` / `sendError` / `readBody` de um módulo de transport. Repetir a *chamada* é ok; divergir status, nome de header ou ordem 423/401 entre handlers é o bug.

**Incorrect (guard local com ordem diferente):**

```typescript
// skills-handler.ts
if (!token) return unauthorized(res)
if (vault.isLocked()) return locked(res)
```

**Correct (mesmo helper):**

```typescript
import { guard, parseBody, sendError, sendJson } from './_transport'
if (!guard(req, res)) return true
```

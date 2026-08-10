---
title: Define __dirname via fileURLToPath in ESM main
impact: MEDIUM
impactDescription: ESM main has no native __dirname
tags: build, esm, dirname
---

## Define __dirname via fileURLToPath in ESM main

Main em ESM precisa de `__dirname` via `fileURLToPath(import.meta.url)` — ES modules não exportam `__dirname` nativo.

**Incorrect:**

```typescript
preload: path.join(__dirname, 'preload.cjs') // ReferenceError in ESM
```

**Correct:**

```typescript
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
```

---
title: Keep the preload module as CommonJS
impact: CRITICAL
impactDescription: contextBridge is not exported correctly under ESM preload
tags: preload, commonjs, build
---

## Keep the preload module as CommonJS

Preload permanece CommonJS (`require('electron')`). Nunca converta para `import`/ESM — `contextBridge` não se comporta de forma confiável como entry ESM neste setup.

**Incorrect:**

```typescript
import { contextBridge, ipcRenderer } from 'electron'
```

**Correct:**

```typescript
const { contextBridge, ipcRenderer } = require('electron')
```

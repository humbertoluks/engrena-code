---
title: Never import Node or Electron as values in the renderer
impact: CRITICAL
impactDescription: breaks contextIsolation and leaks host capabilities into the UI process
tags: boundary, isolation, electron, renderer
---

## Never import Node or Electron as values in the renderer

O processo de UI não deve carregar APIs de filesystem, rede ou Electron como valor. Isso anula o isolamento e abre caminho para o renderer tocar o host diretamente.

`import type` de módulos de serviço é aceito. Import de *valor* só se o módulo for puro (sem SQLite, `fs`, spawn ou `electron`).

**Incorrect (Node no renderer):**

```typescript
import { readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export function loadConfig() {
  return readFileSync(join(app.getPath('userData'), 'config.json'), 'utf8')
}
```

**Correct (só tipos ou módulos puros):**

```typescript
import type { ConfigDto } from '../shared/config-types'
import { validateApiKey } from '../shared/provider-keys' // pure module

export function mapConfig(dto: ConfigDto) {
  return { ok: validateApiKey(dto.key) === null }
}
```

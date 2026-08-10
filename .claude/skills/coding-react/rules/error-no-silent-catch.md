---
title: Never swallow fetch errors with empty catch
impact: HIGH
impactDescription: silent failures leave stale UI with no alert or retry
tags: error, catch, feedback
---

## Never swallow fetch errors with empty catch

`.catch(() => {})` engole falha de rede/API: contadores ficam stale, presets vazios, poll eterno, sem `role="alert"`. Logue e leve para estado de erro visível; reabilite o botão após falha. Cancelamento deliberado (`AbortError` por unmount) pode ser silencioso.

**Incorrect:**

```typescript
void loadCatalog().catch(() => {})
void refreshCounts().catch(() => {})
```

**Correct:**

```typescript
try {
  setCatalog(await loadCatalog())
} catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') return
  console.error('[catalog]', err)
  setLoadError('Não foi possível carregar o catálogo.')
} finally {
  setSaving(false)
}
```

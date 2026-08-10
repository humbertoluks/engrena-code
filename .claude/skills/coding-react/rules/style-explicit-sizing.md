---
title: Prefer explicit sizing when theme spacing overrides container scales
impact: MEDIUM
impactDescription: max-w-sm can collapse to spacing tokens instead of container width
tags: style, tailwind, sizing
---

## Prefer explicit sizing when theme spacing overrides container scales

Em setups onde `--spacing-*` alimenta utilitários de sizing e vence `--container-*`, classes como `max-w-sm` / `w-md` colapsam o layout (ex.: `8px`). Use valor explícito (`max-w-[24rem]`) ou token de container dedicado.

**Incorrect:**

```tsx
<div className="max-w-sm w-md">…</div>
```

**Correct:**

```tsx
<div className="max-w-[24rem]">…</div>
```

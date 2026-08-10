---
title: Use only the current product brand in UI copy and component names
impact: MEDIUM
impactDescription: legacy brand strings confuse users and break smoke assertions
tags: style, branding, copy
---

## Use only the current product brand in UI copy and component names

UI, copy, smoke e nomes de componente usam só a marca atual do produto. Nunca reintroduza nomes de marca legada. O mapa marca atual vs. legada fica no `project.md` do repositório.

**Incorrect:**

```tsx
<title>LegacyApp</title>
<span>Powered by OldBrand</span>
```

**Correct:**

```tsx
<title>{PRODUCT_NAME}</title>
<span>Powered by {PRODUCT_NAME}</span>
```

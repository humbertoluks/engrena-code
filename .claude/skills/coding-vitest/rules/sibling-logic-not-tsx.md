---
title: Do not unit-test React components; extract logic modules
impact: HIGH
impactDescription: component tests fight the runner; pure logic does not
tags: sibling, logic, react
---

## Do not unit-test React components; extract logic modules

Se o runner de unit só inclui `*.test.ts` em ambiente Node, `.tsx` **não** é testado como componente. Regra de UI sai para módulo puro com `*.logic.test.ts` (ver `coding-react` → `logic-extract-from-tsx`).

**Incorrect:**

```text
Button.tsx + Button.test.tsx  # jsdom not configured
```

**Correct:**

```text
button.logic.ts + button.logic.test.ts
Button.tsx  # wiring only
```

---
title: Ship a sibling unit test in the same diff as the production module
impact: HIGH
impactDescription: deferring tests leaves permanent coverage gaps
tags: sibling, coverage
---

## Ship a sibling unit test in the same diff as the production module

Todo módulo de produção em camada que exige teste ganha `*.test.ts` irmão no mesmo diff, não depois. Cobertura só "de fora" (via handler) deixa gap em constraint e ordenação do repositório.

**Incorrect:**

```text
repositories/widgets.ts   # merged
# widgets.test.ts "depois"
```

**Correct:**

```text
repositories/widgets.ts
repositories/widgets.test.ts  # same diff
```

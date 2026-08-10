---
name: coding-vitest
description: >-
  Applies portable testing and delivery-evidence patterns: sibling unit tests in
  the same diff, isolated temp userData, HTTP handler fakes, secret-redaction
  regressions, and written smoke evidence for UI acceptance. Use when writing
  *.test.ts, extracting *.logic.ts, adding service modules, or closing a feature
  with UI acceptance criteria. Read rules/*.md for the matched concern; read
  project.md for this repository's path and audit bindings.
---

# Coding — Vitest

Guia proativo de teste e evidência. Não é review (`review-delivery`): aplique antes de considerar módulo/feature pronto.

**Camadas:** `SKILL.md` · `rules/*.md` · `project.md`.

## When to Apply

- Novo módulo de serviço / repositório / handler / `*.logic.ts`
- Correção de bug, extensão de sanitizer, fechamento de feature com UI

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Isolation | CRITICAL | `isolation-` |
| 2 | Regression | HIGH | `regression-` |
| 3 | Sibling tests | HIGH | `sibling-` |
| 4 | E2E evidence | HIGH | `e2e-` |
| 5 | Hygiene | MEDIUM | `hygiene-` |

## Quick Reference

- `isolation-temp-userdata` — Temp userData; never touch real vault
- `isolation-fake-http` — Fake req/res for handlers
- `regression-bugfix` — Bug fix + failing regression test
- `regression-secret-redaction` — One case per secret scheme
- `regression-shared-validation` — One canonical validator suite
- `sibling-same-diff` — Sibling test in the same diff
- `sibling-logic-not-tsx` — Extract logic; do not unit-test TSX
- `e2e-smoke-evidence` — Written smoke-results for UI criteria
- `hygiene-no-skip-only` — No skip/only in mergeable diffs
- `hygiene-explicit-process-timeout` — Explicit timeout for real process tests
- `hygiene-run-unit-suite` — Run unit suite before closing

## How to Use

Leia `rules/<slug>.md`. Env vars, paths de smoke e pré-condições Electron → `project.md`.

## New rule

Copy `rules/_template.md`. Sections: `rules/_sections.md`.

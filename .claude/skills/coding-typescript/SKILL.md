---
name: coding-typescript
description: >-
  Applies portable strict TypeScript patterns: unknown at every I/O boundary,
  zero unjustified any, discriminated unions for validation and UI state, and
  shared wire/validation contracts. Use when writing types, interfaces, or pure
  functions, or when the question is typing rather than Electron/React/Node/SQLite
  specifics. Read rules/*.md for the matched concern; read project.md for this
  repository's path bindings. Prefer the stack skill of the file being edited
  for domain findings; use this skill as cross-cutting reinforcement.
---

# Coding — TypeScript

Guia proativo de tipagem, transversal às demais Stacks. Achados de tipagem em arquivo de Electron/React/Node.js/SQLite ficam na Stack do arquivo — esta skill reforça o princípio geral.

**Camadas:** `SKILL.md` · `rules/*.md` · `project.md`.

## When to Apply

- Tipos, interfaces, funções puras, contratos compartilhados
- Junto da skill da Stack do arquivo tocado

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Boundary | CRITICAL | `boundary-` |
| 2 | Any discipline | CRITICAL | `any-` |
| 3 | Domain modeling | HIGH | `model-` |
| 4 | Contracts | HIGH | `contract-` |

## Quick Reference

- `boundary-unknown-narrow` — Every I/O edge is unknown + narrow
- `boundary-no-shape-cast` — No production shape casts after parse
- `any-zero-unjustified` — Zero unjustified any
- `any-no-non-null-mask` — Prefer checks over `!` / `?? {}`
- `model-discriminated-validation` — Discriminated validation results
- `model-state-variants` — UI state as variants
- `contract-wire-alignment` — Client/server wire fields aligned
- `contract-shared-validation` — One canonical pure validator module

## How to Use

Leia `rules/<slug>.md`. Fontes canônicas deste repo → `project.md`.

## New rule

Copy `rules/_template.md`. Sections: `rules/_sections.md`.

---
name: coding-sqlite
description: >-
  Applies portable SQLite access patterns: module functions over premature
  factories, one repository per entity via getDb, forward-only numbered
  migrations, and sibling tests for constraints. Use when writing or editing
  database clients, migrations, or repository modules. Read rules/*.md for the
  matched concern; read project.md for this repository's path and audit bindings.
---

# Coding — SQLite

Guia proativo para **escrever** acesso a dados. Não é review: aplique antes do código existir.

**Camadas:** `SKILL.md` · `rules/*.md` · `project.md`.

## When to Apply

- Novo repositório, migration ou mudança de schema/query

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Migrations | CRITICAL | `migration-` |
| 2 | Repository shape | HIGH | `repo-` |
| 3 | Tests | HIGH | `test-` |

## Quick Reference

- `migration-forward-only` — Numbered forward-only migrations
- `repo-module-functions` — Module functions over premature factories
- `repo-one-entity-file` — One plural kebab-case file per entity
- `repo-sqlite-only-under-db` — SQLite via getDb; no JSON under db/
- `repo-getdb-inside-db-layer` — Production getDb only inside db/
- `repo-no-copied-sql` — Repeated SQL lives in the owning repo
- `test-sibling-constraints` — Sibling tests for constraints/ordering

## How to Use

Leia `rules/<slug>.md`. Paths/`RC-*` → `project.md`.

## New rule

Copy `rules/_template.md`. Sections: `rules/_sections.md`.

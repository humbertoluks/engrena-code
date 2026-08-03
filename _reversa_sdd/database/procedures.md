# Procedures & Functions — lioncode.db

> Fonte: `sqlite_master` live. Confianca: 🟢

## Resultado

SQLite neste banco **nao possui** stored procedures nem user-defined functions persistidas no schema. A logica de negocio vive no processo Node (`better-sqlite3` + repositorios em `packages/server/src/db/repositories/`).

## Equivalentes no lado aplicacao

| Conceito | Onde | Nota |
| -------- | ---- | ---- |
| Migrations | `packages/server/src/db/migrations/` | DDL versionado (001…062+) |
| Repositories | `packages/server/src/db/repositories/` | CRUD tipado e queries |
| Triggers | 8× `trg_*_updated_at` | Unico SQL procedural no DB |
| Seeds | migrations + `data_seeds` | Catalogos iniciais |

Views: 0 | Triggers: 8 | Tabelas: 31

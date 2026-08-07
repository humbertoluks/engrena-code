import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import * as migration001Subagents from './migrations/001_subagents.js'
import * as migration001Rules from './migrations/001_rules.js'
import * as migration002WorkspaceCore from './migrations/002_workspace_core.js'
import * as migration003Mcps from './migrations/003_mcps.js'
import * as migration004LogEntries from './migrations/004_log_entries.js'
import * as migration005Consumo from './migrations/005_consumo.js'
import * as migration006UsageSourceTextgen from './migrations/006_usage_source_textgen.js'
import * as migration007ComposerAvancado from './migrations/007_composer_avancado.js'

interface Migration {
  id: string
  sql: string
}

const MIGRATIONS: Migration[] = [
  { id: migration001Subagents.id, sql: migration001Subagents.sql },
  { id: migration001Rules.id, sql: migration001Rules.sql },
  { id: migration002WorkspaceCore.id, sql: migration002WorkspaceCore.sql },
  { id: migration003Mcps.id, sql: migration003Mcps.sql },
  { id: migration004LogEntries.id, sql: migration004LogEntries.sql },
  { id: migration005Consumo.id, sql: migration005Consumo.sql },
  { id: migration006UsageSourceTextgen.id, sql: migration006UsageSourceTextgen.sql },
  { id: migration007ComposerAvancado.id, sql: migration007ComposerAvancado.sql },
]

function resolveUserData(): string {
  const override = process.env.ENGRENACODE_USER_DATA
  if (override) {
    mkdirSync(override, { recursive: true })
    return override
  }
  return app.getPath('userData')
}

function resolveDbPath(): string {
  const override = process.env.ENGRENACODE_DB_PATH
  if (override) return override
  return join(resolveUserData(), 'engrenacode.db')
}

function runMigrations(instance: DatabaseSync): void {
  instance.exec('PRAGMA foreign_keys = ON')
  instance.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)'
  )

  const applied = new Set(
    instance
      .prepare('SELECT id FROM schema_migrations')
      .all()
      .map((row) => (row as { id: string }).id)
  )

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue
    instance.exec(migration.sql)
    instance
      .prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)')
      .run(migration.id, Date.now())
  }
}

/** Instância isolada (ex.: `:memory:` em testes) — roda as mesmas migrations, não toca o singleton. */
export function openDb(path: string): DatabaseSync {
  const instance = new DatabaseSync(path)
  runMigrations(instance)
  return instance
}

let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (db === null) {
    db = openDb(resolveDbPath())
  }
  return db
}

export function closeDb(): void {
  if (db !== null) {
    db.close()
    db = null
  }
}

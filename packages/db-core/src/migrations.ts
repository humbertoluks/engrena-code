import type { DatabaseSync } from 'node:sqlite'

export interface Migration {
  id: string
  sql: string
}

/** Forward-only numbered migrations against schema_migrations. */
export function runMigrations(instance: DatabaseSync, migrations: readonly Migration[]): void {
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

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue
    instance.exec(migration.sql)
    instance
      .prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)')
      .run(migration.id, Date.now())
  }
}

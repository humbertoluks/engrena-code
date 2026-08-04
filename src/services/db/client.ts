import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { MIGRATION_001_SUBAGENTS } from './migrations/001_subagents.js'

const ALL_MIGRATIONS: readonly string[] = [...MIGRATION_001_SUBAGENTS]

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

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  for (const statement of ALL_MIGRATIONS) {
    db.exec(statement)
  }
  return db
}

let singleton: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (!singleton) {
    singleton = openDb(resolveDbPath())
  }
  return singleton
}

export function resetDbSingletonForTests(): void {
  singleton?.close()
  singleton = null
}

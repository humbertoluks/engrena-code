import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { runMigrations, type Migration } from './migrations.js'

export interface CreateDbOptions {
  /** Env var checked first for a full DB file path (e.g. ENGRENACODE_DB_PATH). */
  dbPathEnvVar?: string
  /** Env var checked first for userData directory (e.g. ENGRENACODE_USER_DATA). */
  userDataEnvVar?: string
  /** Fallback when userData env is unset (typically Electron `app.getPath('userData')`). */
  fallbackUserData: () => string
  /** Database file name under userData (e.g. engrenacode.db). */
  dbFileName: string
  /** App-owned SQL migrations — never hardcoded in this package. */
  migrations: readonly Migration[]
}

export interface DbClient {
  /** Isolated instance (e.g. `:memory:` in tests) — runs the same migrations, does not touch the singleton. */
  openDb: (path: string) => DatabaseSync
  getDb: () => DatabaseSync
  closeDb: () => void
  resolveDbPath: () => string
}

function createUserDataResolver(options: {
  userDataEnvVar?: string
  fallbackUserData: () => string
}): () => string {
  return () => {
    if (options.userDataEnvVar) {
      const override = process.env[options.userDataEnvVar]
      if (override) {
        mkdirSync(override, { recursive: true })
        return override
      }
    }
    return options.fallbackUserData()
  }
}

/** App-facing factory: env overrides + Electron (or other) fallback + injectable migrations. */
export function createDb(options: CreateDbOptions): DbClient {
  const resolveUserData = createUserDataResolver({
    userDataEnvVar: options.userDataEnvVar,
    fallbackUserData: options.fallbackUserData,
  })

  function resolveDbPath(): string {
    if (options.dbPathEnvVar) {
      const override = process.env[options.dbPathEnvVar]
      if (override) return override
    }
    return join(resolveUserData(), options.dbFileName)
  }

  function openDb(path: string): DatabaseSync {
    const instance = new DatabaseSync(path)
    runMigrations(instance, options.migrations)
    return instance
  }

  let db: DatabaseSync | null = null

  function getDb(): DatabaseSync {
    if (db === null) {
      db = openDb(resolveDbPath())
    }
    return db
  }

  function closeDb(): void {
    if (db !== null) {
      db.close()
      db = null
    }
  }

  return { openDb, getDb, closeDb, resolveDbPath }
}

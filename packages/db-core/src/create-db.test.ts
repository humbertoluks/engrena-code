import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createDb, runMigrations, type Migration } from './index.js'
import { DatabaseSync } from 'node:sqlite'

const MIGRATIONS: Migration[] = [
  {
    id: '001_test',
    sql: 'CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, name TEXT NOT NULL)',
  },
  {
    id: '002_test',
    sql: 'ALTER TABLE items ADD COLUMN note TEXT',
  },
]

describe('runMigrations', () => {
  it('applies pending migrations and records them in schema_migrations', () => {
    const db = new DatabaseSync(':memory:')
    runMigrations(db, MIGRATIONS)

    const applied = db
      .prepare('SELECT id FROM schema_migrations ORDER BY id')
      .all()
      .map((row) => (row as { id: string }).id)
    expect(applied).toEqual(['001_test', '002_test'])

    db.prepare('INSERT INTO items (id, name, note) VALUES (?, ?, ?)').run('a', 'alpha', 'n')
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get('a') as {
      id: string
      name: string
      note: string
    }
    expect(row).toEqual({ id: 'a', name: 'alpha', note: 'n' })
  })

  it('is idempotent — already-applied migrations are skipped', () => {
    const db = new DatabaseSync(':memory:')
    runMigrations(db, MIGRATIONS)
    runMigrations(db, MIGRATIONS)
    const count = (
      db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get() as { c: number }
    ).c
    expect(count).toBe(2)
  })
})

describe('createDb', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
    delete process.env.ENGRENA_TEST_DB_PATH
    delete process.env.ENGRENA_TEST_USER_DATA
  })

  it('openDb runs migrations on an isolated path without touching the singleton', () => {
    const client = createDb({
      dbFileName: 'test.db',
      fallbackUserData: () => {
        throw new Error('fallback should not run for :memory:')
      },
      migrations: MIGRATIONS,
    })

    const isolated = client.openDb(':memory:')
    const applied = isolated
      .prepare('SELECT id FROM schema_migrations ORDER BY id')
      .all()
      .map((row) => (row as { id: string }).id)
    expect(applied).toEqual(['001_test', '002_test'])
    isolated.close()
  })

  it('getDb/closeDb use userDataEnvVar + dbFileName', () => {
    const dir = mkdtempSync(join(tmpdir(), 'engrena_db_core_'))
    dirs.push(dir)
    process.env.ENGRENA_TEST_USER_DATA = dir

    const client = createDb({
      userDataEnvVar: 'ENGRENA_TEST_USER_DATA',
      dbFileName: 'app.db',
      fallbackUserData: () => {
        throw new Error('fallback should not run when env is set')
      },
      migrations: MIGRATIONS,
    })

    expect(client.resolveDbPath()).toBe(join(dir, 'app.db'))
    const db = client.getDb()
    db.prepare('INSERT INTO items (id, name) VALUES (?, ?)').run('1', 'one')
    expect(client.getDb()).toBe(db)

    client.closeDb()
    const again = client.getDb()
    const row = again.prepare('SELECT name FROM items WHERE id = ?').get('1') as { name: string }
    expect(row.name).toBe('one')
    client.closeDb()
  })

  it('prefers dbPathEnvVar over userData path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'engrena_db_core_path_'))
    dirs.push(dir)
    const custom = join(dir, 'custom.db')
    process.env.ENGRENA_TEST_DB_PATH = custom

    const client = createDb({
      dbPathEnvVar: 'ENGRENA_TEST_DB_PATH',
      userDataEnvVar: 'ENGRENA_TEST_USER_DATA',
      dbFileName: 'ignored.db',
      fallbackUserData: () => dir,
      migrations: MIGRATIONS,
    })

    expect(client.resolveDbPath()).toBe(custom)
    client.getDb()
    client.closeDb()
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createDb } from '@engrena/db-core'
import { MIGRATIONS } from './client.js'

describe('engrenaplan.db migrations', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('applies 001_meta and creates app_meta on engrenaplan.db', () => {
    const dir = mkdtempSync(join(tmpdir(), 'engrenaplan_db_'))
    dirs.push(dir)

    const client = createDb({
      userDataEnvVar: 'ENGRENAPLAN_USER_DATA_TEST',
      dbFileName: 'engrenaplan.db',
      fallbackUserData: () => dir,
      migrations: MIGRATIONS,
    })

    process.env.ENGRENAPLAN_USER_DATA_TEST = dir
    expect(client.resolveDbPath()).toBe(join(dir, 'engrenaplan.db'))

    const db = client.getDb()
    const applied = db
      .prepare('SELECT id FROM schema_migrations ORDER BY id')
      .all()
      .map((row) => (row as { id: string }).id)
    expect(applied).toEqual(['001_meta'])

    db.prepare(
      'INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
    ).run('product', 'EngrenaPlan', Date.now())

    const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get('product') as {
      value: string
    }
    expect(row.value).toBe('EngrenaPlan')
    client.closeDb()
    delete process.env.ENGRENAPLAN_USER_DATA_TEST
  })
})

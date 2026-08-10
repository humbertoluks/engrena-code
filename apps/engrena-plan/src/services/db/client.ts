/**
 * Plan SQLite client — wires @engrena/db-core with ENGRENAPLAN_* env overrides,
 * Electron userData fallback, and app-owned migrations → engrenaplan.db.
 */
import { app } from 'electron'
import { createDb, type Migration } from '@engrena/db-core'
import * as migration001Meta from './migrations/001_meta.js'

export const MIGRATIONS: Migration[] = [
  { id: migration001Meta.id, sql: migration001Meta.sql },
]

const { openDb, getDb, closeDb } = createDb({
  userDataEnvVar: 'ENGRENAPLAN_USER_DATA',
  dbPathEnvVar: 'ENGRENAPLAN_DB_PATH',
  dbFileName: 'engrenaplan.db',
  fallbackUserData: () => app.getPath('userData'),
  migrations: MIGRATIONS,
})

export { openDb, getDb, closeDb }

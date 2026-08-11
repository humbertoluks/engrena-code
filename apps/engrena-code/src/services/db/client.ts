/**
 * Code SQLite client — wires @engrena/db-core with ENGRENACODE_* env overrides,
 * Electron userData fallback, and app-owned migrations. Plan will pass its own
 * MIGRATIONS[] + engrenaplan.db.
 */
import { app } from 'electron'
import { createDb, type Migration } from '@engrena/db-core'
import * as migration001Subagents from './migrations/001_subagents.js'
import * as migration001Rules from './migrations/001_rules.js'
import * as migration002WorkspaceCore from './migrations/002_workspace_core.js'
import * as migration003Mcps from './migrations/003_mcps.js'
import * as migration004LogEntries from './migrations/004_log_entries.js'
import * as migration005Consumo from './migrations/005_consumo.js'
import * as migration006UsageSourceTextgen from './migrations/006_usage_source_textgen.js'
import * as migration007ComposerAvancado from './migrations/007_composer_avancado.js'
import * as migration008Memory from './migrations/008_memory.js'
import * as migration009WriteParallel from './migrations/009_write_parallel.js'
import * as migration010SlashPipeline from './migrations/010_slash_pipeline.js'
import * as migration011UsageLimits from './migrations/011_usage_limits.js'
import * as migration012Skills from './migrations/012_skills.js'
import * as migration013CliSession from './migrations/013_cli_session.js'
import * as migration014MessageFeedback from './migrations/014_message_feedback.js'

const MIGRATIONS: Migration[] = [
  { id: migration001Subagents.id, sql: migration001Subagents.sql },
  { id: migration001Rules.id, sql: migration001Rules.sql },
  { id: migration002WorkspaceCore.id, sql: migration002WorkspaceCore.sql },
  { id: migration003Mcps.id, sql: migration003Mcps.sql },
  { id: migration004LogEntries.id, sql: migration004LogEntries.sql },
  { id: migration005Consumo.id, sql: migration005Consumo.sql },
  { id: migration006UsageSourceTextgen.id, sql: migration006UsageSourceTextgen.sql },
  { id: migration007ComposerAvancado.id, sql: migration007ComposerAvancado.sql },
  { id: migration008Memory.id, sql: migration008Memory.sql },
  { id: migration009WriteParallel.id, sql: migration009WriteParallel.sql },
  { id: migration010SlashPipeline.id, sql: migration010SlashPipeline.sql },
  { id: migration011UsageLimits.id, sql: migration011UsageLimits.sql },
  { id: migration012Skills.id, sql: migration012Skills.sql },
  { id: migration013CliSession.id, sql: migration013CliSession.sql },
  { id: migration014MessageFeedback.id, sql: migration014MessageFeedback.sql },
]

const { openDb, getDb, closeDb } = createDb({
  userDataEnvVar: 'ENGRENACODE_USER_DATA',
  dbPathEnvVar: 'ENGRENACODE_DB_PATH',
  dbFileName: 'engrenacode.db',
  fallbackUserData: () => app.getPath('userData'),
  migrations: MIGRATIONS,
})

export { openDb, getDb, closeDb }

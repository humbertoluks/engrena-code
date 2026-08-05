// Espelha docs/F11-consumo/spec.md §6.
export const id = '005_consumo'

export const sql = `
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  turn_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('agent','subagent')),
  subagent_name TEXT,
  provider TEXT NOT NULL,
  model TEXT,
  billing_mode TEXT NOT NULL CHECK (billing_mode IN ('subscription','api-key','token-plan')),
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_read_tokens INTEGER,
  cache_creation_tokens INTEGER,
  total_tokens INTEGER NOT NULL,
  cost_usd REAL,
  cost_source TEXT NOT NULL DEFAULT 'table' CHECK (cost_source IN ('sdk','table')),
  cost_approximate INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_usage_events_project ON usage_events(project_id, created_at);
CREATE INDEX IF NOT EXISTS ix_usage_events_thread ON usage_events(thread_id, created_at);
CREATE INDEX IF NOT EXISTS ix_usage_events_turn ON usage_events(thread_id, turn_id);
CREATE INDEX IF NOT EXISTS ix_usage_events_nullcost ON usage_events(provider, model)
  WHERE cost_usd IS NULL AND cost_source = 'table';

CREATE TABLE IF NOT EXISTS model_pricing (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_per_mtok REAL NOT NULL,
  output_per_mtok REAL NOT NULL,
  cache_read_per_mtok REAL,
  cache_write_per_mtok REAL,
  approximate INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider, model)
);
`

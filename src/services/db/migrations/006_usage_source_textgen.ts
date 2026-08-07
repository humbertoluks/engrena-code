// Espelha docs/F14-fluxo-git-completo/spec.md §6.1 — amplia CHECK de usage_events.source para incluir 'textgen'.
// SQLite não suporta ALTER TABLE ... DROP CONSTRAINT: recreate + copy + drop + rename.
export const id = '006_usage_source_textgen'

export const sql = `
CREATE TABLE usage_events_new (
  id TEXT PRIMARY KEY,
  turn_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('agent','subagent','textgen')),
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

INSERT INTO usage_events_new SELECT * FROM usage_events;

DROP TABLE usage_events;

ALTER TABLE usage_events_new RENAME TO usage_events;

CREATE INDEX IF NOT EXISTS ix_usage_events_project ON usage_events(project_id, created_at);
CREATE INDEX IF NOT EXISTS ix_usage_events_thread ON usage_events(thread_id, created_at);
CREATE INDEX IF NOT EXISTS ix_usage_events_turn ON usage_events(thread_id, turn_id);
CREATE INDEX IF NOT EXISTS ix_usage_events_nullcost ON usage_events(provider, model)
  WHERE cost_usd IS NULL AND cost_source = 'table';
`

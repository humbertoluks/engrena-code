// Espelha docs/F22-automacao-por-slash-commands-pipeline/spec.md §6.
export const id = '010_slash_pipeline'

export const sql = `
CREATE TABLE IF NOT EXISTS pipelines (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  command TEXT NOT NULL,
  status TEXT NOT NULL,
  args_text TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  error_code TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS ix_pipelines_thread_started ON pipelines(thread_id, started_at DESC);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  stage_index INTEGER NOT NULL,
  subagent_name TEXT NOT NULL,
  status TEXT NOT NULL,
  subagent_run_id TEXT,
  started_at INTEGER,
  finished_at INTEGER,
  UNIQUE (pipeline_id, stage_index)
);
`

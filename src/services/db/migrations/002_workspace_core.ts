// Espelha docs/F03-workspace/spec.md §6.
export const id = '002_workspace_core'

export const sql = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  access_level TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  worktree_path TEXT,
  state TEXT NOT NULL,
  title TEXT,
  system_prompt TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_threads_project_id ON threads(project_id);
CREATE INDEX IF NOT EXISTS ix_threads_state ON threads(state);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT,
  blocks_json TEXT,
  seq INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_messages_thread_seq ON messages(thread_id, seq);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  message_id TEXT,
  name TEXT NOT NULL,
  params_json TEXT,
  status TEXT NOT NULL,
  result_json TEXT,
  seq INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_tool_calls_thread_seq ON tool_calls(thread_id, seq);

CREATE TABLE IF NOT EXISTS diffs (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  file TEXT NOT NULL,
  additions INTEGER NOT NULL,
  deletions INTEGER NOT NULL,
  hunks_json TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  worktree_path TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_diffs_thread_status ON diffs(thread_id, status);
`

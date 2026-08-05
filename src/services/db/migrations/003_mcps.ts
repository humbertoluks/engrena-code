// Espelha docs/F09-mcps/spec.md §6.
export const id = '003_mcps'

export const sql = `
CREATE TABLE IF NOT EXISTS mcps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  transport TEXT NOT NULL,
  command TEXT,
  args_json TEXT,
  env_json TEXT,
  url TEXT,
  headers_json TEXT,
  category TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  preset_id TEXT,
  auth_mode TEXT NOT NULL DEFAULT 'key',
  oauth_status TEXT,
  oauth_client_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_mcps (
  project_id TEXT NOT NULL,
  mcp_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, mcp_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (mcp_id) REFERENCES mcps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_project_mcps_project ON project_mcps(project_id);
`

// Espelha docs/F25-limites-de-consumo/spec.md §6.
export const id = '011_usage_limits'

export const sql = `
CREATE TABLE IF NOT EXISTS usage_limits (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'project')),
  project_id TEXT,
  limit_usd REAL NOT NULL CHECK (limit_usd > 0),
  mode TEXT NOT NULL CHECK (mode IN ('warn', 'block')),
  updated_at INTEGER NOT NULL,
  CHECK (
    (scope = 'global' AND project_id IS NULL) OR
    (scope = 'project' AND project_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_usage_limits_project
  ON usage_limits(project_id) WHERE project_id IS NOT NULL;
`

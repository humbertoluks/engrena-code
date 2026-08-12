// Auto-approve persistente de ferramenta por projeto ("Sempre neste projeto" no PermissionPrompt).
export const id = '015_tool_allowlist'

export const sql = `
CREATE TABLE IF NOT EXISTS tool_allowlist (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, tool_name)
);
`

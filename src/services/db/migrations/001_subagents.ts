// Espelha docs/F07-subagents/spec.md §6. Embutido como string (não .sql solto) porque
// vite-plugin-electron não copia assets arbitrários de src/ para dist-electron no build de produção.
export const MIGRATION_001_SUBAGENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS subagents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    prompt TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'inherit',
    model TEXT,
    reasoning_level TEXT,
    tools_json TEXT,
    idle_timeout_minutes INTEGER,
    category TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS project_subagents (
    project_id TEXT NOT NULL,
    subagent_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (project_id, subagent_id),
    FOREIGN KEY (subagent_id) REFERENCES subagents(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS ix_project_subagents_project ON project_subagents(project_id)`,
  // parent_thread_id sem FK para threads: tabela threads é escopo F03 (ainda não implementada).
  `CREATE TABLE IF NOT EXISTS subagent_runs (
    child_thread_id TEXT PRIMARY KEY,
    parent_thread_id TEXT NOT NULL,
    parent_tool_call_id TEXT,
    subagent_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT,
    status TEXT NOT NULL,
    text TEXT,
    usage_json TEXT,
    reasoning_level TEXT,
    duration_ms INTEGER,
    actions_json TEXT,
    action_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS ix_subagent_runs_parent ON subagent_runs(parent_thread_id)`,
]

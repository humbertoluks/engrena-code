// Espelha docs/F08-registros/spec.md §6.
export const id = '004_log_entries'

export const sql = `
CREATE TABLE IF NOT EXISTS log_entries (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('task','tool','git')),
  event TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_log_entries_thread_id ON log_entries(thread_id);
CREATE INDEX IF NOT EXISTS ix_log_entries_kind_created_at ON log_entries(kind, created_at);
`

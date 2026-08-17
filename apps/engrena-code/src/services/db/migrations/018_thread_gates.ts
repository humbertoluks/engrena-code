// ThreadGate: fato persistido de "esta thread está esperando decisão humana".
// Antes o gate existia só no Map em memória do broker, então crash/restart deixava a thread órfã.
// `kind` já prevê 'question' (ask_user_question) — a migração do lado question vem na próxima fatia.
export const id = '018_thread_gates'

export const sql = `
CREATE TABLE IF NOT EXISTS thread_gates (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  tool_name TEXT,
  payload_json TEXT NOT NULL,
  state TEXT NOT NULL,
  resolution_json TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  resolved_at INTEGER
);

CREATE INDEX IF NOT EXISTS ix_thread_gates_thread_state ON thread_gates(thread_id, state);
`

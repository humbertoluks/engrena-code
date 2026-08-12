// Voto do usuário por resposta do agente (👍/👎) — dado local, nunca sai da máquina.
export const id = '014_message_feedback'

export const sql = `
CREATE TABLE IF NOT EXISTS message_feedback (
  message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_feedback_thread ON message_feedback(thread_id);
`

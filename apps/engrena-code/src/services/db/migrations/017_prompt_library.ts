// Prompts salvos (`*.prompt.md`) e modos de chat (`*.chatmode.md`) — F28 §3.4.
// `threads.chat_mode` guarda o NOME do modo, não um id: modo também pode vir de arquivo do repo
// (`.engrena/modes/*.chatmode.md`), que não tem linha no banco.
export const id = '017_prompt_library'

export const sql = `
CREATE TABLE IF NOT EXISTS saved_prompts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_saved_prompts_name ON saved_prompts(project_id, name);

CREATE TABLE IF NOT EXISTS chat_modes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  provider TEXT,
  model TEXT,
  reasoning_level TEXT,
  access_level TEXT,
  execution_mode TEXT,
  instructions TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_chat_modes_name ON chat_modes(project_id, name);

ALTER TABLE threads ADD COLUMN chat_mode TEXT;
`

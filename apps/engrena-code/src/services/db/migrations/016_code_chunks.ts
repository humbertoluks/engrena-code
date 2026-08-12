// Índice léxico de trechos de código para o `#codebase` (busca BM25 via FTS5).
export const id = '016_code_chunks'

export const sql = `
CREATE TABLE IF NOT EXISTS code_chunk_files (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  mtime_ms REAL NOT NULL,
  indexed_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, path)
);

CREATE VIRTUAL TABLE IF NOT EXISTS code_chunks USING fts5(
  project_id UNINDEXED,
  path,
  start_line UNINDEXED,
  end_line UNINDEXED,
  body,
  tokenize = 'unicode61'
);
`

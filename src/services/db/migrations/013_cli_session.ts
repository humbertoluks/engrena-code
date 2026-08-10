// Persistência do session_id do Claude Code CLI para follow-up com `--resume`.
export const id = '013_cli_session'

export const sql = `
ALTER TABLE threads ADD COLUMN cli_session_id TEXT;
`

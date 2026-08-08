// Espelha docs/F18-subagents-em-paralelo-write-parallel/spec.md §6.
export const id = '009_write_parallel'

export const sql = `
ALTER TABLE subagents ADD COLUMN kind TEXT NOT NULL DEFAULT 'dev';

ALTER TABLE subagent_runs ADD COLUMN parallel_batch_id TEXT;
CREATE INDEX IF NOT EXISTS ix_subagent_runs_batch ON subagent_runs(parallel_batch_id);

ALTER TABLE diffs ADD COLUMN conflict_candidates_json TEXT;
`

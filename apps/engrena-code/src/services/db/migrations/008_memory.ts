// Espelha docs/F20-memoria-persistente/spec.md §6 — toggle "Memória" por projeto (ligado por padrão).
export const id = '008_memory'

export const sql = `
ALTER TABLE projects ADD COLUMN memory_enabled INTEGER NOT NULL DEFAULT 1;
`

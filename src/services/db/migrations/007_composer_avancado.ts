// Espelha docs/F16-composer-avancado/spec.md §6 — reasoning level atual da thread, editável no follow-up.
export const id = '007_composer_avancado'

export const sql = `
ALTER TABLE threads ADD COLUMN reasoning_level TEXT;
`

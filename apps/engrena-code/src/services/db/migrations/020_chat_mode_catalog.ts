// Modo de chat filtrando skills/rules do projeto — F28 §3.4.
//
// Guarda JSON de array de nomes, não FK: o modo também pode vir de arquivo do repo
// (`.engrena/modes/*.chatmode.md`), que nomeia skill/rule por nome e não conhece id nenhum.
// NULL = modo não fala do assunto (turno usa tudo que o projeto vincula, como antes);
// `[]` = modo pede explicitamente nenhuma.
export const id = '020_chat_mode_catalog'

export const sql = `
ALTER TABLE chat_modes ADD COLUMN skills_json TEXT;
ALTER TABLE chat_modes ADD COLUMN rules_json TEXT;
`

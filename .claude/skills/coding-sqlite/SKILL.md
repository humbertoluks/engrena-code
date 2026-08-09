---
name: coding-sqlite
description: >-
  Aplica os padrões de acesso a SQLite do EngrenaCode (funções de módulo em
  vez de factory prematura, migration numerada, repositório por entidade via
  getDb) e as lições já registradas em auditoria para não repetir abstração
  sem uso concreto, persistência fora do SQLite sob db/, ou módulo sem teste
  irmão. Use ao escrever ou editar código em src/services/db/ (client,
  migrations, repositories).
---

# Coding — SQLite

Guia proativo para **escrever** código de acesso a dados. Não é review: aplique antes do código existir.

Fonte de verdade: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (Stack `SQLite`). A lista de abertos abaixo é **espelho** da última passagem — releia o código antes de agir sobre um item.

## Padrões obrigatórios

- **Prefira funções de módulo a factory sem polimorfismo.** `createXRepository()` que só devolve `{ list, create, ... }` sem uma segunda implementação real é abstração sem uso concreto (KISS). Exporte funções direto: `listRules()`, `createRule(...)`.
  Factory só se justifica com fake injetável em teste **e** uma segunda implementação real — nenhuma das duas hoje.
- Repositório novo tem o nome plural da entidade (`repositories/rules.ts`, `repositories/messages.ts`), kebab-case, um arquivo por entidade.
- **Arquivo sob `src/services/db/repositories/` persiste via `getDb()` + SQLite.** Tabela nova → migration `NNN_<assunto>.ts` na ordem seguinte. **Não** coloque sob `db/repositories/` um store em `*.json`/`fs`/`electron.app` — ou migre para SQLite, ou mova o módulo para outro path e documente na spec.
- Acesso a SQLite passa pelo repositório da entidade. Hoje **não existe** nenhum `getDb()` de produção fora de `src/services/db/**` (só em `*.test.ts`); o primeiro que aparecer é desvio, não precedente.
- Migration nova entra em `src/services/db/migrations/NNN_<assunto>.ts` no próximo número livre. **Nunca edite uma migration já aplicada** — schema novo é sempre migration nova. Atenção: o prefixo `001_` já está duplicado por herança (`001_rules.ts` e `001_subagents.ts`); não repita colisão de número em migration nova.
- Todo repositório novo (ou tocado com mudança de comportamento) tem `*.test.ts` irmão cobrindo: happy path, cada constraint/conflito, cada `code` de erro, ordenação e paginação quando existir. Cobertura só "de fora" (via handler) deixa gap em constraint e ordenação.
- Query SQL repetida em dois arquivos pertence ao repositório da entidade — mova para lá em vez de copiar.

## Erros já registrados aqui — não repita

Abertos: nenhum nesta Stack.

Já corrigidos — não regrida:

- `RC-module-repo` — funções de módulo (`listSubagents`, …); não reintroduza factory sem segundo consumidor real.
- `RC-missing-sibling-test` — **todos** os repositórios de `db/repositories/` têm `*.test.ts` irmão hoje. Entidade nova entra com o irmão no mesmo diff; não abra exceção.
- `RC-skills-json-outside-sqlite` — `repositories/skills.ts` migrado de `skills.json`/`fs` para SQLite (`012_skills`, tabelas `skills`/`project_skills`). API pública é funções de módulo (`listSkills`/`createSkill`/`linkSkill`/…), não uma classe/singleton. Migração do JSON legado é automática (1ª query de cada processo, guardada por contagem de linhas, arquivo renomeado pra `.migrated`). Teste que precisa `vi.spyOn` numa função exportada importa o módulo como namespace (`import * as skillsRepo from '...'`), não destructura.

## Se encontrar um padrão novo

Se um erro não listado aqui aparecer no caminho, registre em `docs/AUDIT-CODE-REVIEW.md` (via `audit-full-base`) ou, se for regra transferível e não-óbvia, em `CLAUDE.md` no formato `Origem · Categoria · [Sempre/Nunca] X porque Y`.

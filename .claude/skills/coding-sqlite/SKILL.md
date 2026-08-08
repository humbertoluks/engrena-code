---
name: coding-sqlite
description: >-
  Aplica os padrões de acesso a SQLite do EngrenaCode (funções de módulo em
  vez de factory prematura, migration numerada, repositório por entidade) e
  as lições já registradas em auditoria para não repetir abstração sem uso
  concreto ou módulo sem teste irmão. Use ao escrever ou editar código em
  src/services/db/ (client, migrations, repositories).
---

# Coding — SQLite

Guia proativo para **escrever** código de acesso a dados. Não é review: aplique antes do código existir.

Fonte: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (Stack `SQLite`).

## Padrões obrigatórios

- **Prefira funções de módulo a factory sem polimorfismo.** `createXRepository()` que só devolve `{ list, create, ... }` sem uma segunda implementação real é abstração sem uso concreto (KISS). Exporte funções direto: `listRules()`, `createRule(...)`.
  Factory só se justifica com fake injetável em teste **e** uma segunda implementação real — nenhuma das duas hoje.
- Repositório novo tem o nome plural da entidade (`repositories/rules.ts`, `repositories/messages.ts`), kebab-case, um arquivo por entidade.
- Acesso a SQLite passa pelo repositório da entidade. `getDb()` direto fora de `src/services/db/**` é excepcional (precedentes já existentes: `subagents-handler.ts`, `dashboard-handler.ts`, `runner/dispatch.ts`, `seeds/apply-catalog.ts`); um novo uso direto para CRUD comum é o erro — existe repositório para isso.
- Migration nova entra em `src/services/db/migrations/NNN_<assunto>.ts` na ordem numérica seguinte. **Nunca edite uma migration já aplicada** — schema novo é sempre migration nova.
- Todo repositório novo (ou tocado com mudança de comportamento) tem `*.test.ts` irmão cobrindo: happy path, cada constraint/conflito, cada `code` de erro, ordenação e paginação quando existir. Cobertura só "de fora" (via handler) deixa gap em constraint e ordenação.
- Query SQL repetida em dois arquivos pertence ao repositório da entidade — mova para lá em vez de copiar.

## Erros já registrados aqui — não repita

Abertos nesta auditoria (corrija ao tocar o módulo):

- `R-missing-sibling-test` — `repositories/messages.ts` sem `messages.test.ts` irmão. Ao adicionar comportamento novo nesse arquivo, crie o teste antes/junto.

Já corrigidos — não regrida:

- `RC-module-repo` — `createSubagentsRepository()` sem implementações alternativas já foi substituído por funções de módulo (`listSubagents`, `createSubagent`, ...). Não reintroduza factory sem um segundo consumidor real ao criar repositório novo.

## Se encontrar um padrão novo

Se um erro não listado aqui aparecer no caminho, registre em `docs/AUDIT-CODE-REVIEW.md` (via `audit-full-base`) ou, se for regra transferível e não-óbvia, em `CLAUDE.md` no formato `Origem · Categoria · [Sempre/Nunca] X porque Y`.

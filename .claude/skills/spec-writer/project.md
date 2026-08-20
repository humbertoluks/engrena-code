# Bindings — EngrenaCode (Specs)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

O `SKILL.md` é method puro e não cita este produto. Toda vez que ele diz "o PRD", "a pasta da
feature" ou "os gates", o valor está aqui.

## Mapa do repo

| Conceito | Neste repo |
|----------|------------|
| PRD | [`apps/engrena-code/docs/PRD.md`](../../../apps/engrena-code/docs/PRD.md) — PT-BR, 9 seções |
| Status real de implementação | [`apps/engrena-code/docs/PROGRESS.md`](../../../apps/engrena-code/docs/PROGRESS.md), tabela "Resumo por feature" |
| Pasta de saída por feature | `apps/engrena-code/docs/F<ID>-<kebab-name>/{spec.md,plan.md}` |
| Fonte de verdade de UX | `apps/engrena-code/docs/F<ID>-*/ui.md` (anatomia, tokens, aceite visual) |
| Fonte de verdade de copy | `apps/engrena-code/docs/F<ID>-*/copy.md` (strings literais por id) |
| Registro de smoke | `apps/engrena-code/docs/F<ID>-*/smoke-results.md` |
| Docs canônicos de arquitetura | `docs/architecture/monorepo.md`, `docs/design-system/` (raiz do monorepo) |

## Gates deste repo

| Gate | Comando |
|------|---------|
| Tipos | `pnpm --filter engrena-code exec tsc -b` — **nunca** `tsc --noEmit -p tsconfig.json`, que passa sem checar nada |
| Testes | `pnpm --filter engrena-code test` (ou `npx vitest run` dentro do app) |
| Lint | `npx biome lint <arquivos>` — `biome check` no repo inteiro falha no baseline |
| Build | `pnpm --filter engrena-code build` |

Filtros pnpm disponíveis: `engrena-code`, `engrena-plan`, `@engrena/ui|vault|http-core|db-core`.

## Precedência de fontes

1. Código e config do repo
2. `PRD.md` §9 e specs de feature existentes
3. `PROGRESS.md`

A **composição das ondas e as dependências** vêm sempre do PRD §8. A tabela de Ondas do `PROGRESS.md`
é espelho e pode estar stale — se divergir, use o PRD e avise a divergência no relatório final.

## Convenções deste produto

- Spec e plan escritos em **português do Brasil**.
- `ui.md`/`copy.md`, quando existem, são fonte de verdade: a spec **cita** os caminhos e os ids de
  copy, nunca redescreve anatomia nem reescreve strings.
- Quando a feature tem UI e esses arquivos ainda não existem, registre a lacuna em Assumptions e
  sinalize que o processo de design é pré-requisito da implementação visual.
- Fundação (`F01`, `F01.1`, `F02`) está **completa** — as verificações de greenfield não se aplicam.

## Nota histórica

Existiu um Modo Lote (Two-phase batch) que gerava várias specs da mesma onda em paralelo, apoiado num
brief compartilhado em `docs/_shared/codebase-patterns.md`. Removido em 2026-08-20: o brief envelhecia
em silêncio e o modo dependia de despachar sub-agentes. Se voltar, volta como skill própria.

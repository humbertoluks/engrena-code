---
name: coding-vitest
description: >-
  Aplica os padrões de teste do EngrenaCode (isolamento via
  ENGRENACODE_USER_DATA, teste irmão obrigatório por camada, smoke E2E com
  evidência em smoke-results.md) e as lições já registradas em auditoria
  para não fechar módulo ou feature sem cobertura. Use ao escrever
  *.test.ts, *.logic.test.ts, ao adicionar um módulo novo em
  src/services/** ou src/renderer/**/*.logic.ts, ou ao fechar uma feature
  com critério de aceitação de UI.
---

# Coding — Vitest

Guia proativo de teste e evidência de entrega. Não é review (isso é `review-delivery`): aplique antes de considerar um módulo ou feature pronto.

Fonte: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (Stack `Vitest`) + `CLAUDE.md` → "TESTE".

## Padrões obrigatórios

- `vitest.config.ts` só inclui `src/**/*.test.ts`, `environment: node`. `.tsx` **nunca** é testado como componente — regra de UI sai do componente para `*.logic.ts` (ver `coding-react`), testada por `*.logic.test.ts`.
- **Todo módulo de produção em camada que exige teste ganha `*.test.ts` irmão no mesmo diff**, não depois: `src/services/db/repositories/*`, `src/services/http/*-handler.ts`, `src/services/runner/*`, `src/services/git/*`, `vault/*`, `seeds/*`, `src/renderer/**/*.logic.ts`. Módulo novo sem o irmão é bloqueador, não débito para depois.
- Isolamento de dados: defina `process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_<slug>_'))` **antes** dos `await import()` dinâmicos que tocam DB/vault; limpe em `afterAll` com `closeDb()` + `rmSync`. Nunca deixe um teste tocar o `userData`/`vault.enc` real do usuário. Precedente completo: `rules-handler.test.ts`.
- Handler HTTP é testado sem servidor real: fakes de `IncomingMessage`/`ServerResponse` (`fakeReq`/`fakeRes`), asserindo `status` + body JSON — cubra 2xx do happy path, 400 body inválido, 401 sessão, 423 vault travado, e 404/409 quando a rota tiver.
- Correção de bug **sempre** vem com teste que reproduz o bug — foi a ausência disso que deixou `ELECTRON_RUN_AS_NODE` (F15) escapar dos unitários.
- Nunca deixe `it.skip`/`describe.skip`/`it.only` no diff.
- Rode `pnpm test` (suíte completa) sempre que alterar código de produção coberto pela tarefa, antes de considerar a mudança fechada.
- **Smoke E2E é obrigatório** quando algum critério de aceitação depende de DOM, navegação, formulário ou comportamento visual ("usuário consegue clicar/ver/enviar/navegar"). Rode via skill `playwright-cli` contra Vite dev + Electron real; artefatos em `.playwright-cli/` (gitignored); evidência final em `docs/F<ID>-*/smoke-results.md` citando o que foi exercitado (não só "rodou"), cobrindo light/dark e a copy real de `ui.md`/`copy.md` quando existirem.
- Nunca marque `[x]` no PRD ou "Feito" no `PROGRESS.md` para um critério de UI sem o `smoke-results.md` correspondente já escrito.
- Pré-condições de smoke real: `.env.local` com `VITE_DEV_SERVER_URL` na porta livre a partir de 5173 exceto 5174; loopback de unlock em `127.0.0.1:5174`; Electron real com `dangerouslyDisableSandbox: true`; `ANTHROPIC_API_KEY` unset para turno real de assinatura; access level "Auto-accept edits" quando o turno usa Edit.

## Erros já registrados aqui — não repita

Abertos nesta auditoria (feche antes de considerar o módulo/feature pronto):

- `R-missing-sibling-test` — `repositories/messages.ts`, `_transport.ts`, `vault-service.ts`/`store.ts`, `git/git-client.ts` sem teste irmão dedicado. Ao tocar qualquer um desses arquivos, crie o teste antes de adicionar comportamento novo.
- `R-missing-smoke-evidence` — `docs/F20-*`, `F21-*`, `F23-*`, `F26-*` marcam critério de UI como Feito sem `smoke-results.md`. Não repita esse padrão em feature nova: escreva o smoke antes de marcar `[x]`.
- Gate `pnpm test`/`tsc`/`build` não reconfirmado na última passagem de auditoria — ao fechar uma tarefa, reporte explicitamente que os três rodaram verdes, não assuma.

## Se encontrar um padrão novo

Se um erro não listado aqui aparecer no caminho, registre em `docs/AUDIT-CODE-REVIEW.md` (via `audit-full-base`) ou, se for regra transferível e não-óbvia, em `CLAUDE.md` no formato `Origem · Categoria · [Sempre/Nunca] X porque Y`.

---
name: coding-vitest
description: >-
  Aplica os padrões de teste do EngrenaCode (isolamento via
  ENGRENACODE_USER_DATA, teste irmão obrigatório por camada, smoke E2E com
  evidência em smoke-results.md, cobertura de redação de segredo) e as lições
  já registradas em auditoria para não fechar módulo ou feature sem cobertura.
  Use ao escrever *.test.ts, *.logic.test.ts, ao adicionar um módulo novo em
  src/services/** ou src/renderer/**/*.logic.ts, ou ao fechar uma feature com
  critério de aceitação de UI.
---

# Coding — Vitest

Guia proativo de teste e evidência de entrega. Não é review (isso é `review-delivery`): aplique antes de considerar um módulo ou feature pronto.

Fonte de verdade: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (Stack `Vitest`) + `CLAUDE.md` → "TESTE". A lista de abertos abaixo é **espelho** da última passagem — releia o código antes de agir sobre um item.

## Padrões obrigatórios

- `vitest.config.ts` só inclui `src/**/*.test.ts`, `environment: node`. `.tsx` **nunca** é testado como componente — regra de UI sai do componente para `*.logic.ts` (ver `coding-react`), testada por `*.logic.test.ts`.
- **Todo módulo de produção em camada que exige teste ganha `*.test.ts` irmão no mesmo diff**, não depois: `src/services/db/repositories/*`, `src/services/http/*-handler.ts`, `src/services/runner/*`, `src/services/git/*`, `vcs/*`, `vault/*`, `seeds/*`, `codegraph/*` (inclui `ensure`/`query`), `src/renderer/**/*.logic.ts`. Módulo novo sem o irmão é bloqueador, não débito para depois.
- Isolamento de dados: defina `process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_<slug>_'))` **antes** dos `await import()` dinâmicos que tocam DB/vault; limpe em `afterAll` com `closeDb()` + `rmSync`. Nunca deixe um teste tocar o `userData`/`vault.enc` real do usuário. Precedente completo: `rules-handler.test.ts`.
- Handler HTTP é testado sem servidor real: fakes de `IncomingMessage`/`ServerResponse` (`fakeReq`/`fakeRes`), asserindo `status` + body JSON — cubra 2xx do happy path, 400 body inválido, 401 sessão, 423 vault travado, e 404/409 quando a rota tiver.
- Correção de bug **sempre** vem com teste que reproduz o bug — foi a ausência disso que deixou `ELECTRON_RUN_AS_NODE` (F15) e schemes F24 no sanitizer escaparem.
- Ao estender `sanitizeProcessError` / inject de token VCS / prefixo de provider: **teste que falha se o segredo sobreviver** (GitLab `oauth2:`, Bitbucket `x-token-auth:`, Azure `https://:<token>@`, `xai-`, `gsk_`). Cobrir só `x-access-token` não basta.
- Quando cliente e servidor compartilham regra de validação, prefira fonte única testada uma vez; se ainda houver adaptador no `*.logic.ts`, teste de paridade ou import direto evita drift.
- Nunca deixe `it.skip`/`describe.skip`/`it.only` no diff.
- Rode `pnpm test` (suíte completa) sempre que alterar código de produção coberto pela tarefa, antes de considerar a mudança fechada.
- Teste que exercita git/spawn reais (`git-client`, `git-handler`, `delegate`, `pipeline-runner`) leva de 8 a 16 s por arquivo contra `testTimeout` default de 5 s por caso: em máquina carregada ele **falha intermitente** com `Test timed out in 5000ms`. Antes de tratar vermelho como regressão, rode de novo; se o conjunto de falhas mudar, é flaky. Caso novo que dependa de processo real nasce com `testTimeout` explícito no `it(...)`, não confiando no default.
- **Smoke E2E é obrigatório** quando algum critério de aceitação depende de DOM, navegação, formulário ou comportamento visual ("usuário consegue clicar/ver/enviar/navegar"). Rode via skill `playwright-cli` contra Vite dev + Electron real; artefatos em `.playwright-cli/` (gitignored); evidência final em `docs/F<ID>-*/smoke-results.md` citando o que foi exercitado (não só "rodou"), cobrindo light/dark e a copy real de `ui.md`/`copy.md` quando existirem.
- Nunca marque `[x]` no PRD ou "Feito" no `PROGRESS.md` para um critério de UI sem o `smoke-results.md` correspondente já escrito. Narrativa de smoke no PROGRESS **não** substitui o arquivo.
- Pré-condições de smoke real: `.env.local` com `VITE_DEV_SERVER_URL` na porta livre a partir de 5173 exceto 5174; loopback de unlock em `127.0.0.1:5174`; Electron real com `dangerouslyDisableSandbox: true`; `ANTHROPIC_API_KEY` unset para turno real de assinatura; access level "Auto-accept edits" quando o turno usa Edit.

## Erros já registrados aqui — não repita

Abertos (feche antes de considerar o módulo/feature pronto):

- `R-missing-smoke-evidence` — features com UI marcadas Feito sem `smoke-results.md`: F04, F05, F08, F10, F14, F16, F17 (dívida secundária, sem prioridade definida). F19 exempto (smoke "opcional" na própria spec). F20/F21/F23/F26/F27 fechados 2026-08-09 — têm evidência junto com F01, F02, F03, F06, F07, F09, F11, F12, F13, F15, F18, F22, F24, F25. Feature nova: escreva o smoke antes de marcar `[x]`.
- `R-missing-sibling-coverage` — ainda sem `*.test.ts` irmão: `vcs/oauth-config.ts`, `mcps/catalog.ts`, `config/defaults.ts`. Ao tocar qualquer um, adicione teste mínimo. Exceção aceita: arquivo só de `type`/`interface` (`runner/providers/provider-types.ts`).

Já corrigidos — não regrida:

- Irmãos da passagem anterior (`messages`, `_transport`, `vault-service`/`store`, extensão `git-client`), 17/17 `*.logic.ts` do renderer com `*.logic.test.ts`, todos os repositórios de `db/repositories/`, `codegraph/ensure`+`query` e os registries do runner (`mcp-registry`, `rule-registry`, `thread-cwd`, `turn-control`).
- `process-error.test.ts` cobre um caso por scheme F24 (`oauth2:`, `x-token-auth:`, azure `https://:<token>@`) e por prefixo (`xai-`, `gsk_`), assertando que o segredo **não** sobrevive. Ao mexer no sanitizer, mantenha um caso por scheme.

## Se encontrar um padrão novo

Se um erro não listado aqui aparecer no caminho, registre em `docs/AUDIT-CODE-REVIEW.md` (via `audit-full-base`) ou, se for regra transferível e não-óbvia, em `CLAUDE.md` no formato `Origem · Categoria · [Sempre/Nunca] X porque Y`.

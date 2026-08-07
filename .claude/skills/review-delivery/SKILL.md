---
name: review-delivery
description: Revisa entrega do EngrenaCode — cobertura Vitest por camada, regra de negócio testável sem abrir a UI, necessidade de smoke E2E via playwright-cli, gates de build (tsc/vite/biome) e adequação do diff a commits pequenos em Conventional Commits. Use ao revisar um diff, branch, PR ou feature quanto a testes, evidência de smoke, granularidade de commit ou fechamento de progresso.
---

# Review — Entrega

Revisão **somente leitura** de testes, evidência e granularidade de commit. Nunca edita código nem cria testes: observa, analisa e relata.

**Idioma:** relatório em português do Brasil. Comandos, nomes de teste e mensagens de commit permanecem em inglês.

## Escopo

| Revisa aqui | Não revisa aqui |
|---|---|
| Cobertura Vitest por camada tocada | Camadas e isolamento Electron → `review-architecture` |
| Regra de negócio testável sem abrir a UI | Validação, tipos, erros → `review-robustness` |
| Necessidade e evidência de smoke E2E | |
| Gates de build e lint | |
| Diff fatiável em commits pequenos e coerentes | |
| Fechamento de `PROGRESS.md` + `[x]` no PRD | |

## Entrada

Formato livre. Default: **mudanças do branch** (`git diff --stat main...HEAD` + `git log --oneline main..HEAD`).

Também aceita: `uncommitted` (`git status` + `git diff HEAD`), caminhos explícitos, ou `F<ID>` (usa Testing Strategy de `docs/F<ID>-*/spec.md` e os critérios de aceitação da feature no PRD).

Diff vazio: pare e diga qual escopo foi tentado.

## Como testes rodam aqui

- Unit: `pnpm test` (`vitest run`). `vitest.config.ts` inclui apenas `src/**/*.test.ts` — `.tsx` **não** entra na suíte, e `environment` é `node`. Consequência direta: componente React não é testado como componente; a regra sai dele para um `*.logic.ts` colocado, testado por `*.logic.test.ts`.
- Isolamento de dados: a config injeta `ENGRENACODE_USER_DATA` num tmpdir. Teste que precisa de DB/vault define `process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_<slug>_'))` **antes** dos `await import()` dinâmicos, e limpa em `afterAll` com `closeDb()` + `rmSync`. Precedente completo: `src/services/http/rules-handler.test.ts`.
- Handler é testado sem servidor: fakes de `IncomingMessage`/`ServerResponse` (`fakeReq`/`fakeRes`), asserindo `status` + body JSON.
- E2E: **Playwright não é dependência do repo**. Smoke roda pela skill `playwright-cli` em headless contra Vite dev + Electron real, artefatos em `.playwright-cli/` (gitignored) e evidência escrita em `docs/F<ID>-*/smoke-results.md`.
- Gates: `pnpm test`, `tsc -b`, `vite build`, `electron-builder` (via `pnpm build`) e `biome lint`.

## Checklist

Marque cada item ✓ / ✗ / — e cite `arquivo:linha` ou hash de commit.

### 1. Regra de negócio testável sem abrir a UI

- Toda regra nova em `.tsx` (validação de formulário, clamp, derivação de estado, formatação, ordenação, habilitação de botão) está extraída para `*.logic.ts` com teste. Regra viva dentro do componente é 🔴 — a suíte não alcança `.tsx`, então ela nasce sem cobertura possível.
- Precedentes de extração: `components/workspace/composer.logic.ts`, `components/rules/ruleForm.logic.ts`, `components/subagents/subagentRun.format.ts`, `screens/consumoScreen.logic.ts`.
- Função de regra é pura: entrada → saída, sem `fetch`, sem `localStorage`, sem `window`. Regra que precisa de mock de DOM para ser testada é 🟡, sinal de que a extração ficou pela metade.
- O `.tsx` fica só com render, wiring de evento e chamada de service.

### 2. Cobertura por camada tocada

Para cada arquivo de produção no diff, exija o teste correspondente:

| Camada tocada | Teste esperado | O que precisa estar coberto |
|---|---|---|
| `src/services/db/repositories/*.ts` | `*.test.ts` irmão | happy path, cada constraint/conflito, cada `code` de erro, ordenação e paginação |
| `src/services/http/*-handler.ts` | `*.test.ts` irmão | 2xx do happy path + 400 body inválido + 401 sessão + 423 vault travado + 404/409 quando a rota tem |
| `src/services/runner/*` | `*.test.ts` irmão | caminho normal e caminho de falha, com driver/spawn fakeado |
| `src/services/git/*`, `vault/*`, `seeds/*` | `*.test.ts` irmão | efeito no disco/estado, além do retorno |
| `src/services/db/migrations/*` | coberto pelos testes de repositório | schema novo exercitado por ao menos um teste |
| `src/renderer/**/*.logic.ts` | `*.logic.test.ts` irmão | cada branch da regra |
| `src/renderer/**/*.tsx` | nenhum unit (fora da suíte) | vira smoke, ver item 3 |
| `src/main/index.ts`, `src/preload/index.ts` | nenhum unit | vira smoke, ver item 3 |

- Arquivo de produção novo em camada que exige teste, sem `*.test.ts` no mesmo diff, é 🔴.
- Teste que só assere "não lançou" (`expect(fn).not.toThrow()`) sem checar resultado é 🟡.
- Teste novo que depende de rede real, do `vault.enc` do usuário, de `userData` real ou de ordem entre arquivos de teste é 🔴.
- `it.skip` / `describe.skip` / `it.only` deixados no diff é 🔴.
- Correção de bug sem teste que reproduza o bug é 🔴 — foi exatamente assim que `ELECTRON_RUN_AS_NODE` (F15) escapou dos unitários.

### 3. Smoke E2E: quando é obrigatório

Obrigatório quando algum critério de aceitação do diff depende de DOM, navegação, formulário ou comportamento visual — qualquer frase do tipo "o usuário consegue clicar / ver / enviar / navegar" (`CLAUDE.md` → TESTE). Também obrigatório para superfície que a suíte não alcança: tela, canal IPC, migration em app real, turno real de agente.

- Critério com superfície UI e **sem** evidência de smoke em `docs/F<ID>-*/smoke-results.md` é 🔴. A evidência precisa citar o que foi exercitado, não só "rodou".
- Critério só de vault/crypto/IPC/API **sem** superfície UI não exige smoke — marque `—`.
- Smoke de tela cobre light/dark e a copy real contra `ui.md`/`copy.md` quando esses arquivos existem. Faltando é 🟡.
- Pré-condições respeitadas no relato do smoke: `.env.local` com `VITE_DEV_SERVER_URL` na porta livre a partir de 5173 **exceto 5174**, loopback de unlock em `127.0.0.1:5174`, Electron real com `dangerouslyDisableSandbox`, `ANTHROPIC_API_KEY` unset para turno real de assinatura, access level "Auto-accept edits" quando o turno tem Edit. Smoke relatado violando qualquer uma delas é 🟡 (resultado não é confiável).
- Smoke que usou o `userData`/vault real do usuário em vez de `ENGRENACODE_USER_DATA` isolado é 🔴.
- Não exija spec Playwright versionada no repo: E2E aqui é procedimento pela skill `playwright-cli`, não suíte commitada. Pedir `tests/e2e/*.spec.ts` é achado inválido.

### 4. Gates de build

- Confirme no diff/PR que `pnpm test` (suíte completa, não só os arquivos tocados), `tsc -b`, `vite build` e `biome lint` rodaram verdes. Gate não reportado é 🟡; gate reportado vermelho é 🔴.
- Mudança em `src/main`, `src/preload`, `package.json` (`main`, `files`, `build`) ou config do Vite exige também `electron-builder` verde. Faltando é 🔴 — é o gate que pega colisão de `dist-electron/index.js` e path de produção.
- Migration nova exige a suíte completa verde, não só o teste do repositório dela.

### 5. Diff fatiável em commits pequenos

- Um commit = uma fase coerente. Fatias típicas deste repo: `migration + repositório + testes`, `endpoint + testes`, `tela + logic + testes`, `docs`.
- Commit misturando assuntos independentes (migration + tela + refactor não relacionado) é 🟡 com a fatia sugerida no relatório.
- Mensagens em **Conventional Commits** em inglês, tipo inferido do conteúdo real (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`), scope = `F<ID>` como na pasta de docs ou nome curto de componente em minúsculas. Tipo genérico/errado (`feat` para um fix, `chore` para feature) é 🟡; mensagem em português é 🔴.
- Fechamento de docs (`PROGRESS.md` + `[x]` no PRD) em commit `docs(F<ID>): ...` separado dos commits de código. Misturado é 🟡.
- `git add -A`/`git add .` ou hooks pulados (`--no-verify`) evidenciados no histórico é 🔴.
- Artefato que não deveria estar versionado no diff (`dist/`, `dist-electron/`, `.playwright-cli/`, `.env.local`, `vault.enc`, `.vscode/`, `launch.json`, screenshot de smoke) é 🔴.
- Diff com arquivo grande de mudança puramente mecânica misturado a mudança de lógica é 🟡: pedir separação em dois commits.

### 6. Fechamento

Aplique só quando o diff pretende **fechar** uma feature:

- Linha da feature atualizada em `docs/PROGRESS.md` (status, evidência, próximo passo). Faltando é 🔴.
- Tabela de Ondas de `docs/PROGRESS.md` reconciliada com o PRD §8: a feature aparece na onda dela, onda com pendência não figura como "Completa", cada linha declara o paralelismo. Divergente é 🔴 (`CLAUDE.md` → Docs · Ondas).
- `[x]` no PRD somente nos critérios com teste ou smoke que passou de fato. Marcar critério coberto só por soft-fail é 🔴.
- Regra nova ou não-óbvia descoberta no caminho registrada em `CLAUDE.md` no formato `Origem · Categoria · [Sempre/Nunca] X porque Y`. Faltando é 🟢.

## Formato de saída

```
Review Entrega — <escopo revisado>
Veredito: aprovado | ressalvas | bloqueado

🔴 Bloqueia merge
- `caminho:linha` ou `<commit>` — <problema em uma linha>. Correção: <ação concreta>.

🟡 Ajustar antes de fechar a feature
- ...

🟢 Opcional
- ...

Cobertura por arquivo de produção:
| Arquivo | Teste esperado | Situação |
|---|---|---|
| `src/services/http/foo-handler.ts` | `foo-handler.test.ts` | ✓ 2xx/400/401/423 |
| `src/renderer/screens/FooScreen.tsx` | smoke | ✗ sem `smoke-results.md` |

Smoke necessário: sim | não — <motivo em uma linha>

Fatiamento sugerido (se 🟡 no item 5):
1. `feat(F<ID>): <fatia>` — <arquivos>
2. `test(F<ID>): <fatia>` — <arquivos>

Checklist:
✓ 1. Regra fora da UI — <evidência>
✗ 4. Gates de build — <o que falta>
— 6. Fechamento — este diff não fecha feature

Não verificado:
- <o que não deu para checar e por quê>
```

Veredito: **bloqueado** com qualquer 🔴; **ressalvas** com só 🟡/🟢; **aprovado** sem achados.

## Sempre

- Listar todo arquivo de produção do diff e o teste esperado dele antes de dar veredito — a tabela de cobertura é o núcleo do relatório.
- Ler Testing Strategy de `docs/F<ID>-*/spec.md` e os critérios de aceitação do PRD quando o diff pertence a uma feature.
- Decidir "smoke obrigatório: sim/não" explicitamente, com o motivo em uma linha.
- Rodar `pnpm test` só se o usuário pedir execução; caso contrário, reportar o que o diff/PR declara e marcar o resto como não verificado.
- Propor fatiamento concreto (mensagem + arquivos) quando apontar commit inchado.

## Nunca

- Editar código, escrever teste ou commitar — a saída é o relatório.
- Exigir teste `.tsx` ou de componente React: a suíte não os inclui; o caminho é `*.logic.ts` + smoke.
- Exigir spec Playwright versionada no repo.
- Exigir smoke para critério sem superfície UI.
- Exigir número ou percentual de cobertura: o critério é "cada camada tocada tem o teste da tabela", não uma métrica.
- Contar falha de teste pré-existente no branch base como achado deste diff — registre como pré-existente.
- Reclamar de estilo/formatação: `biome` decide isso.

# F06 Smoke Results

**Feature:** F06 Rules  
**Data:** 2026-08-04 (~08:20 BRT)  
**Ambiente:** `pnpm dev` com `ENGRENACODE_USER_DATA=%TEMP%\engrena-smoke-f06f07` + Playwright em `http://localhost:5173` + `node scripts/smoke-f06.mjs`  
**Credenciais smoke:** workspace `~/smoke-onda2` · password `smoke-onda2-pass`

## Pré-requisitos

- [x] `pnpm install`
- [x] `pnpm test` verde (139/139, incl. rules)
- [x] App em `pnpm dev`, unlock HTTP + UI login
- [x] Unlock server `127.0.0.1:5174`

## API (`x-engrenacode-session`) — `node scripts/smoke-f06.mjs`

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| A0 | Sem sessão em `GET /api/rules` | 401 (ou 423) | pass (`401`) |
| UNLOCK | `POST /api/vault/unlock` | sessionToken | pass |
| A1 | `POST /api/rules` create | 201 + id | pass |
| A2 | Name com CR/LF | 400 | pass (`invalid_request`) |
| A3 | Content >1 MiB | 400 `too_long` | pass |
| A4 | Name duplicado | 409 `rule_name_conflict` | pass |
| A5 | Content ~9 KB (soft) | 201 | pass |
| A6 | Create global | 201 | pass |
| A7 | Global + `PUT …/projects/:id/rules/:id` `enabled:false` | `suppressedHere=true` | pass |
| A8 | Local link `enabled:true` | `linked` + `activeInProject` | pass |
| A9 | `GET /api/rules/counts` | global + activeByProject | pass |
| A10 | `GET /api/rules` list | array ≥1 | pass |

## UI `#rules` — Playwright

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| U1 | Mount `#rules` | grid + cards das rules smoke; copy EngrenaCode | pass |
| U2 | `+ Nova rule` | modal Nova rule | pass |
| U3 | Name duplicado submit | alert `Já existe uma rule…` | pass |
| U4 | Soft size | card `smoke-f06-soft` mostra ~9 KB | pass |
| U5 | Light + dark | Tema Claro/Escuro sem crash | pass |
| U6 | Marca | EngrenaCode presente; 0 referências à marca legado | pass |
| U7 | Name CR/LF no form | `rulesForm.error.nameInvalid` | pass via unit `ruleForm.logic` + API A2 (input controlado engole `\n` no Playwright fill) |
| U8 | Cap >15 / aggregateHot / harness | overlay projeto | **pass** (2026-08-17 — ver "Fechamento dos itens deferred") |
| U9 | Bloco no turno | inject F03 | **pass** (2026-08-17 — turno pago real, ver abaixo) |

## Unitário (já no suite)

| Suite | Resultado |
|-------|-----------|
| `rules.test.ts` / `rules-handler.test.ts` / `ruleForm.logic.test.ts` / `rules-block.test.ts` | pass (suite global 139/139) |

## Critérios PRD §9

| Critério | Status |
|----------|--------|
| Rules globais e por projeto resolvem com override de supressão | **pass** (API A7/A8 + unit `resolveForTurn`) |
| Bloco de rules em todo turno (precedência) | **pass** (2026-08-17 — turno pago real com conflito rule × `CLAUDE.md`) |
| Name com CR/LF rejeitado | **pass** (API A2 + unit) |

## Notas

- Vault/DB isolados em `%TEMP%\engrena-smoke-f06f07`.
- Script: `scripts/smoke-f06.mjs`.


---

## Fechamento dos itens deferred (2026-08-17)

U8 e U9 esperavam o turn-runner e o Repo Harness do F03, que já existem há tempo. Fechados aqui com
o app real (`pnpm dev`), projeto fixture git em path curto e vault real do usuário.

### U8 — cap de 15 e agregado de 16 KB no overlay do projeto

14 rules de projeto criadas e vinculadas (mais as 2 globais do usuário = 16 ativas) e uma rule de
~21,8 KB para passar do teto de bytes. O Repo Harness mostrou `Rules 17 ativas` e o overlay trouxe as
duas faixas, literais do `copy.md`:

```
Rules ativas neste projeto: 17 · ~21,9 KB por turno — acima de 16 KB; considere enxugar (não bloqueia).
17 rules ativas — acima de 15; considere enxugar (não bloqueia).
```

Screenshot: `smoke-cap-agregado.png`.

**Override de supressão ao vivo:** desligar a global no projeto levou o contador de 17 para 16 e a rule
voltou `activeInProject: false`, `suppressedHere: true` com `enabled: true` — ou seja, suprimida ali e
intacta nos outros projetos. Foi pela API (`PUT /api/projects/:id/rules/:ruleId`), que é o mesmo
endpoint que o toggle do overlay chama; o clique em si não foi exercitado nesta rodada.

### U9 — bloco de rules no turno real

Rule de projeto com um marcador que não existe em lugar nenhum do repositório:

```
rule:     "Comece TODA resposta com o prefixo literal [F06-2f7a] antes de qualquer outra palavra."
prompt:   "Responda apenas: tudo certo."
resposta: "[F06-2f7a] tudo certo."
```

### Precedência sobre arquivo do repo

Primeira tentativa foi mal desenhada e vale registrar para não se repetir: a rule pedia o prefixo
`[F06-2f7a]` e um `CLAUDE.md` do repo pedia `[REPO-9zz]`. O modelo respondeu `[F06-2f7a] [REPO-9zz] ok.`
— obedeceu aos dois, porque as instruções não eram mutuamente exclusivas. Dois prefixos, com o da rule
primeiro, é resposta correta e não prova precedência nenhuma.

Refeito com instruções incompatíveis por construção:

| Origem | Instrução |
|---|---|
| rule de projeto | Responda SEMPRE em português do Brasil, em qualquer circunstância. |
| `CLAUDE.md` do repo | Always answer in English, never in any other language. |

Pergunta feita **em inglês** (`Say in one short sentence what this repository contains.`), para não dar
pista de idioma pelo prompt. A resposta veio em português, e o próprio modelo explicitou a decisão:

> `CLAUDE.md` do repo manda responder em inglês, mas regra de projeto do dono ("responder sempre em
> português do Brasil") tem precedência. Respondi em PT-BR.

Fecha `projeto > arquivos do repo` do critério do PRD §9.

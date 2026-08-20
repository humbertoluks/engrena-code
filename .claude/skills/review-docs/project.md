# Bindings — EngrenaCode (Documentação)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

## Conjuntos documentais

Este repo tem **três escopos que nunca se misturam**. Revisar um conjunto significa também conferir
que nada dele invadiu o escopo do vizinho.

| Escopo | Raiz | Conteúdo |
|--------|------|----------|
| Engrena (monorepo) | `docs/` | Design Lock, sprints, architecture |
| EngrenaCode | `apps/engrena-code/docs/` | PRD, PROGRESS, features `F*`, runbooks, auditorias |
| EngrenaPlan | `apps/engrena-plan/docs/` | PRD/README próprios |

Feature do Code não vai em `docs/` da raiz; Design Lock não se duplica sob os apps.

## Conjunto de entrada (guia de setup)

| Arquivo | Propósito declarado |
|---------|---------------------|
| `apps/engrena-code/docs/README.md` | Índice dos docs do app |
| `apps/engrena-code/docs/DEVELOPMENT.md` | Quick start |
| `apps/engrena-code/docs/GLOSSARY.md` | Vocabulário |
| `apps/engrena-code/docs/RUNBOOK-BUILD.md` | Caminho de empacotamento |

**Nunca revisados de conteúdo.** Saíram de um split de `DEVELOPMENT.md` (560 → 125 linhas) no PR #27,
mergeado em 2026-08-20 sem revisão de conteúdo — só de coerência estrutural. É o alvo natural da
primeira execução desta skill, e a comparação de split se faz contra `f14eae0~1`.

## Vizinhos que o conjunto referencia e não deve duplicar

`PRD.md`, `PROGRESS.md`, `RUNBOOK-HOMOLOGACAO.md`, `F<ID>-*/spec.md`, `F<ID>-*/plan.md`,
`F<ID>-*/ui.md`, `F<ID>-*/copy.md`, `archived/CLAUDE_ARCHIVE.md`, e o `CLAUDE.md` da raiz.

Atenção especial a `RUNBOOK-BUILD.md` × `RUNBOOK-HOMOLOGACAO.md`: **produzir** o artefato e
**validar** o artefato pronto são assuntos diferentes, e é o par com maior risco de duplicação.

## Precedência de fontes de verdade

1. Código e config do repo (`package.json`, `vite.config.ts`, migrations, `src/**`)
2. `PRD.md` §9 e `F<ID>-*/spec.md`
3. `PROGRESS.md`

Prosa de doc **nunca** é fonte para conferir outro doc.

## O que conferir com prioridade neste repo

| Alvo | Onde a verdade está |
|------|---------------------|
| Comandos e filtros pnpm | `package.json` raiz e de cada app |
| Portas de dev | `.env.example`, `vite.config.ts` — Vite ≥5173 exceto 5174 e 5184; unlock em 5174 |
| Gate de tipo | `pnpm --filter engrena-code exec tsc -b` (`--noEmit -p tsconfig.json` é falso verde) |
| Caminho do banco / userData | `src/services/db/client.ts`, `ENGRENACODE_USER_DATA` |
| Nomes de rota | `src/services/http/*-handler.ts` (regex **e** o guarda de prefixo) |
| Tabelas e colunas | `src/services/db/migrations/NNN_*.ts` |
| Faixa de versão do CLI | `src/services/runner/providers/permission-contract.ts` |

## Registros históricos deste repo

Não são backlog. Já carregam o cabeçalho de encerramento; conferir que continua lá:

- `apps/engrena-code/docs/AUDIT-CODE-REVIEW.md` — encerrada em 2026-08-17, zero achados abertos
- `apps/engrena-code/docs/AUDIT-PRD-S9-MIGRATION.md` — encerrada em 2026-08-07, 103/103
- `apps/engrena-code/docs/archived/CLAUDE_ARCHIVE.md` — regras consolidadas, ainda válidas

## Precedentes vivos

| Regra | Onde este repo pagou por ela |
|-------|------------------------------|
| `closed-record-reads-as-open` | As duas auditorias ficaram semanas encerradas lendo como artefato vivo; o cabeçalho só entrou em 2026-08-20 |
| `expectation-outlived-the-code` | Check D1 do runbook exigia reconciliação para `error` depois de a F35 mudar para `interrupted` — reprovaria o comportamento correto, e trazia `✅` de rodada anterior |
| `self-declared-validity` | `docs/_shared/codebase-patterns.md` declarava `status: fresh` com `git_sha` anterior à conversão monorepo; a regra de staleness do `spec-writer` nunca disparou porque exigia desconfiar do campo |
| `numbers-that-age` | Contagem de testes e "os 12 handlers" gravados em skill de roteamento, o que motivou a regra `Skills · Manutenção` do `CLAUDE.md` |

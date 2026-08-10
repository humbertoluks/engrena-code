---
name: audit-full-base
description: >-
  Orquestra auditoria full-base do EngrenaCode: review-architecture,
  review-robustness e review-delivery em sequência; grava
  docs/AUDIT-CODE-REVIEW.md; sincroniza Coding Experts (.claude/skills/coding-*).
  Use com /audit-full-base, reauditoria, “rodar as 3 reviews”, auditoria da base,
  escopo src/, ou quando o diff das reviews individuais estiver vazio.
---

# Audit — Full base

Coordena as 3 reviews, atualiza o artefato **e** as Coding Experts. **Não** edita `src/` (correção é sessão à parte).

**Idioma:** artefato/relatos em PT-BR; paths, símbolos, códigos e commits em inglês.

## Quando usar

- Reauditoria / “3 reviews” / auditoria da base / `/audit-full-base`.
- Escopo = `src/` completo (não só `git diff` do branch).
- Precisa de `docs/AUDIT-CODE-REVIEW.md` + coding experts alinhadas.

Diff/PR/feature isolada → use `review-architecture` | `review-robustness` | `review-delivery` direto.

## Orquestração

```
coordenador
  → review-architecture   (leitura, contexto limpo)
  → review-robustness     (leitura; resumo curto dos 🔴 de arch)
  → review-delivery       (leitura; achados 1–2; pode pnpm test)
  → consolida docs/AUDIT-CODE-REVIEW.md
  → sincroniza .claude/skills/coding-*
```

Regras:

1. **Um subagente por vez** — nunca paralelo.
2. Cada um lê a `SKILL.md` da frente; escopo **`src/`** (não “diff vazio → pare”).
3. Subagentes: sem editar, commit, `biome --write`, `tsc -b`, `pnpm build`. Delivery pode `pnpm test`.
4. Divergência de fato entre frentes → coordenador **rele o código** e decide.
5. Sem lote de fix em `src/`.
6. Sem sync das Coding Experts a passagem está **incompleta**.

Reviews: `review-architecture` · `review-robustness` · `review-delivery`  
Exemplos de relato e prompt de subagente: [references/examples.md](references/examples.md)

### Coding Experts

| Stack | Skill (roteamento + rules + project) |
|-------|--------|
| `Electron` | `coding-electron` → sync em `project.md` |
| `React` | `coding-react` → sync em `project.md` |
| `Node.js` | `coding-nodejs` → sync em `project.md` |
| `SQLite` | `coding-sqlite` → sync em `project.md` |
| `TypeScript` | `coding-typescript` → sync em `project.md` |
| `Vitest` | `coding-vitest` → sync em `project.md` |

Paths sob `.claude/skills/<name>/`. Achados de passagem **não** entram em `rules/`.

## Sincronizar Coding Experts

Após gravar o artefato, edite só `coding-*/project.md` com delta nesta passagem.

Cada Coding Expert tem três camadas:

| Arquivo | Papel | Audit escreve? |
|---------|--------|----------------|
| `coding-*/SKILL.md` | Índice de roteamento portável | Só se o mapa de slugs mudou |
| `coding-*/rules/*.md` | Regras atômicas **portáveis** (Incorrect/Correct) | **Nunca** (achado de passagem não entra aqui) |
| `coding-*/project.md` | Bindings do EngrenaCode (paths, `RC-*`, abertos) | **Sim** — alvo da sincronização |

**Abertos novos/alterados:** em `project.md`, lista “Achados abertos” (`ID` + path curto + 1 linha de correção). Se o tipo for novo e ainda não existir regra portável adequada, acrescente o slug em `rules/` numa sessão de manutenção da skill (não no meio do fix); no interim, o detalhe fica só no artefato.

**Abertos → corrigidos** (confirmado no código): tire de “Achados abertos” em `project.md`; ponha em “Já corrigidos — não regrida” (`RC-…`). Limpe entradas stale.

**Nada volátil em `rules/` nem no `SKILL.md` de roteamento.** Contagem de teste, contagem de handler, data de passagem e "hoje temos N" envelhecem e mentem. Em `project.md` entram só: mapa de paths, invariantes de contrato (ex.: "não existe passthrough genérico no preload") e IDs `RC-*` / abertos. Número, data e evidência ficam só no artefato.

Escopo de escrita do coordenador:

- Pode: `docs/AUDIT-CODE-REVIEW.md`, `coding-*/project.md`, ajuste pontual em `review-*` se o mapa do repo mudou; `coding-*/SKILL.md` só se a tabela de slugs precisar refletir regra portável nova.
- Não pode: `src/**`, `PROGRESS.md`, `PRD.md`, `coding-*/rules/**` (salvo manutenção explícita da skill), commit/PR (salvo pedido explícito).
- Sem delta numa Stack → não reescreva `project.md` por estética.
- Relato final lista quais `coding-*/project.md` mudaram (ou “nenhuma”).

## Artefato

**Path:** `docs/AUDIT-CODE-REVIEW.md`

### Estrutura

1. Cabeçalho (data, escopo, método, contagens)
2. **Instruções de remediação** — texto canônico em [references/remediation.md](references/remediation.md) (obrigatório; não omitir)
3. Resumo executivo (Stack × severidade; top bloqueadores)
4. Achados abertos — `ID | Stack | Sev | Frente | Local | Problema | Regra`
5. Regras abertas — 1 tipo × Stack (template em [references/remediation.md](references/remediation.md))
6. Problemas corrigidos — tabela + regras `RC-…`
7. Fora de escopo / dívida + fatiamento sugerido
8. Como atualizar (ponteiro a esta skill)

### Taxonomia de Stack

| Stack | Paths típicos |
|-------|----------------|
| `Electron` | `src/main/`, `src/preload/`, IPC, PTY |
| `React` | `src/renderer/` |
| `Node.js` | `http/`, `vault/`, `runner/`, `git/`, `vcs/`, `mcps/`, `codegraph/` |
| `SQLite` | `src/services/db/` |
| `TypeScript` | tipagem pura (prefira Stack do arquivo) |
| `Vitest` | `*.test.ts`, smoke, gates, commits |

Severidade: 🔴 bloqueador · 🟡 aviso · 🟢 ok (só resumo se útil).

### Fontes dos corrigidos

1. Passagem anterior do artefato  
2. Commits/lotes + `PROGRESS` + `smoke-results` vs código atual  
3. De `AUDIT-PRD-S9-MIGRATION.md` só lições técnicas reutilizáveis (não a matriz §9)  
4. Dedupe: 1 regra × tipo × Stack  

## Saída

- Artefato com seção de remediação ([references/remediation.md](references/remediation.md))
- Coding Experts sincronizadas
- Relato: contagens, top 🔴, path do artefato, lista `coding-*/project.md` tocados ([references/examples.md](references/examples.md))
- Sem editar `src/` / `PROGRESS` / `PRD` / commit, salvo pedido explícito

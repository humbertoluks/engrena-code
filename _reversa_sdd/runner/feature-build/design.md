# feature-build, Design Técnico

> Como o motor `/featbuild` e o journal write-ahead são construídos no legado.

## Interface

### Entrada do motor

| Campo | Tipo | Papel | Confiança |
|-------|------|-------|-----------|
| `ctx` | DispatchContext | deps | 🟢 |
| `build` | FeatureBuild row | estado DB | 🟢 |
| `repoPath` | string | cwd | 🟢 |
| `sprints` | SprintItem[] | plano de execução | 🟢 |

### `build-state.json` (journal)

| Estado journal | Significado | Confiança |
|----------------|-------------|-----------|
| `prepared` | intent registrado | 🟢 |
| `running` | execução ativa | 🟢 |
| `completed` | commit final do journal | 🟢 |

Local: repo (path derivado do slug/feature) 🟢

### Transições globais (`FeatureBuildStatus`)

| De | Para legais | Confiança |
|----|-------------|-----------|
| `running` | interrupted, error, failed, exhausted, done | 🟢 |
| interrupted/error/failed | running (Retomar) | 🟢 |
| exhausted/done/cancelled | ∅ terminais | 🟢 |

## Fluxo Principal

1. dispatch verifica ausência pipeline ativo 🟢
2. Motor abre journal: `prepared` em build-state.json 🟢
3. Transição DB → `running`; journal → `running` 🟢
4. Para cada sprint:
   - pending → in-progress 🟢
   - Executa turno(s) com driver 🟢
   - Terminal: done | failed | aborted 🟢
5. Agregação: se ≥1 failed → build `failed`; se operacional → `error` 🟢
6. Journal → `completed`; persist DB terminal 🟢

## Fluxos Alternativos

- **Retomar:** interrupted/error/failed → running (explícito) 🟢
- **Recovery dangling:** journal `running` sem motor ativo → reconcile 🟢
- **Review reject:** restore baseline código; metadados build intactos 🟢
- **cancelled:** read-only legado; novos fluxos não escrevem 🟢
- **exhausted:** sprints esgotados sem done completo 🟢

## Dependências

- `shared/feature-build.ts` — matriz de transições 🟢
- `runner/build-state.ts` — journal IO 🟢
- `git/review-baseline.ts` — baseline para reject 🟢
- `repositories/feature-builds.ts` — persistência 🟢
- dispatch — entry e conflito pipeline 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| failed≠error (ADR-19) | feature-build.ts | 🟢 |
| Motor escritor único | feature-build-motor | 🟢 |
| Write-ahead journal | build-state.ts | 🟢 |
| cancelled RO legado | feature-build.ts | 🟢 |
| Retomada explícita (não onIdle) | domain R15 | 🟢 |

## Estado Interno

| Artefato | Onde | Notas |
|----------|------|-------|
| FeatureBuild row | SQLite | status global |
| build-state.json | repo | journal |
| SprintItem status | SQLite + journal | sincronizados pelo motor |

## Observabilidade

- WS state.change em transições 🟢
- Mensagens sintéticas build 🟢

## Riscos e Lacunas

- 🟡 Path exacto de build-state.json por slug
- 🔴 ADR-13/15/17/19 como ficheiros (só referência no código)

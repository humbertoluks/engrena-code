# memory, Design Técnico

> Como o módulo Memory é construído, com base no legado.

## Interface

### Rotas HTTP

| Método | Caminho | Entrada | Saída | Confiança |
|--------|---------|---------|-------|-----------|
| GET | `/projects/:id/memory` | projectId | `ProjectMemoryResponse` | 🟢 |
| PUT | `/projects/:id/memory` | memory, baseHash | 200 / 409 / 422 | 🟢 |
| PUT | `/projects/:id/memory/config` | enabled, dreaming, provider | config | 🟢 |
| DELETE | `/projects/:id/journal` | — | limpa entradas (preserva verbatim) | 🟢 |
| POST | `/projects/:id/journal/reset` | — | reset verbatim (P7) | 🟢 |

### Tetos (shared/project-memory.ts)

| Constante | Valor | Uso | Confiança |
|-----------|-------|-----|-----------|
| `MEMORY_MAX_BYTES` | 8192 | PUT/save_memory reject | 🟢 |
| `JOURNAL_MAX_ENTRIES` | 400 | rotação | 🟢 |
| `JOURNAL_MAX_FILE_BYTES` | 1 MiB | teto arquivo | 🟢 |
| `JOURNAL_INJECT_MAX_BYTES` | 3100 | injeção prompt | 🟢 |
| `MEMORY_INJECT_MAX_BYTES` | 8192 | injeção prompt | 🟢 |

### Injeção no runner

| Componente | Entrada | Saída | Confiança |
|------------|---------|-------|-----------|
| `composeMemoryBlock` | ProjectMemoryTarget | markdown + hint line | 🟢 |
| `MemorySessionGate` | hash memory | re-inject só sessão nova | 🟢 |

## Fluxo Principal

1. Git events / head-delta → append journal (caller sob `withRepoLock`) 🟢
2. Tool `save_memory` ou PUT UI → seção canônica + dedupe + teto bytes; CAS 🟢
3. Dispatch: `composeMemoryBlock` lê fatia bounded de memory+journal 🟢
4. Dreaming (sub-unit `gravar-e-dreaming`): gatilho → pump → consolidator 🟢

## Fluxos Alternativos

- **Anomalia FS:** symlink ou arquivo acima do teto → editable false 🟢
- **Kill switch OFF:** bloco omitido; journal pode continuar 🟡
- **Head-delta:** só commits ancestrais; máx 20 por turno 🟢

## Dependências

- `git` — repo-lock, project-execution 🟢
- `providers` — env Claude para consolidator 🟢
- `app_config` — toggles globais 🟢
- `runner/dispatch` — injeção e gatilhos dreaming 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Tetos em bytes UTF-8, não chars | shared/project-memory.ts | 🟢 |
| Memory como dado, não instrução | boundary sanitize | 🟢 |
| Path sempre server-side | ProjectMemoryTarget | 🟢 |
| Tri-state config projeto ?? global | config.ts | 🟢 |

## Estado Interno

| Estado | Onde | Notas |
|--------|------|-------|
| `.lioncode/journal.md` | FS projeto | append-only gerenciado |
| `.lioncode/memory.md` | FS projeto | 3 seções + CAS |
| dreamer-state | memória server | por projectId 🟢 |

## Riscos e Lacunas

- 🔴 UI exacta de reset journal vs clear
- 🟡 Interacção MemorySessionGate com resume de provider
- 🟡 Providers elegíveis dreaming além de claude/glm/minimax

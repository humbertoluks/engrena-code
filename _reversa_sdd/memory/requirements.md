# memory

> Spec de requisitos do módulo Memory (`packages/server/src/memory`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Memória persistente por projeto em `<projeto>/.lioncode/`: `journal.md` (eventos git determinísticos) e `memory.md` (conteúdo curado). Injeção limitada no prompt do agente, tetos em bytes UTF-8, kill switches tri-state e dreaming/consolidação LLM fail-closed. 🟢

## Responsabilidades

- FS seguro: ensure `.lioncode/`, anti-symlink, readBounded, writeAtomic 🟢
- Journal: gramática commit/push/pr; sanitize; rotação por entradas e bytes 🟢
- Memory: template 3 seções (Decisões, Restrições, Pendências); dedupe 🟢
- Head-delta: delta de HEAD no turno (ancestralidade, teto 20 commits) 🟢
- Config tri-state: projeto ?? global ?? ON; dreaming exige memory ON 🟢
- Bloco markdown injetado no runner (`composeMemoryBlock`) 🟢

## Regras de Negócio

- Path nunca vem do cliente (`ProjectMemoryTarget` server-side) 🟢
- Conteúdo de memory é DADO, nunca instrução (boundary sanitize) 🟢
- Anomalia/truncado ⇒ `editable: false`, PUT/dream bloqueados 🟢
- Só "Resetar journal" descarta verbatim do dono (P7) 🟢
- Codex/grok fora do dreaming (sem modo sem tools) 🟢
- `.lioncode/` no git exclude (ensure-once) 🟢
- Dreaming: trigger 80%, hard-reject output 75%, debounce 24h, fail streak 3 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | GET memory retorna memory, journal tail, limits, dreaming state | Must | Response conforme `ProjectMemoryResponse` |
| RF-02 | PUT memory com CAS por baseHash | Must | 409 em conflito de hash |
| RF-03 | Eventos git append journal sob repo lock | Must | Linhas sanitizadas; tetos respeitados |
| RF-04 | composeMemoryBlock injeta fatia limitada no prompt | Must | Hint line sempre presente |
| RF-05 | Config tri-state enabled/dreaming por projeto | Should | null herda global |
| RF-06 | Journal clear via DELETE `/journal`; reset via POST `/journal/reset` | Should | Reset só via acção explícita (P7) |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Segurança | Anti-symlink em `.lioncode/` | `project-memory-fs.ts` | 🟢 |
| Integridade | CAS por hash SHA-256 | `memory-file.ts` | 🟢 |
| Performance | Leitura bounded UTF-8 safe cut | `utf8BoundaryCut` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado um projeto com memory.md válido
Quando GET /projects/:id/memory
Então memory, journalTail, limits e dreaming.enabled são retornados

Dado memory acima de MEMORY_MAX_BYTES editado externamente
Quando GET memory
Então memoryTruncated=true, editable=false e contentHash=null

Dado evento git commit sob repo lock
Quando journal append
Então nova linha entra no journal respeitando JOURNAL_ENTRY_MAX_CHARS

Dado memory desligada globalmente e null no projeto
Quando composeMemoryBlock
Então bloco vazio ou omitido conforme kill switch
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-04 | Must | Contexto persistente do agente |
| RF-05, RF-06 | Should | Operacionalidade e config |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/memory/project-memory-fs.ts` | FS base | 🟢 |
| `packages/server/src/memory/journal.ts` | append, sanitize | 🟢 |
| `packages/server/src/memory/memory-file.ts` | template, dedupe | 🟢 |
| `packages/server/src/memory/config.ts` | tri-state toggles | 🟢 |
| `packages/server/src/runner/memory-block.ts` | composeMemoryBlock | 🟢 |
| `shared/src/project-memory.ts` | tetos e contratos | 🟢 |

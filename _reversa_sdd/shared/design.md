# shared, Design Técnico

> Como o catálogo `@lioncode/shared` é organizado e consumido.

## Interface

### Pacote

| Símbolo | Papel | Confiança |
|---------|-------|-----------|
| `@lioncode/shared` | Entry `shared/src/index.ts` reexporta domínio | 🟢 |

### Domínios exportados (amostra)

| Módulo | Exports chave | Confiança |
|--------|---------------|-----------|
| `thread.ts` | `Provider`, `ThreadState`, `AccessLevel`, `ExecutionMode`, `isProvider` | 🟢 |
| `models.ts` | `PROVIDER_MODELS`, `findModelById`, `contextWindowFor` | 🟢 |
| `dispatch-validation.ts` | `parseDispatchTaskRequest`, `validateEffectiveDispatchSelection`, limites | 🟢 |
| `feature-pipeline.ts` | fases, tipos de pipeline | 🟢 |
| `feature-build.ts` | estados, `canTransitionFeatureBuild` / sprint | 🟢 |
| `stream-event.ts` | união de eventos WS | 🟢 |
| `api.ts` | DTOs request/response HTTP | 🟢 |
| `execution-capabilities.ts` | capabilities por provider | 🟢 |
| `vault.ts`, `mcp.ts`, `subagent.ts`, `skill.ts`, `rule.ts` | catálogos de domínio | 🟢 |

### Validação de dispatch (contrato)

```ts
// limites e parsers — sem I/O
DISPATCH_PROMPT_MAX_CHARS
DISPATCH_IMAGE_MAX_COUNT
parseDispatchTaskRequest(body: unknown): Validated…
validateEffectiveDispatchSelection(selection): …
```
🟢

## Fluxo Principal

1. Autor altera tipos/constantes em `shared/src/*.ts` 🟢
2. `index.ts` reexporta para consumidores 🟢
3. Server e renderer importam o mesmo símbolo (pnpm workspace) 🟢
4. Runtime: funções puras (`isProvider`, parsers, `canTransition*`) executam no processo do consumidor 🟢

## Fluxos Alternativos

- **Valor fora do catálogo:** `isProvider` → false; callers rejeitam 🟢
- **Payload inválido:** parsers falham; rota HTTP devolve 4xx (lado server) 🟢
- **Transição ilegal de build:** `canTransition*` false; motor não avança 🟢

## Dependências

- Nenhuma runtime 🟢
- Consumidores: `packages/server`, `packages/renderer`, (tipos estruturais no shell) 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Shared sem runtime deps | package / imports | 🟢 |
| Enums fechados no shared (não strings soltas) | `thread.ts` arrays + type unions | 🟢 |
| Validação de dispatch no shared (reuso UI+API) | `dispatch-validation.ts` | 🟢 |
| Máquinas de build/pipeline no shared | `feature-*.ts` | 🟢 |

## Estado Interno

- Stateless: só constantes e funções puras 🟢

## Observabilidade

- N/A (biblioteca de tipos) 🟢

## Riscos e Lacunas

- 🟡 Barrel pode omitir export pontual se ficheiro novo não for adicionado ao `index.ts`
- 🔴 Documentação humana de cada DTO HTTP não está espelhada em OpenAPI (nível essencial omite)

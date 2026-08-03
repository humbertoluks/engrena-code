# shared

> Spec de requisitos do pacote `@lioncode/shared`.  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Catálogo de tipos, constantes e validadores compartilhados entre shell, server e renderer. Fonte de verdade dos contratos HTTP/WS e do domínio (threads, providers, pipelines) **sem dependências runtime**. 🟢

## Responsabilidades

- Exportar tipos de domínio (Project, Thread, Message, Diff, MCP, Vault DTOs, etc.) 🟢
- Catalogar providers, modelos, access/execution modes e capabilities 🟢
- Validar payloads de dispatch (`parseDispatchTaskRequest`, limites de prompt/imagem) 🟢
- Definir máquinas/contratos de Feature Pipeline e Feature Build 🟢
- Tipar eventos de stream WebSocket (`stream-event`) 🟢

## Regras de Negócio

- Pacote sem deps runtime; só tipos + funções puras 🟢
- `PROVIDERS = claude|codex|glm|minimax|grok|kimi` é o catálogo canónico 🟢
- `isProvider` rejeita valores fora do catálogo 🟢
- `executionMode` e `accessLevel` são enums fechados em `thread.ts` 🟢
- Transições de Feature Build / Build Sprint via `canTransition*` 🟢
- Limites: `DISPATCH_PROMPT_MAX_CHARS`, `DISPATCH_IMAGE_MAX_COUNT` 🟢
- Session header documentado no domínio como `X-sistema-legado-Session` 🟢
- Completeness do barrel `index.ts` vs todos os módulos internos 🟡

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | Exportar tipos e constantes usados por server e renderer | Must | Import de `@lioncode/shared` resolve sem erro |
| RF-02 | Validar provider contra catálogo | Must | `isProvider('claude')` true; valor inválido false |
| RF-03 | Parse/validate de dispatch task request | Must | Body inválido lança/retorna erro tipado |
| RF-04 | Funções de transição Feature Build | Must | Transições ilegais retornam false |
| RF-05 | Catálogo `PROVIDER_MODELS` com lookup por id | Should | `findModelById` encontra modelo conhecido |
| RF-06 | Tipos de stream-event alinhados ao fan-out WS | Must | Eventos tipados cobrem text/tool/diff/state |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Manutenibilidade | Zero runtime deps | `shared/package.json` / ausência de imports externos | 🟢 |
| Segurança | Validação de tamanho de prompt/imagem no shared | `dispatch-validation.ts` | 🟢 |
| Consistência | Única fonte de enums entre processos | consumo em server + renderer | 🟢 |

## Critérios de Aceitação

```gherkin
Dado um valor "claude"
Quando isProvider é chamado
Então o resultado é true

Dado um body de dispatch sem prompt válido
Quando parseDispatchTaskRequest processa
Então a validação falha de forma tipada (sem aceitar o payload)

Dado um estado Feature Build e uma transição ilegal
Quando canTransitionFeatureBuild é avaliado
Então retorna false

Dado server e renderer no mesmo monorepo
Quando ambos importam ThreadState de @lioncode/shared
Então usam o mesmo conjunto de literais
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-04, RF-06 | Must | Contratos quebram a app se divergirem |
| RF-05 | Should | UI/catalogo; core funciona com subset |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `shared/src/index.ts` | barrel | 🟢 |
| `shared/src/thread.ts` | PROVIDERS, isProvider, enums | 🟢 |
| `shared/src/models.ts` | PROVIDER_MODELS, findModelById | 🟢 |
| `shared/src/dispatch-validation.ts` | parse*/validate* | 🟢 |
| `shared/src/feature-build.ts` / `feature-pipeline.ts` | canTransition*, fases | 🟢 |
| `shared/src/stream-event.ts` | eventos WS | 🟢 |
| `shared/src/api.ts` | DTOs HTTP | 🟢 |

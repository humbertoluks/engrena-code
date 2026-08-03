# runner

> Spec de requisitos do módulo de execução (`packages/server/src/runner`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Camada central do servidor que orquestra turnos de ponta a ponta: lease de projeto, worktree/cwd, composição de contexto (rules, memory, codegraph, MCPs, skills, subagents), motores especializados (`workflow`, `/featdevelop`, `/featbuild`), consumo do stream do provider com **allocate-then-emit** de `seq`, persistência, diffs, cancel em cascata e delegação de subagentes (profundidade = 1). 🟢

## Responsabilidades

- Expor `runDispatch` / `scheduleDispatch` como orquestradores de turno 🟢
- Manter `TurnRegistry` (AbortController + árvore pai→filhos) 🟢
- Produzir `seq` monotônico por thread via `SeqAllocator` 🟢
- Mediar aprovações via `PermissionBroker` e `QuestionBroker` 🟢
- Delegar subagentes com RW-lock por `parentCwd` e rendezvous 🟢
- Despachar motores: workflow, feature-pipeline, feature-build 🟢
- Integrar patches de filhos (`integrate.ts`) e emitir eventos WS 🟢

## Regras de Negócio

- Único produtor de `seq` por thread; eventos de controle (`diff.ready`, `state.change`, `token.usage`) **sem** seq 🟢
- Profundidade de delegação = 1; filho nunca recebe `subagents`/`delegate` 🟢
- Erro do filho não derruba o pai; cancel → `status='cancelled'` 🟢
- Memória só no pai; falha de leitura → turno segue sem bloco 🟢
- Permission/question pendentes no cancel → deny / `{}` 🟢
- Pipeline: retomada via scheduler `onIdle`; build: retomada explícita 🟢
- Review pinado filtra metadados `docs/features/<slug>/` do diff pending 🟢
- Matriz fina PermissionBroker × provider 🟡

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | `scheduleDispatch` adquire lease e chama `runDispatch` | Must | 409 se projeto ocupado |
| RF-02 | `TurnRegistry` registra turno com AbortController e liga filhos | Must | cancel propaga pai→filhos |
| RF-03 | `SeqAllocator.next()` aloca antes de emitir blocos/tool_call.start | Must | seq monotônico por thread |
| RF-04 | Comando workflow/feature-pipeline/feature-build despacha motor correto | Must | motor assume loop do turno |
| RF-05 | Delegação via rendezvous + `runDelegatedSubagent` depth=1 | Must | filho efêmero sem row em threads |
| RF-06 | Fim de turno: flush, diffs, thread → `idle`/`error`; finally limpa brokers/lease | Must | MCPs e lease liberados |
| RF-07 | Watchdog filho: idle 20min, hard 2h, teto plano | Should | timeoutOrigin registrado |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Concorrência | RW-lock em `parentCwd` para delegação | `delegation-lock.ts` | 🟢 |
| Disponibilidade | Cancel cascade sem vazar turnos | `turns.ts` | 🟢 |
| Consistência | allocate-then-emit evita seq duplicado | `seq-allocator.ts` | 🟢 |
| Isolamento | D14: MCPs live-write; write+shared-read → worktree | `isolation-coercion.ts` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado uma thread idle e projeto sem lease ativo
Quando scheduleDispatch recebe um prompt
Então runDispatch registra turno, aloca seq e persiste mensagens com seq crescente

Dado um turno com subagente delegado
Quando o pai cancela via AbortController
Então o filho recebe cancel direto e status cancelled sem derrubar o pai

Dado um comando /featdevelop ativo
Quando runDispatch identifica strategy feature-pipeline
Então feature-pipeline-motor assume o loop e respeita fases imutáveis no código

Dado permission pendente no broker
Quando o turno é cancelado
Então a permissão resolve como deny e o turno encerra limpo
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-06 | Must | Sem runner não há conversa com IA |
| RF-07 | Should | Proteção contra filhos órfãos |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/runner/dispatch.ts` | `runDispatch`, `scheduleDispatch` | 🟢 |
| `packages/server/src/runner/turns.ts` | `TurnRegistry` | 🟢 |
| `packages/server/src/runner/seq-allocator.ts` | `SeqAllocator` | 🟢 |
| `packages/server/src/runner/delegate.ts` | `runDelegatedSubagent` | 🟢 |
| `packages/server/src/runner/permission-broker.ts` | `PermissionBroker` | 🟢 |
| `packages/server/src/runner/question-broker.ts` | `QuestionBroker` | 🟢 |
| `packages/server/src/runner/workflow-motor.ts` | motor workflow | 🟢 |
| `packages/server/src/runner/feature-pipeline-motor.ts` | motor /featdevelop | 🟢 |
| `packages/server/src/runner/feature-build-motor.ts` | motor /featbuild | 🟢 |

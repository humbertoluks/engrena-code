# Plano de Implementação: F22. Automação por Slash Commands (Pipeline)

**Pré-requisitos:**
- Herdar stack de `docs/_shared/codebase-patterns.md` e specs F03/F15/F18/F21 (dispatch, MCP `engrenacode`, `delegate`, `waiting_user`, DiffViewer)
- Dependências F03, F07, F15, F18, F19, F20, F21 implementadas no repo
- Sem dependência npm nova
- `ui.md`/`copy.md` de F22 existem (2026-08-08) — fases de UI do composer/painel/timeline devem consumir esses docs; não reinventar copy nem portar 7 fases/Aprovar PRD/Retomar da fonte

### Fase 1: Catálogo, parse e schema

**1. Catálogo e parse de slash** - Criar o módulo de comandos nativos (`spec` / `featdevelop` / `featbuild`) com parse tipado e códigos de erro estáveis; cobrir com testes unitários de casos válidos e inválidos.

**2. Migração e repositório de pipelines** - Adicionar a migração numerada seguinte (próximo índice livre após write-parallel) e o repositório de `pipelines` / `pipeline_stages` com defaults e listagem por thread.

**3. Gatilho no composer (lógica pura)** - Portar a detecção de `/` com âncora de início e a multiplexação com `@` para um módulo testável; estender `composer.logic` para bloquear envio de slash inválido antes do POST.

### Fase 2: Orquestração no runner

**4. Pipeline runner — `/spec`** - Implementar o caminho que resolve o subagent `planner`, dispara uma delegação F15 e persiste o pipeline; garantir que nenhum ficheiro é escrito automaticamente.

**5. Pipeline runner — `/featdevelop`** - Orquestrar os quatro estágios em sequência (`planner` → `implementer` → `reviewer` → `tester`), emitir eventos WS de estágio, e inserir checkpoint F21 antes de aplicar diffs gerados pelo estágio de implementação.

**6. Pipeline runner — `/featbuild`** - Executar o plano colado (args) sem replanejar, usando os checkpoints de revisão de diff F03 entre estágios de escrita; falha de estágio interrompe o pipeline preservando o já concluído.

**7. Hard-cap, cancel e wiring no dispatch** - Ligar o runner ao `dispatch` quando o prompt for slash nativo; aplicar hard-cap agregado de 2h; propagar cancel da thread ao pipeline; rejeitar slash inválido no server com 400.

### Fase 3: Superfície mínima no renderer

**8. Composer — menu e erro** - Montar autocomplete dos três comandos e o slot de erro inline no `TaskComposer` conforme `ui.md`/`copy.md` (ids `slash.*`).

**9. Painel + timeline + WS** - Tipar eventos `pipeline.*`; montar stepper 4 estágios + linha/bloco de timeline (`pipeline.*` / `timeline.*`); rehydrate do pipeline ativo na thread.

### Fase 4: Validação e fechamento

**10. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração + smoke). Confirmar os 5 ACs de F22, aceite visual do `ui.md` (menu + painel Central + erro inline) e uso cruzado F15/F18/F21/F03. Gate: suite e build verdes.

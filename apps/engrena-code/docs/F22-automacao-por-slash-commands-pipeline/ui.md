# Spec de UI: #principal (Slash Commands + Pipeline)

**Feature:** F22-automacao-por-slash-commands-pipeline  
**Destino:** EngrenaCode  
**Fonte de referência:** LionCodeLabs (`CommandMenu.tsx`, `commandTrigger.ts`, `TaskComposer.tsx` erro inline; `FeaturePipelinePanel.tsx` + `featurePipeline.logic.ts`; `WorkflowStageLine.tsx`)  
**Componente fonte:** `packages/renderer/src/components/composer/CommandMenu.tsx`, `TaskComposer.tsx`, `pipeline/FeaturePipelinePanel.tsx`, `WorkflowStageLine.tsx`  
**Componente destino (previsto):** `TaskComposer` + `commandTrigger` + menu slash; painel/timeline de pipeline no `#principal` (ChatHistory / card flutuante); erros inline no composer  
**Última atualização:** 2026-08-08

> **Gap fonte × Engrena Central:** a fonte tem 7 fases (`PRD` → `Aprovação do PRD` → `TECH` → `SPEC` → … → sprints), CTA **Aprovar PRD**, **Retomar**, lista de sprints/ondas/órfão, e descrições de slash ligadas a `docs/features/<slug>/`. O Central F22 (PRD/spec) usa **4 estágios** (`planner` → `implementer` → `reviewer` → `tester`), checkpoint via F21/diffs (não “Aprovar PRD”), **sem** Retomar/custom slash (v2.0). Anatomia do menu `/` e do card stepper é da fonte; labels de estágio e descrições dos 3 nativos no destino = contrato Central (PRD + fixture).

## Referência visual

| Artefato | Caminho |
|----------|---------|
| CommandMenu (fonte viva) | `docs/F22-automacao-por-slash-commands-pipeline/ui/command-menu-referencia.png` |
| Composer + menu `/` (fonte) | `docs/F22-automacao-por-slash-commands-pipeline/ui/composer-slash-menu-referencia.png` |
| Menu vazio (fonte) | `docs/F22-automacao-por-slash-commands-pipeline/ui/command-menu-empty-referencia.png` |
| Fixture Central (dark) | `docs/F22-automacao-por-slash-commands-pipeline/ui/slash-pipeline-fixture.html` |
| Fixture dark PNG | `docs/F22-automacao-por-slash-commands-pipeline/ui/slash-pipeline-fixture-dark.png` |
| Light (opcional) | TODO — captura fonte saiu em tema claro; fixture é dark |

> Fonte: Electron LionCodeLabs CDP `:9222` (2026-08-08), Vite `:5273`, unlock → projeto git temp → `/` no composer. Fixture: síntese Central (4 estágios + copy PRD) servida em loopback + `playwright-cli` screenshot.

## Escopo

**Inclui (Engrena F22 Central):**
- Gatilho `/` no composer (âncora de início, multiplex com `@` — comando vence)
- Autocomplete flutuante com os 3 nativos: `/spec`, `/featdevelop`, `/featbuild`
- Empty/loading do menu (`Nenhum comando` / `Buscando comandos…`)
- Erro inline no composer se slash inválido/mal formado (nada dispara)
- Painel de pipeline (stepper) com progresso `done/total`, status global, estágios nomeados + subagent, Cancelar
- Checkpoint pós-implementação: CTA + hint apontando DiffViewer / F21 (não auto-aplicar)
- Linha/bloco de estágio na timeline (`— estágio {i}/{n} · {fase}`)

**Exclui (visível na fonte, fora do Central / v2.0):**
- Fases PRD/TECH/SPEC-validation/sprints e badge `com findings`
- CTA **Aprovar PRD** / hint “Ajustes no PRD?…”
- **Retomar** pipeline interrompido
- Lista Sprints / onda / órfão / **Iniciar Dev** → `/featbuild {slug}`
- Slash customizáveis e CRUD admin de commands
- Descrições seed da fonte que falam em gravar em `docs/` (destino `/spec` não grava ficheiro)

## Anatomia (topo → base)

### A) `#principal` — CommandMenu no composer

Ordem (espelho fonte `CommandMenu` + `TaskComposer`):

1. Menu flutuante `role="listbox"` `aria-label="Comandos"` ancorado **acima** do textarea (`bottom-[calc(100%+6px)]`)
2. Lista scrollável `max-h-[260px]`: cada item = glyph `/` + `/{name}` mono + ` — {description}` muted (truncate)
3. Item ativo: `bg-accent/15`
4. Empty: texto muted **Nenhum comando**; loading: **Buscando comandos…**
5. Textarea com o token `/…` (completar seleção → `/{name} ` + fecha menu)
6. Slot de erro sob o composer: `text-xs text-red` `role="alert"` (padrão já usado na fonte para `error`)

### B) Painel Pipeline (card flutuante / sidebar thread)

Molde visual `FeaturePipelinePanel` (header colapsável + stepper), conteúdo Central:

1. Header: glyph ◈ + **Pipeline** + contagem `{done}/{total}` + chevron
2. Título do run (descrição truncada) + pill de status global
3. Stepper vertical 4 linhas: ícone status + label estágio · nome subagent + detail opcional
4. Alert de erro do pipeline / da última ação (se houver)
5. Em checkpoint: CTA primário + hint de diffs
6. **Cancelar pipeline** (fonte: confirmação em 2 cliques; destino pode manter o padrão)

### C) Timeline — bloco / linha de estágio

1. Linha viva (fonte `WorkflowStageLine`): pulso + `{stageId}` mono + `— estágio {index}/{total} · {phaseLabel}`
2. Bloco por estágio concluído/pausado: nome subagent + pill status + meta “Estágio {label} · subagent {name}”

**Alinhamento:** menu ancorado ao composer; painel irmão do fluxo de thread (como TodoPlan/FeaturePipeline na fonte); linha no fluxo do chat.  
**Largura máx.:** menu `min(420px, 92vw)`; painel largura da coluna de chat/painel.

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Menu | `absolute … z-50 w-[min(420px,92vw)] rounded-lg border border-border bg-surface shadow-lg` | fonte literal |
| Item | `rounded-md px-sm py-[6px] text-[12.5px]`; ativo `bg-accent/15` | |
| Glyph | SVG 14px `text-muted` | |
| Nome | `font-mono font-medium` | |
| Desc | `text-muted` após ` — ` | |
| Empty/loading | `px-sm py-[10px] text-[12px] text-muted` | |
| Erro composer | `mt-sm text-xs text-red` `role="alert"` | fonte TaskComposer |
| Painel | `rounded-xl border border-border … backdrop-blur-sm` | fonte FeaturePipelinePanel |
| Header painel | `text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted` | |
| Pill status | `text-[9.5px] uppercase`; amber/green/red por estado | |
| Stepper | `text-[12px]`; detail `text-[10.5px] text-muted` | |
| CTA checkpoint | `bg-accent … text-white` | |
| Cancelar | ghost `border-border bg-surface-2 text-muted` | |
| Linha estágio | `text-[11px] text-muted`; pulso accent/azul | fonte usa `#4c8ef0` no pulso — destino preferir token `accent` (`token-gap` se manter hex) |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |

### Observado na fonte

| Item | Fonte | Destino F22 |
|------|-------|-------------|
| Ordem menu (alpha por name) | featbuild, featdevelop, spec | manter ordem do catálogo estático (pode ser alpha ou ordem produto documentada) |
| Descrições seed | docs/features, adversarial validators | **substituir** pelas do Central (ver copy) |
| 7 fases + Aprovar PRD | FeaturePipelinePanel | **não** portar; 4 estágios + checkpoint diffs/F21 |
| Retomar / Sprints | resume + índice JSON | fora Central |
| `statusLabel` | executando, aguardando aprovação, … | reutilizar pills onde couber |
| `stagePhaseLabel` | em andamento… / integrando… / concluído | reutilizar na linha viva |
| Erro slash | PRD; fonte não tem string dedicada `slash_*` no composer | copy destino abaixo |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `LionCode → EngrenaCode` (nenhuma string do menu/painel traz a marca). Células = texto final no destino.

| Slot | Texto |
|------|-------|
| `slash.menu.aria` | Comandos |
| `slash.menu.empty` | Nenhum comando |
| `slash.menu.loading` | Buscando comandos… |
| `slash.cmd.spec` | /spec |
| `slash.cmd.spec.desc.fonte` | Escreve uma spec tecnica, valida com 2 agentes adversariais e entrega a versao corrigida em docs/. |
| `slash.cmd.spec.desc` | Gera spec.md + plan.md como texto estruturado na thread (não grava ficheiro). |
| `slash.cmd.featdevelop` | /featdevelop |
| `slash.cmd.featdevelop.desc.fonte` | Pipeline deterministico de feature: PRD -> gate humano -> TECH -> SPEC validada -> sprints JSON validadas, em docs/features/\<slug\>/. |
| `slash.cmd.featdevelop.desc` | Orquestra planner → implementer → reviewer → tester com checkpoint antes de aplicar diffs. |
| `slash.cmd.featbuild` | /featbuild |
| `slash.cmd.featbuild.desc.fonte` | Executa as sprints do Ciclo A (docs/features/\<slug\>/): ondas do dependsOn, loop dev -> verification -> feat-code-validator (3 rodadas), integracao por sprint. |
| `slash.cmd.featbuild.desc` | Executa um plano já aprovado (markdown) sem replanejar; checkpoints de diff F03. |
| `slash.error.invalid` | Comando slash inválido ou mal formado. |
| `slash.error.unknown` | Comando slash desconhecido. |
| `slash.error.missing_args` | Faltam argumentos após o comando. |
| `pipeline.header` | Pipeline |
| `pipeline.aria` | Pipeline de feature |
| `pipeline.status.running` | executando |
| `pipeline.status.awaiting` | aguardando aprovação |
| `pipeline.status.interrupted` | interrompido |
| `pipeline.status.error` | erro |
| `pipeline.status.done` | concluído |
| `pipeline.status.cancelled` | cancelado |
| `pipeline.status.timeout` | timeout |
| `pipeline.stage.planner` | Planejar · planner |
| `pipeline.stage.implementer` | Implementar · implementer |
| `pipeline.stage.reviewer` | Revisar · reviewer |
| `pipeline.stage.tester` | Testar · tester |
| `pipeline.cta.checkpoint` | Continuar após revisar diffs |
| `pipeline.hint.checkpoint` | Revise os diffs acumulados no painel Diff antes de continuar o pipeline. |
| `pipeline.cta.cancel` | Cancelar pipeline |
| `pipeline.cta.cancel.confirm` | Cancelar encerra o pipeline e MATA o turno em voo (inclusive um follow-up seu). Confirmar? |
| `pipeline.cta.cancel.confirmBtn` | Confirmar |
| `pipeline.cta.cancel.back` | Voltar |
| `pipeline.actionError` | Falha ao executar a ação do pipeline. |
| `timeline.phase.start` | em andamento… |
| `timeline.phase.integrating` | integrando… |
| `timeline.phase.done` | concluído |
| `timeline.line` | — estágio {index}/{total} · {phase} |

> Slots `*.desc.fonte` = literal seed (referência/auditoria). Implementação Engrena usa `*.desc` (Central). Erros `slash.error.*` = destino (PRD §6 sem string na fonte).

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| textarea Mensagem | textarea | sim | `/` no início do token abre menu; setas/Enter/Tab via composer; multiplex `@` |
| CommandMenu | listbox | — | items filtrados por query após `/`; clique seleciona |
| Enviar | button | — | bloqueado se slash inválido (client); server 400 `slash_*` |
| Pipeline collapse | button | — | `aria-expanded`; título Expandir/Recolher pipeline |
| CTA checkpoint | button | — | só em awaiting checkpoint; busy desabilita |
| Cancelar pipeline | button | — | 2 cliques com confirm (padrão fonte) |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | composer idle | sem menu; sem erro |
| `menu.open` | `/` âncora + query | listbox com matches |
| `menu.empty` | query sem match | **Nenhum comando** |
| `menu.loading` | fetch catálogo | **Buscando comandos…** |
| `filling` | digitação args | menu fecha após 1º espaço (fonte `commandTrigger`) |
| `error.slash` | submit inválido | alert vermelho; zero estágio |
| `pipeline.running` | estágio ativo | pill executando; ícone pulse |
| `pipeline.awaiting` | checkpoint | pill amber + CTA Continuar… |
| `pipeline.error` | falha estágio | pill erro + `errorDetail` |
| `pipeline.timeout` | hard-cap 2h | status timeout; estágios done preservados |
| `pipeline.cancelled` | cancel confirmado | terminal; sem Retomar (Central) |
| `disabled` | thread `running`/`waiting_user` | composer já bloqueia envio (F03/F21) |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| listbox custom | CommandMenu (como MentionMenu) |
| `Button` | CTA checkpoint / Cancelar |
| alert `role="alert"` | erro slash + erro ação pipeline |
| pills / status icons | stepper (reusar padrão SubagentActivity / fonte PhaseIcon) |
| ChatHistory block | bloco de estágio na timeline |

## Aceite visual

- [ ] Menu `/` bate com `command-menu-referencia.png` (layout/tokens); textos de descrição usam slots Central, não seed fonte
- [ ] Empty **Nenhum comando** verificável
- [ ] Erro inline vermelho sob o composer em slash inválido
- [ ] Painel 4 estágios + pills; sem PRD-gate / Sprints / Retomar
- [ ] Linha `— estágio i/n · …` alinhada a `WorkflowStageLine`
- [ ] Dark/light via tokens; fixture dark como referência do painel Central
- [ ] Sem marca Lion* na UI

## Perguntas em aberto

- Ordem fixa do catálogo no menu: alpha (fonte) vs ordem produto `spec → featdevelop → featbuild`?
- Confirmação em 2 cliques do Cancelar: obrigatória no Central ou simplificar a 1 clique + dialog do design system?
- Pulso da `WorkflowStageLine` na fonte usa hex `#4c8ef0` — mapear 100% para `accent`?

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F22-automacao-por-slash-commands-pipeline/spec.md` | Contratos parse, runner, WS, SQLite |
| `docs/F22-automacao-por-slash-commands-pipeline/plan.md` | Fases de implementação |
| `docs/F22-automacao-por-slash-commands-pipeline/copy.md` | Catálogo de microcopy |
| `docs/F21-askuserquestion/ui.md` | Checkpoint pergunta (quando não for só Diff) |
| `docs/F03-workspace/` | DiffViewer checkpoints `/featbuild` |
| `docs/design-system/` | Tokens |

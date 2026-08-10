# Spec de UI: #principal (Memória — linha no Repo Harness + modal do journal)

**Feature:** F20-memoria-persistente
**Destino:** EngrenaCode
**Fonte de referência:** LionCodeLabs (`packages/renderer/src/components/WorkspaceSidebar.tsx` linhas 594–623 — botão `Memória` como irmão de `Rules`; `packages/renderer/src/components/memory/ProjectMemoryModal.tsx`)
**Componente destino:** `src/renderer/components/workspace/WorkspaceSidebar.tsx` (linha no Repo Harness) + `src/renderer/components/memory/ProjectMemoryModal.tsx` (novo)
**Última atualização:** 2026-08-07

> **Relação com F20 técnico:** o backend e o contrato de dados já estão implementados (fases 1–11 do `plan.md`, commits `239c9ee`→`5eaa112`). Este doc fecha só a fase visual, que o `plan.md` Fase 4 deixou explicitamente bloqueada até `ui.md`/`copy.md` existirem.

## Escopo

**Inclui (Engrena F20):**
- Linha **Memória** na seção "Repo Harness" da sidebar direita, com meta de estado (mesmo padrão de Rules/Skills/SubAgents/MCPs)
- Modal **Memória do projeto**: toggle liga/desliga + journal somente leitura + aviso de journal corrompido
- Atualização do meta sem reload quando o turno grava uma entrada (evento `memory.entry` já wired em `usePrincipalWorkspace`)

**Exclui (visível na fonte, fora do contrato F20):**
- Edição do `memory.md` (textarea + save com CAS `baseHash`, 409 de conflito) — F20 não tem endpoint de escrita manual
- `Limpar journal` / `Resetar journal…` com confirmação destrutiva — sem endpoints
- Toggles tri-state (`ligada`/`desligada`/`herdar global`) — F20 é booleano por projeto, sem herança global
- `Dreaming` e provider de consolidação — não existem no PRD Engrena
- Budget em KiB com `anomaly`/`ratio ≥ 0.8` amber / `≥ 1` vermelho — o contrato expõe `sizeBytes` mas não teto nem razão; o cap FIFO de 256 KiB é interno ao serviço, não é decisão do usuário

## Anatomia (topo → base)

### A) Linha `Memória` (WorkspaceSidebar → seção "Repo Harness")

Quinta linha do bloco, **abaixo de MCPs**, usando o `HarnessRow` já existente (label à esquerda, meta muted à direita):

| Condição | Meta exibido |
|----------|--------------|
| `memoryStatus === null` (ainda carregando) | `''` (vazio, igual às demais linhas) |
| `corrupted === true` | `journal ilegível` |
| `enabled === false` | `desligada` |
| `enabled === true` | `{n} entrada` / `{n} entradas` |

Divergência deliberada da fonte: a fonte mostra budget (`3,2 / 8 KiB`) porque lá existe teto editável pelo usuário. Aqui o número que importa é quantas entradas o journal já tem — `sizeBytes` fica só no rodapé do modal.

### B) Modal `ProjectMemoryModal` (abre ao clicar na linha)

1. Header: título **Memória do projeto** + pill mono com a contagem (`{n} entradas`) · botão fechar (ícone `×`, `aria-label="Fechar"`) — mesma anatomia de `ProjectRulesModal`
2. Linha de toggle: label **Memória neste projeto** + pill `on`/`off` clicável (mesmo pill de `ProjectRulesModal`: `border-accent/50 text-accent` quando on, `border-border text-muted` quando off), com `title` explicando o efeito
3. Aviso de corrompido (só quando `corrupted`): `role="alert"` em âmbar, texto explicando que o journal foi tratado como vazio e que novas entradas voltam a ser gravadas normalmente
4. Aviso de desligado (só quando `!enabled`): texto muted esclarecendo que o journal existente **não** foi apagado
5. Corpo do journal: bloco `overflow-y-auto` `min-h-[320px]` com o conteúdo em `font-mono`, **somente leitura**
   - Vazio → `Sem entradas ainda. O agente escreve aqui ao fim de cada turno.`
   - Erro de carga → `role="alert"` vermelho
6. Rodapé (`border-t`): última entrada + tamanho do journal, em mono muted

**Alinhamento:** modal centralizado `fixed inset-0` com backdrop `bg-black/50` — idêntico a `ProjectRulesModal`.
**Largura máx.:** `max-w-[880px]`, `max-h-[86vh]` (mesmos valores de `ProjectRulesModal`; a fonte usa `max-w-3xl`/`85vh`, alinhado ao precedente local em vez da fonte).

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Linha Repo Harness | `HarnessRow` existente: `rounded-md px-xs py-[3px] text-[12px] text-fg hover:bg-surface-2` | sem classe nova |
| Meta da linha | `text-[11px] text-muted` | mesmo das outras 4 linhas |
| Backdrop | `fixed inset-0 z-50 bg-black/50 p-lg` | igual `ProjectRulesModal` |
| Card do modal | `max-h-[86vh] w-full max-w-[880px] rounded-lg border border-border bg-surface p-lg shadow-lg` | igual `ProjectRulesModal` |
| Título | `font-display text-[17px] font-semibold text-fg` | |
| Pill de contagem | `rounded-full border border-border bg-surface-2 px-sm py-[1px] font-mono text-[11px] text-muted` | |
| Pill on/off | `rounded-full border px-sm py-[1px] font-mono text-[10.5px]`; on `border-accent/50 text-accent`, off `border-border text-muted` | reusa o padrão de `ProjectRulesModal` |
| Journal | `rounded-md border border-border bg-surface-2 p-md font-mono text-[12px] leading-relaxed text-fg` + `whitespace-pre-wrap` | read-only, sem textarea |
| Aviso corrompido | `text-[12.5px] text-amber` + `role="alert"` | |
| Erro | `text-[12.5px] text-red` + `role="alert"` | |
| Rodapé | `border-t border-border pt-md font-mono text-[11.5px] text-muted` | |
| Foco | `focus-visible:ring-2 focus-visible:ring-accent` no toggle e no fechar | |

## Copy

Ver `copy.md` (fonte de verdade das strings). Nenhuma string desta tela vem literal da fonte: o vocabulário da fonte descreve capacidades que não existem aqui (edição, dreaming, anomalia, teto). Copy escrita para o contrato real do F20.

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| Linha `Memória` | button (`HarnessRow`) | sim | Abre o modal; meta reflete `memoryStatus` |
| Pill `on`/`off` | button | sim | `PATCH /memory/status`; desabilitado enquanto `busy`; erro não fecha o modal |
| Journal | bloco read-only | sim | `GET /memory/journal` no mount |
| Fechar | button | sim | `aria-label="Fechar"`; `Esc` também fecha |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `loading` | modal montado, journal em voo | Corpo com "Carregando journal…" |
| `enabled` + entradas | padrão | Pill `on`, journal renderizado, rodapé com data/tamanho |
| `enabled` + vazio | projeto novo | Pill `on`, empty state no corpo |
| `disabled` | toggle off | Pill `off` + aviso de que o journal existente foi preservado |
| `corrupted` | `corrupted: true` | Aviso âmbar `role="alert"`; corpo mostra vazio |
| `error` | falha de carga/toggle | `role="alert"` vermelho; modal permanece aberto |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| `HarnessRow` (interno de `WorkspaceSidebar`) | Linha Memória |
| Anatomia de `ProjectRulesModal` | Casca do modal (backdrop, card, header, rodapé) |
| Pill on/off de `ProjectRulesModal` | Toggle de memória |

## Aceite visual

- [ ] Linha Memória aparece como 5ª do Repo Harness, abaixo de MCPs
- [ ] Meta reflete os 4 casos (carregando / ilegível / desligada / N entradas)
- [ ] Meta atualiza sem reload após um turno gravar entrada (evento `memory.entry`)
- [ ] Modal abre/fecha por clique, `×` e `Esc`
- [ ] Toggle liga/desliga persiste e o journal continua visível quando desligado
- [ ] Journal é somente leitura (sem textarea, sem save)
- [ ] `corrupted` mostra aviso âmbar com `role="alert"`
- [ ] Tema via tokens, sem hex solto; light/dark verificados

## Divergências vs fonte (deliberadas)

| Item | Fonte | Destino Engrena | Motivo |
|------|-------|------------------|--------|
| Meta da linha | `3,2 / 8 KiB`, amber/vermelho por ratio | `{n} entradas` / `desligada` / `journal ilegível` | Contrato F20 não tem teto nem ratio |
| Journal | Aba com `Limpar` / `Resetar` | Somente leitura | Sem endpoints de mutação |
| Memória | Textarea editável + save CAS | Não existe | F20 escreve só via tool `write_memory` no turno |
| Toggle | Tri-state com herança global | Booleano por projeto | PRD Engrena não tem memória global |
| Largura do modal | `max-w-3xl` / `85vh` | `max-w-[880px]` / `86vh` | Alinhar ao precedente local (`ProjectRulesModal`) |

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F20-memoria-persistente/spec.md` | Contratos técnicos (endpoints, evento, vault) |
| `docs/F20-memoria-persistente/plan.md` | Ordem de implementação; Fase 4 registra a pendência que este doc fecha |
| `docs/F20-memoria-persistente/copy.md` | Catálogo de microcopy |
| `docs/design-system/` | Tokens e superfícies |

# Spec de UI: #consumo + banners de turno (Limites de Consumo)

**Feature:** F25-limites-de-consumo  
**Destino:** EngrenaCode  
**Fonte de referência:** LionCodeLabs `UsageLimits.tsx` (card **Limites** na sidebar — cotas de **assinatura por provider**, não USD) + `#consumo` (`ConsumoScreen.tsx`) como superfície anfitriã do PRD + barra de progresso reaproveitada visualmente  
**Componente fonte:** `packages/renderer/src/components/UsageLimits.tsx` (+ mount `WorkspaceSidebar.tsx`); baseline `#consumo`  
**Componente destino (previsto):** card **Limites de consumo** em `src/renderer/screens/ConsumoScreen.tsx`; banner de aviso/bloqueio no `#principal` / composer (F03)  
**Última atualização:** 2026-08-08

> **Gap crítico:** o card “Limites” da fonte **não** é o produto F25. Fonte = janelas de uso Claude/Codex/… (`% usado`, `renova HH:MM`). PRD Engrena F25 = limite configurável em **USD**, escopo projeto/global, modos **Avisar** / **Bloquear**, período mensal, barra do gasto em `#consumo`. Este SDD documenta (1) o que a fonte realmente mostra, (2) a anatomia destino exigida pelo PRD, sem misturar contratos.

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Card Limites fonte (sidebar, cotas) | `docs/F25-limites-de-consumo/ui/usage-limits-sidebar-referencia.png` |
| `#consumo` baseline fonte | `docs/F25-limites-de-consumo/ui/consumo-baseline-referencia.png` |
| Fixture USD (PRD) | `docs/F25-limites-de-consumo/ui/usage-limits-usd-fixture.html` |
| Fixture dark | `docs/F25-limites-de-consumo/ui/usage-limits-usd-fixture-dark.png` |
| Light (opcional) | TODO |

> Fonte viva: Electron LionCodeLabs CDP 9222, 2026-08-08. Fixture USD: síntese PRD §6 (não é screenshot de UI existente).

## Escopo

**Inclui (Engrena F25):**
- Card “Limites de consumo” em `#consumo` (USD, escopo, modo, barra do período)
- Banner em 80% / 100% (modo Avisar); mensagem de bloqueio de novo turno (modo Bloquear) com link para ajustar
- Padrão visual de progress bar observado na fonte (`h-[4px]`, `%` mono, hot ≥90% vermelho na fonte — destino pode mapear 80% âmbár / 100% vermelho)

**Exclui / não portar como F25:**
- Card sidebar “Limites” por provider/planType/janelas 5h–semanal (`UsageLimits` fonte)
- Polling 5 min / `GET /usage-limits` de assinatura
- Cálculo paralelo de custo (PRD: mesmos `usage_events` F11)

## Anatomia (topo → base)

### A) Destino — card em `#consumo` (PRD)

Inserir na tela Consumo (após resumo ou antes de Preços — **TODO** posição exata):

1. Título **Limites de consumo**
2. Hint: período mensal / vazio = sem limite / mesma base F11
3. Campo **Escopo**: Global | Projeto (ou “Este projeto”)
4. Campo **Limite (USD)** — vazio permitido
5. Segmented **Avisar** | **Bloquear**
6. Barra **Gasto do período** (`$gasto / $limite · N%`) quando há limite
7. Banner condicional ≥80% / ≥100%

### B) Destino — banner / bloqueio no workspace

1. Modo Avisar: `role="status"` âmbar, não bloqueia envio
2. Modo Bloquear no teto: composer/turno recusado com mensagem + link para `#consumo`

### C) Fonte — card `Limites` (referência visual só)

1. `<details>` fechado por padrão; summary **LIMITES** uppercase + ícone gauge
2. Ao abrir: `Consultando…` → lista `ProviderCard` (provider + planType + windows)
3. Por janela: label · `N%` + `usado` · progressbar 4px · `renova …`
4. Erro: botão **Falha ao consultar os limites — tentar de novo**

**Alinhamento destino:** coluna `#consumo` (`max-w-[1240px]` F11).  
**Largura máx. card:** full width da coluna Consumo (não sidebar).

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Card USD | `rounded-md border border-border bg-surface p-lg` | F11 MetricCard/chrome |
| Título | `text-[15px] font-semibold text-fg` | |
| Hint | `text-[12.5px] text-muted` | |
| Input/select | `border-border bg-surface-2` mono no USD | |
| Segmented | padrão F02 `SegmentedControl` | Avisar/Bloquear |
| Progress track | `h-[4px] rounded-full bg-surface-2` | fonte |
| Progress fill | `bg-accent`; ≥80% `bg-amber`; ≥100% `bg-red` | destino (fonte hot≥90% red) |
| Banner aviso | `border-amber/40 bg-amber/14 text-amber` | |
| Banner bloqueio | `text-red` + link `text-accent` | |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |

### Observado na fonte (UsageLimits)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Título | Limites | **Limites de consumo** (PRD) |
| Unidade | % janela assinatura | USD gasto / limite |
| Refresh | 300s aberto | sob demanda / pós-turno F11 |
| Local | sidebar Workspace | `#consumo` |

## Copy (literal)

Mapa: `LionCode → EngrenaCode`. Strings **fonte** vs **PRD** marcadas. Ver `copy.md`.

| Slot | Texto | Origem |
|------|-------|--------|
| `limits.fonte.summary` | Limites | fonte |
| `limits.fonte.loading` | Consultando… | fonte |
| `limits.fonte.errorRetry` | Falha ao consultar os limites — tentar de novo | fonte |
| `limits.fonte.unavailable` | Limites indisponíveis. | fonte |
| `limits.fonte.pctSuffix` | usado | fonte |
| `limits.fonte.renewSameDay` | renova {HH:mm} | fonte |
| `limits.dest.title` | Limites de consumo | PRD |
| `limits.dest.mode.warn` | Avisar | PRD |
| `limits.dest.mode.block` | Bloquear | PRD |
| `limits.dest.banner80` | TODO — aviso 80% (PRD Experiência) | TODO |
| `limits.dest.banner100` | TODO — aviso/bloqueio 100% + link ajustar | TODO |
| `limits.dest.blockedTurn` | TODO — recusa de novo turno | TODO |

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| Escopo | select | sim | global \| project |
| Limite USD | number/text | não | vazio = sem limite |
| Modo | segmented | sim | Avisar \| Bloquear |
| Barra | progressbar | condicional | só com limite > 0 |
| Link ajustar | anchor | em banners | `#consumo` card |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` / sem limite | campo vazio | sem barra; comportamento F11 atual |
| `filling` | edição USD/modo | CTA salvar se houver (TODO persistência) |
| `under` | gasto &lt; 80% | barra accent |
| `warn80` | ≥80% &lt; 100%, Avisar | banner âmbar; turno ok |
| `at100-warn` | ≥100%, Avisar | banner; turno ok |
| `at100-block` | ≥100%, Bloquear | recusa turno + mensagem |
| `loading` | agregação período | não bloquear (fail-open PRD) |
| `error-agg` | falha agregado | fail-open; sem bloqueio |

## Componentes sugeridos

| Primitive | Uso |
|-----------|-----|
| `Card` / superfície Consumo | card Limites de consumo |
| `Field` | escopo + USD |
| `SegmentedControl` | Avisar / Bloquear |
| `InlineFeedback` / banner | 80%/100%/bloqueio |
| Progress bar | reusar padrão visual fonte |

## Aceite visual

- [ ] Card USD em `#consumo`, não confundir com sidebar Limites da fonte
- [ ] Barra + modos Avisar/Bloquear verificáveis
- [ ] Banners 80%/100% e bloqueio com link
- [ ] Tokens tema; sem Lion*
- [ ] `cost_source=null` não move a barra (regra produto; evidência em teste)

## Perguntas em aberto

- Posição exata do card na anatomia F11 (após métricas? antes de Preços?)
- Escopo “projeto” na tela global: seletor de projeto ou só quando drill-down ativo?
- Portar o card sidebar de cotas de assinatura como feature separada, ou descartar no Engrena?

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/PRD.md` §6/§9 F25 | Contrato produto |
| `docs/F11-consumo/ui.md` | Superfície anfitriã |
| `docs/F25-limites-de-consumo/copy.md` | Strings |

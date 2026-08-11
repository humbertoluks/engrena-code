# Layout responsivo do Workspace

**Feature:** F03-workspace
**Última atualização:** 2026-08-11
**Código:** `renderer/hooks/responsiveLayout.logic.ts` (puro), `renderer/hooks/useResponsiveLayout.ts`, `renderer/screens/PrincipalScreen.tsx`, `renderer/components/workspace/ChatContextBar.tsx`

---

## Problema

A janela é `minWidth: 960`, `minHeight: 600`, inicial `1280×800` (`src/main/index.ts`). O grid tem três colunas fixas: Projetos 280, conversa `1fr`, sidebar direita 280. Em 1280 a conversa fica com 688px; em 960, com **360px** — largura em que a bolha do agente quebra a cada quatro palavras e os controles do composer empilham em três fileiras.

Recolher os painéis já existia, mas só à mão. Quem estreitava a janela ficava com a conversa espremida até perceber que precisava clicar em dois botões.

---

## Abordagem

### 1. Os breakpoints são derivados, não escolhidos

Nenhum número foi decidido "a olho". Fixamos o piso da conversa e derivamos o resto:

```
CHAT_MIN_WIDTH = 640     ~70 caracteres por linha a 13px; também onde o composer
                         cabe com os controles de modelo/acesso em uma fileira
PANEL_WIDTH    = 280     painel aberto
RAIL_WIDTH     =  40     painel recolhido (só o botão de expandir)
LAYOUT_GUTTER  =  32     p-sm nas duas bordas + os dois gap-sm entre colunas
```

```
RIGHT_RAIL_BREAKPOINT = 640 + 280 + 280 + 32 = 1232
LEFT_RAIL_BREAKPOINT  = 640 + 280 +  40 + 32 =  992
```

A ordem sai da natureza de cada painel: a sidebar direita é **referência** (branch, vínculos, limites, explorer), a de Projetos é **navegação**. Referência cede antes de navegação. É a mesma ordem do Linear (painel de detalhe some antes da nav), do Slack (painel de thread antes do canal) e do Cursor (painel de IA antes do file tree).

`LEFT_RAIL_BREAKPOINT` (992) fica **acima** do `minWidth` da janela (960) de propósito: no menor tamanho possível o app já nasce com as duas laterais em trilho e a conversa com 848px.

### 2. Preferência e imposição são coisas diferentes

O bug clássico desse tipo de layout é a janela estreita apagar a escolha do usuário. Aqui os dois estados convivem:

| Estado | Origem | Persiste? |
|---|---|---|
| `prefs.leftCollapsed` / `rightCollapsed` | usuário clicou em recolher | sim, `localStorage` |
| trilho imposto | largura abaixo do breakpoint | não |

O painel vira trilho se **qualquer um dos dois** valer. Ao alargar a janela, o painel volta exatamente ao que o usuário tinha escolhido — a imposição some, a preferência fica.

### 3. Sob trilho imposto, expandir abre sobreposto

Se não cabe como coluna, "expandir" não pode espremer a conversa abaixo do piso. Então abre como **drawer** sobre o chat, com scrim, sombra e `Escape` para fechar (Linear, Slack e ChatGPT fazem assim abaixo dos respectivos breakpoints).

O trilho continua no lugar por baixo. Consequências:

- Fechar o drawer **não** grava preferência — ali o trilho não foi escolha.
- Alargar a janela dissolve o drawer e devolve a coluna, sem estado órfão.
- No drawer de Projetos, escolher a thread fecha sozinho: o painel cobre a conversa, então a escolha é o fim da tarefa ali.

### 4. Recolher não pode apagar informação

Recolher só é aceitável se nada essencial sumir junto. Com Projetos em trilho o usuário perdia a **única** indicação de onde estava; com a sidebar direita em trilho perdia a **branch** — que decide onde o commit do agente cai.

Esses dois sinais migram para a barra de abas da conversa, o único lugar sempre visível (`ChatContextBar`). Cada grupo aparece exatamente quando o painel dele não está:

```
┌────────────────────────────────────────────────────────────────┐
│ [Histórico] [Diff 2] │ engrena-code / Ajustar layout   main ● ↑9│
└────────────────────────────────────────────────────────────────┘
   controles           │ ← identidade            estado do repo → │
                       └ régua: separa o que se clica do que se lê
```

Deliberadamente **fora** da barra: pipeline rodando e atividade de subagents. Os dois já aparecem no work log da própria conversa; repetir aqui seria decoração.

---

## Comportamento por largura

| Largura | Projetos | Direita | Conversa |
|---|---|---|---|
| ≥ 1232 | coluna 280 | coluna 280 | ≥ 640 |
| 992–1231 | coluna 280 | **trilho 40** | 640–879 |
| 960–991 | **trilho 40** | trilho 40 | 848–879 |

Invariante coberto por teste: para **toda** largura de 960 a 2560, a conversa fica ≥ 640px.

---

## Verificação

**Unit** — `renderer/hooks/responsiveLayout.logic.test.ts`, 21 casos: sequência de recolhimento nos limites exatos, o invariante do piso varrendo 960→2560, preferência x imposição, ciclo do drawer, `expandPanel`/`collapsePanel`.

**Ao vivo** — app real, cofre de fixture isolado (`ENGRENACODE_USER_DATA`), medindo `gridTemplateColumns` computado:

| Largura | Colunas medidas | Esperado |
|---|---|---|
| 1400 | `280px 808px 280px` | ✅ |
| 1280 | `280px 688px 280px` | ✅ inicial da janela |
| 1232 | `280px 640px 280px` | ✅ piso exato |
| 1231 | `280px 879px 40px` | ✅ direita cede |
| 1100 | `280px 748px 40px` | ✅ |
| 992 | `280px 640px 40px` | ✅ piso exato |
| 991 | `40px 879px 40px` | ✅ Projetos cede |
| 960 | `40px 848px 40px` | ✅ janela mínima |

Também verificado ao vivo:

- Drawer em 960: grid intacto (`40px 848px 40px`), scrim presente, painel 280px a 8px da borda — a conversa **não** encolhe.
- `Escape` fecha; reabrir funciona.
- Alargar para 1400 com drawer aberto: drawer some, coluna volta.
- Recolher a direita à mão em 1400 → `280px 1048px 40px`, `localStorage` grava `'1'`; estreitar até 960 e voltar a 1400 **mantém** a preferência.
- Barra de contexto com projeto real: em 1100 mostra `main ● ↑9`; em 960 mostra `engrena-code / Nenhuma conversa aberta ... main ● ↑9`.

| Evidência | Arquivo |
|---|---|
| 1100 — direita em trilho | `ui/responsive-1100-direita-trilho.png` |
| 960 — dois trilhos + barra de contexto | `ui/responsive-960-dois-trilhos.png` |
| 960 — drawer de Projetos sobre a conversa | `ui/responsive-960-drawer.png` |

---

## Achado fora de escopo (não corrigido)

`TaskComposer.tsx:94` lê `composerCatalog.providers.openai` sem guarda. Quando o cofre trava com o workspace aberto (`GET /api/composer/catalog` → 423), o componente lança `TypeError: Cannot read properties of undefined` e derruba a janela do Electron. Reproduzido duas vezes durante este smoke. Pré-existente ao layout responsivo.

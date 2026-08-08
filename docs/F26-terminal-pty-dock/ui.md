# Spec de UI: #principal (Terminal PTY — dock inferior)

**Feature:** F26-terminal-pty-dock
**Destino:** EngrenaCode
**Fonte:** nenhuma — feature nativa EngrenaCode, sem app de referência (LionCodeLabs não tem terminal PTY); anatomia documentada a partir da implementação já feita (`spec.md`/`plan.md` Fase 3), fechando a pendência registrada em `plan.md` Fase 4 item (b)
**Componentes implementados:** `src/renderer/components/workspace/TerminalDock.tsx`, `src/renderer/components/workspace/TerminalPane.tsx`, `src/renderer/hooks/useTerminalDock.ts`, montados em `src/renderer/screens/PrincipalScreen.tsx`
**Última atualização:** 2026-08-07

> Este documento é fechamento pós-implementação, não spec prévia à codificação: Fase 3 do `plan.md` já entregou os componentes funcionais com copy inline. Aqui a anatomia e o copy existentes são catalogados como fonte de verdade (`copy.md`), e gaps contra o PRD (Seção 6, F26) ficam marcados em Perguntas em aberto.

## Escopo

**Cobre:**
- Dock inferior expansível (`TerminalDock`) — toggle, barra de abas, nova aba
- Pane de sessão (`TerminalPane`) — 4 estados: `connecting`, `running`, `error`, `exited`
- Atalho de teclado `Ctrl+\`` (implementado em `useTerminalDock.ts`, sem indicação visual na UI)

**Fora deste documento:**
- Contrato IPC/estado (`sessionId`, `data`/`exit`) — ver `spec.md` Seção 5–6
- Comportamento de resolução de shell/cwd — ver `spec.md` Seção 3.2

## Anatomia (topo → base)

### A) `TerminalDock` — barra do dock (sempre visível, linha `auto` abaixo do grid 3 colunas do Workspace, largura total)

1. Header: botão de toggle **Terminal** (`aria-expanded`, `aria-label="Alternar terminal"`) — clique expande/colapsa o corpo
2. Quando aberto (`dock.open`), à direita do header: barra de abas horizontal com scroll (`overflow-x-auto`)
   1. Uma pill por aba: label `Terminal {n}` (1-indexado por posição, não por `tabId`) + botão `×` (`aria-label="Fechar aba"`)
   2. Aba ativa: `bg-surface-2 text-fg`; inativas: `text-muted`
   3. Ao final da barra: botão **+ Nova aba** (`text-accent`, `disabled` sem projeto selecionado)
3. Corpo (quando aberto): altura fixa `240px`
   1. Sem projeto selecionado → mensagem centralizada "Selecione um projeto para abrir um terminal."
   2. Projeto selecionado + nenhuma aba → mensagem centralizada "Nenhuma aba aberta." (estado transitório — abrir o dock com 0 abas dispara `openNewTab()` automaticamente, ver `useTerminalDock.ts:134-141`)
   3. Aba ativa presente → `TerminalPane`

### B) `TerminalPane` — corpo da aba ativa

Por `tab.status`:

1. `connecting`: texto centralizado "Abrindo sessão..."
2. `error`: título "Não foi possível abrir o terminal" + `tab.errorMessage` em vermelho (`text-red`) — sem CTA (falha veio da resposta de `terminal:create`, ex. `shell_not_found`)
3. `exited`: título "Sessão encerrada" + `Processo encerrado (código {exitCode}).` + `ButtonSecondary` **Reabrir**
4. `running`: `<div>` full-size montando `@xterm/xterm` + `FitAddon`, tema via `xtermThemeFromCssVars()`, fonte igual ao tema (JetBrains Mono, F01.1)

Não há distinção visual entre exit esperado (`expected: true`, fechar aba) e inesperado (`expected: false`, crash) no `exited` — a aba já é removida da lista ao fechar (`closeTab`), então o estado `exited` visível na UI só ocorre no caso `expected: false` do PRD ("processo morre inesperadamente"). Comportamento correto; não é um gap.

**Alinhamento:** dock full-width, abaixo do grid `[280px_1fr_280px]` do Workspace — "ao lado, não substituindo" o painel principal (PRD) é satisfeito horizontalmente por estar numa linha própria do grid `grid-rows-[1fr_auto]`, não sobrepondo nem recolhendo a área de chat/diff.
**Altura:** header ~auto (`py-xs`); corpo `h-[240px]` fixo — sem resize manual do dock nesta versão (fora de escopo não declarado no PRD; ver Perguntas).

## Layout / tokens

| Região | Tokens/classes | Notas |
|--------|-----------------|-------|
| Dock container | `rounded-xl border border-border bg-surface`, `flex flex-col overflow-hidden` | mesmo padrão de card usado no painel central e na sidebar |
| Header | `border-b border-border px-md py-xs`, `flex items-center justify-between` | |
| Toggle | `text-[12px] font-medium text-fg` | sem ícone de chevron — só o texto "Terminal" |
| Aba pill | `rounded-md px-sm py-[3px] text-[12px]`; ativa `bg-surface-2 text-fg`; inativa `text-muted` | |
| Botão fechar aba (`×`) | `text-muted hover:text-fg` | |
| Nova aba | `text-accent`, `disabled:opacity-50` | |
| Corpo pane | `h-[240px]` | fixo, sem token de spacing dedicado |
| Estado erro | `text-red` no detalhe; título `text-fg` | |
| Estado exited | título `text-fg`, detalhe `text-muted`, CTA `ButtonSecondary` | |
| xterm | `xtermThemeFromCssVars()` (F01.1), `fontSize: 13` hardcoded (sem token de tamanho — ver Perguntas) | |
| Foco | Não auditado nesta rodada — botões usam `type="button"` mas nenhum tem `focus-visible:ring-*` explícito (ao contrário do padrão `ROW_BTN` de F19/sidebar) | ver Perguntas |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| Dock fechado | padrão ao montar `PrincipalScreen` | só header visível, corpo colapsado |
| Dock aberto, sem projeto | `open=true`, `projectId=null` | corpo mostra "Selecione um projeto..." |
| Dock aberto, sem abas | `open=true`, `tabs=[]` | transitório — `openNewTab()` dispara automaticamente ao abrir |
| Aba `connecting` | `terminal:create` em voo | "Abrindo sessão..." |
| Aba `running` | resposta `create` OK | xterm montado, recebe `data`, encaminha teclas |
| Aba `error` | resposta `create` com `error` (ex. `shell_not_found`, `project_not_found`) | título + `errorMessage` em vermelho, sem retry inline |
| Aba `exited` | evento `terminal:exit` para o `sessionId` da aba | título "Sessão encerrada" + detalhe + Reabrir |

## Componentes usados

| Primitive | Uso |
|-----------|-----|
| `ButtonSecondary` | CTA "Reabrir" no estado `exited` |
| `@xterm/xterm` + `@xterm/addon-fit` | Renderização do terminal real, montado só em `status === 'running'` |
| Botões nativos (`<button type="button">`) | Toggle, tabs, fechar aba, nova aba — sem primitive de botão dedicado para essas ações (diferente de `ButtonSecondary` usado só no CTA de erro) |

## Aceite visual

- [x] Anatomia: header (toggle + abas + nova aba) → corpo (estado por aba) — implementado conforme acima
- [x] 4 estados de `TerminalPane` (`connecting`/`running`/`error`/`exited`) renderizam distintamente
- [x] Tema via tokens (`border-border`, `bg-surface`, `text-fg`/`text-muted`/`text-accent`/`text-red`) — sem hex solto
- [x] xterm usa `xtermThemeFromCssVars()` (fonte JetBrains Mono do Design Lock F01.1)
- [x] Aviso de privilégio (PRD Seção 6: "documentado como tal na UI") — `title` do toggle (`terminal.dock.toggleTitle`), decisão própria (sem precedente na fonte)
- [x] `focus-visible:ring-*` nos botões do dock (toggle/abas/fechar/nova aba) — aplicado, replicando o padrão de `LionCodeLabs/packages/renderer/src/components/TerminalDock.tsx` (`ring-2` toggle/nova aba, `ring-1` aba/fechar)
- [x] Indicação visual do atalho `Ctrl+\`` — embutida no mesmo `title` do toggle

## Consulta à fonte (LionCodeLabs)

`c:\Users\Me\Code\repos\github\lionlabs\LionCodeLabs\packages\renderer\src\components\TerminalDock.tsx` + `XtermView.tsx` têm um dock de terminal equivalente (mesma ideia, PTY real + xterm.js). Comparado:

- **Focus rings**: fonte usa `focus-visible:ring-2` no toggle/nova aba e `focus-visible:ring-1` na aba/fechar — replicado aqui.
- **Aviso de privilégio**: a fonte **não tem** — LionCodeLabs nunca documentou essa mensagem (não é requisito do produto deles). Copy final foi decisão própria EngrenaCode, adaptando o texto literal do PRD §6.
- **Diferenças de anatomia não portadas** (fora do escopo desta rodada, PRD não pede): alça de resize por drag (`MIN_HEIGHT`/`MAX_HEIGHT`/`DEFAULT_HEIGHT`, dock aqui é `h-[240px]` fixo); ícones (chevron, glifo de terminal, `+`/`×` em SVG — dock aqui é só texto/`×` ASCII); todas as abas montadas simultaneamente e só a ativa visível (preserva scrollback ao trocar de aba — dock aqui desmonta o `TerminalPane` inativo, perdendo o buffer do xterm ao voltar pra uma aba já vista, já que a sessão PTY em si sobrevive no main process mas o xterm client-side é recriado do zero).
- **Ctrl+C com seleção = copiar** (`XtermView.tsx:66-84`) — **não portado como está**: decisão do produto (Luks) foi `Ctrl+C` sempre SIGINT, `Ctrl+Shift+C` copia seleção, para não disputar a tecla que mata o processo. Implementado em `TerminalPane.tsx` via `attachCustomKeyEventHandler`.

## Perguntas em aberto

- `fontSize: 13` hardcoded em `TerminalPane.tsx:37` (fonte usa `12.5` + `lineHeight: 1.2`) — alinhar aos valores da fonte ou manter?
- Perda de scrollback ao trocar de aba (ver Consulta à fonte acima) — vale portar o padrão "todas montadas, só a ativa visível" da fonte? É mudança de comportamento, não só visual — registrar como item de spec técnico se decidido.
- Altura do dock fixa em `240px`, sem resize manual (a fonte tem alça de drag, `72–680px`) — portar o resize ou manter fixo nesta versão?

Resolvida nesta rodada: atalho de copiar definido como `Ctrl+Shift+C` (decisão do produto — `Ctrl+C` sempre SIGINT, nunca disputa com copiar), diferente do `Ctrl+C`-com-seleção da fonte.

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F26-terminal-pty-dock/spec.md` | Contrato técnico (IPC, ciclo de vida de sessão) |
| `docs/F26-terminal-pty-dock/plan.md` | Ordem de implementação; Fase 4 registra a pendência que este doc fecha |
| `docs/F26-terminal-pty-dock/copy.md` | Catálogo de microcopy |
| `docs/design-system/` | Tokens e superfícies |
| `docs/F01.1-design-system/spec.md` | `xtermThemeFromCssVars()`, fonte mono |

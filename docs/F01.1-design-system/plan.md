# Plano de Implementação: Design System

**Pré-requisitos:**
- PRD `docs/PRD.md` (F01.1) e `docs/F01.1-design-system/spec.md`
- `docs/design-system/` como referência visual (hexes, escalas, tipografia)
- App Electron instalável (`pnpm install`); Node ≥ 20; stack atual Tailwind 4 em `src/renderer/`
- F01 gate (`#login` / vault) utilizável para provar seletor de tema e migração mínima

**Nota:** F01.1 é Feature de Fundação greenfield de estilo. Escopo = Central only. Não criar telas de produto novas; polish de tokens (type scale, shadows, z-index, motion, breakpoints) e `.chat-markdown` ficam para depois.

### Fase 1: Tokens e tipografia

**1. CSS canônico light/dark** - Definir em `src/renderer/index.css` as variáveis `:root` / `.dark` com os hexes do Design Lock, scrollbar e classe `.no-transitions`. Detalhes na spec seções 5–6.

**2. Ponte Tailwind 4** - Mapear cores, spacing, radii e font families aos utilitários via `@theme` (ou equivalente v4), de modo que `bg-bg`, `p-md`, `rounded-md`, `font-mono` etc. resolvam as mesmas vars. Sem `tailwind.config.ts` clássico.

**3. Fontes do contrato** - Adicionar e importar DM Sans Variable, Figtree Variable e JetBrains Mono Variable no boot do renderer. Não incluir LionLabs Grotesk.

### Fase 2: Runtime de tema e shell

**4. Hook useTheme** - Implementar leitura/gravação de `engrenacode:theme`, resolução `system`, aplicação de `.dark`, fail-soft e anti-flash na troca. Expor `setTheme` e `resolvedTheme` conforme a spec.

**5. Boot anti-flash e splash** - Aplicar tema antes do paint no entry do renderer e configurar `backgroundColor` do `BrowserWindow` para `#0a0a0b` no main process.

**6. ThemeControl mínimo** - Criar controle compartilhado (select ou ciclo) que apenas chama `setTheme`; montar em `#login` e no chrome pós-unlock existente.

### Fase 3: Contratos Shiki/xterm e migração visual

**7. Helpers Shiki e xterm** - Entregar deps e módulos de contrato (`github-light`/`github-dark` e mapa a partir das CSS vars + mono). Não montar chat, markdown de mensagem, terminal nem PTY.

**8. Migrar superfícies existentes** - Substituir slate/blue ad-hoc em `LoginScreen` e chrome pós-unlock pelos tokens e padrões de superfície da spec (card/input/focus/página). Sem telas novas.

### Fase 4: Aceitação e handoff

**9. Bateria de aceitação F01.1** - Executar os cenários da estratégia de testes da spec (tokens, tema, storage, splash, helpers, UI migrada). Registrar gaps explícitos.

**10. Handoff para F02+** - Declarar contrato estável: utilitários semânticos, tema tri-modo e helpers Shiki/xterm prontos para consumo; `.chat-markdown` e polish de tokens adiados; F02 reutiliza `useTheme` sem duplicar store.

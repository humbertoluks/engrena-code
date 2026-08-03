# Design System — sistema legado (Design Lock LionClaw)

Documento consolidado do sistema visual do renderer. Artefatos detalhados:

| Arquivo | Conteúdo |
| ------- | -------- |
| [color-palette.md](./color-palette.md) | Paleta light/dark, status, satélites |
| [typography.md](./typography.md) | Fontes, escala observada, Grotesk |
| [spacing.md](./spacing.md) | Espaçamento, radius, layout, z/shadow |
| [tokens.md](./tokens.md) | Tabela mestra CSS ↔ Tailwind |

## Resumo executivo

A UI do sistema legado vive em **`packages/renderer`**: Tailwind 3 + CSS variables + React.  
Não há MUI/Chakra/Emotion/CSS Modules. O **Design Lock LionClaw (SPEC 4.4)** trava hexes do tema escuro e a ponte de tokens.

### Arquitetura de tokens

```mermaid
flowchart LR
  A["index.css\n:root / .dark hexes"] --> B["design-tokens.ts\nvar + spacing/radii/fonts"]
  B --> C["tailwind.config.ts\ndarkMode: class"]
  D["useTheme.ts\nlight|dark|system"] --> E["html.dark"]
  E --> A
  C --> F["Utilitários UI\nbg-bg text-fg p-md"]
```

### Princípios extraídos 🟢

1. **Cores semânticas flat** (bg / surface / fg / accent / status), não escala 50–900.
2. **Accent laranja** `#ff6b00` / `#ff8c2e` idêntico em light e dark.
3. **Dark hexes travados** (comentário "NAO alterar" no CSS).
4. **Spacing 4–8–16–24–40** e **radius 5–8–12** literais no TS.
5. **Tema tri-modo** com persistência `lioncode:theme` e anti-flash (módulo + `.no-transitions` + splash Electron).

### Componentes / superfícies tipadas pelo sistema

Não há design-system package separado (Storybook ausente). Componentes consomem utilitários diretamente.

Padrões recorrentes 🟡:

| Padrão | Classes / tokens |
| ------ | ---------------- |
| Card / panel | `rounded-lg border border-border bg-surface p-lg` |
| Input | `rounded-sm|md border border-border bg-surface-2 text-fg focus:border-accent ring-accent` |
| Badge accent | `rounded-full bg-accent/20 font-mono text-accent` |
| Badge status | `bg-amber/[0.14] text-amber` / `bg-red/[0.13] text-red` |
| Modal | `fixed inset-0 z-50 bg-black/50` + `rounded-lg border bg-surface shadow-lg` |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` |
| Markdown chat | `.chat-markdown` em `index.css` (headings, code chip accent, codeblock surface-2) |

### Syntax highlight / terminal

| Superfície | Tema | Confiança |
| ---------- | ---- | --------- |
| Shiki (chat code) | `github-light` / `github-dark` via `resolvedTheme` | 🟢 |
| xterm | lê `--bg`, `--fg`, `--accent`, `--border` + JetBrains Mono | 🟢 |

### Shell (fora do token module)

`packages/shell/src/window.ts` → `backgroundColor: '#0a0a0b'` (dark `--bg`).

### Inventário de confiança

| Categoria | Tokens | Confiança |
| --------- | ------ | --------- |
| Cores UI (11 + scrollbar) | documentados | 🟢 |
| Spacing (5) | documentados | 🟢 |
| Radii (3) | documentados | 🟢 |
| Font families (3) | documentados | 🟢 |
| Theme runtime | documentado | 🟢 |
| Type scale / shadows / z-index | ausentes como tokens | 🔴 |
| LionLabs Grotesk override | ativo no boot | 🟢 arquivo / 🟡 intenção permanente |
| Brand lion sprite | palette própria | 🟢 |

## Como regenerar / validar

1. Abrir `packages/renderer/src/index.css` e conferir `:root` / `.dark`.
2. Abrir `packages/renderer/src/tokens/design-tokens.ts`.
3. Conferir `tailwind.config.ts` `theme.extend`.
4. Rodar a app e alternar tema (light/dark/system).

## Relação com `_reversa_docs`

O mini-site em `_reversa_docs/` tem CSS próprio (`assets/css/style.css`) e **não** é o design system do produto do sistema legado. Este pacote documenta só a UI do renderer.

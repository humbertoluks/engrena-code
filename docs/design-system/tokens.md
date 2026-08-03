# Design Tokens — EngrenaCode (tabela mestra)

> Fonte canônica: CSS vars em `index.css` + módulo `design-tokens.ts` + wiring Tailwind. Confiança: 🟢 salvo onde marcado.

## Mapa de autoridade

```
src/renderer/index.css (:root / .dark)  ← hexes de cor (fonte de verdade)
        ↓ var(--*)
design-tokens.ts                        ← spacing/radii/font literais + nomes de cor
        ↓
@theme (Tailwind 4 em index.css)        ← utilitários (bg-bg, p-md, rounded-md, font-mono)
        ↓
useTheme.ts                             ← toggles .dark / light / system
```

## Cores (CSS ↔ Tailwind)

| CSS var | Token TS key | Utilitário Tailwind | Light | Dark |
| ------- | ------------ | ------------------- | ----- | ---- |
| `--bg` | `bg` | `bg-bg`, `text-bg`, … | `#f7f7f8` | `#0a0a0b` |
| `--surface` | `surface` | `bg-surface` | `#ffffff` | `#121214` |
| `--surface-2` | `surface-2` | `bg-surface-2` | `#f1f1f3` | `#17171a` |
| `--border` | `border` | `border-border` | `#e2e2e6` | `#232327` |
| `--fg` | `fg` | `text-fg` | `#1a1a1d` | `#ededee` |
| `--muted` | `muted` | `text-muted` | `#6b6b73` | `#a1a1aa` |
| `--accent` | `accent` | `bg-accent`, `text-accent`, `ring-accent` | `#ff6b00` | `#ff6b00` |
| `--accent-2` | `accent-2` | `text-accent-2` | `#ff8c2e` | `#ff8c2e` |
| `--green` | `green` | `text-green`, `bg-green` | `#2e9e43` | `#3fb950` |
| `--amber` | `amber` | `text-amber`, `bg-amber` | `#b07d1f` | `#d2a23a` |
| `--red` | `red` | `text-red`, `bg-red` | `#cf3b3b` | `#e05555` |
| `--scrollbar-thumb` | — | (CSS only) | `#c8c8d0` | `#3a3a42` |
| `--scrollbar-thumb-hover` | — | (CSS only) | `#a8a8b2` | `#52525b` |

## Spacing

| Key | Valor |
| --- | ----- |
| `xs` | `4px` |
| `sm` | `8px` |
| `md` | `16px` |
| `lg` | `24px` |
| `xl` | `40px` |

## Radii

| Key | Valor |
| --- | ----- |
| `sm` | `5px` |
| `md` | `8px` |
| `lg` | `12px` |

## Font family

| Key | Stack |
| --- | ----- |
| `display` | DM Sans Variable → Figtree Variable → system-ui → sans-serif |
| `body` | idem |
| `mono` | JetBrains Mono Variable → JetBrains Mono → IBM Plex Mono → monospace |

## Runtime / config

| Token / chave | Valor | Arquivo |
| ------------- | ----- | ------- |
| `STORAGE_KEY` | `engrenacode:theme` | `src/renderer/hooks/useTheme.ts` |
| Theme values | `light` \| `dark` \| `system` | `useTheme.ts` |
| `darkMode` | classe `.dark` em `<html>` | `@custom-variant` + `@theme` em `index.css` |
| Shell splash | `#0a0a0b` | `src/main/index.ts` (`BrowserWindow`) |

## Export TS

```ts
export const designTokens = { colors, spacing, radii, fontFamily } as const;
```

## Não tokenizado (inventar = 🔴)

- Shadows / elevações
- Z-index scale
- Type scale (font-size tokens)
- Opacidade semântica (usa `/20`, `/50` Tailwind ad-hoc)
- Motion tokens (duração/easing além do markdown 0.12s)
- Breakpoints custom

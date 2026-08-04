# Color Palette — sistema legado (Design Lock)

> Fonte: `packages/renderer/src/index.css` (hexes) + `packages/renderer/src/tokens/design-tokens.ts` (ponte Tailwind). Confiança: 🟢  
> Ownership: `packages/renderer`. Shell só usa splash `#0a0a0b`.

## Modelo de tema

| Modo | Mecanismo | Persistência |
| ---- | --------- | ------------ |
| `light` | `:root` | `localStorage` chave `sistema-legado:theme` |
| `dark` | classe `.dark` em `<html>` | idem |
| `system` | segue `prefers-color-scheme` | idem |

Runtime: `packages/renderer/src/hooks/useTheme.ts` (`darkMode: 'class'` no Tailwind).  
Troca suprime transições via `.no-transitions` para evitar flash.

## Superfícies e texto

| Token CSS | Tailwind | Light 🟢 | Dark 🟢 (SPEC 4.4 travado) | Uso |
| --------- | -------- | -------- | -------------------------- | --- |
| `--bg` | `bg-bg` / `text-bg` | `#f7f7f8` | `#0a0a0b` | Fundo da app / canvas |
| `--surface` | `bg-surface` | `#ffffff` | `#121214` | Cards, painéis, inputs elevados |
| `--surface-2` | `bg-surface-2` | `#f1f1f3` | `#17171a` | Camada secundária, codeblock |
| `--border` | `border-border` | `#e2e2e6` | `#232327` | Bordas, divisores |
| `--fg` | `text-fg` | `#1a1a1d` | `#ededee` | Texto principal |
| `--muted` | `text-muted` | `#6b6b73` | `#a1a1aa` | Texto secundário / labels |

## Marca / acento (igual nos dois temas)

| Token CSS | Tailwind | Hex 🟢 | Uso |
| --------- | -------- | ------ | --- |
| `--accent` | `bg-accent` / `text-accent` | `#ff6b00` | CTA, focus ring, badges, inline code bg |
| `--accent-2` | `text-accent-2` | `#ff8c2e` | Links markdown, hover/acento suave |

## Status / feedback

| Token CSS | Tailwind | Light 🟢 | Dark 🟢 | Uso |
| --------- | -------- | -------- | ------- | --- |
| `--green` | `text-green` / `bg-green` | `#2e9e43` | `#3fb950` | Sucesso |
| `--amber` | `text-amber` / `bg-amber` | `#b07d1f` | `#d2a23a` | Alerta / warning |
| `--red` | `text-red` / `bg-red` | `#cf3b3b` | `#e05555` | Erro / destrutivo |

## Scrollbar

| Token CSS | Light 🟢 | Dark 🟢 |
| --------- | -------- | ------- |
| `--scrollbar-thumb` | `#c8c8d0` | `#3a3a42` |
| `--scrollbar-thumb-hover` | `#a8a8b2` | `#52525b` |

Trilho transparente; polegar ~4px via border clip.

## Cores satélite (fora do Design Lock)

| Origem | Hex | Confiança | Nota |
| ------ | --- | --------- | ---- |
| Shell splash (`packages/shell/src/window.ts`) | `#0a0a0b` | 🟢 | Paridade com dark `--bg` (anti-flash Electron) |
| EngrenaSprite juba | `#ff7a00` | 🟢 | Brand mascote; **não** é `--accent` |
| EngrenaSprite face | `#1c140a` | 🟢 | |
| EngrenaSprite olhos | `#ffb347` | 🟢 | |
| EngrenaSprite nariz/boca | `#ff9d00` | 🟢 | |
| EngrenaSprite juba clara | `#ffcd80` | 🟢 | Frame opcional |
| Inline code texto | `#ffffff` | 🟢 | Hardcoded em `.chat-markdown` |
| Overlay modal | `bg-black/50` | 🟡 | Tailwind default, não tokenizado |
| Diff add/remove | hexes locais em DiffViewer | 🟡 | Fora do design-tokens |
| Provider brands | `threadVisuals.tsx` | 🟡 | Cores de terceiros |

## Lacunas

| Item | Confiança |
| ---- | --------- |
| Escala 50–900 (não existe; paleta flat semântic) | 🔴 N/A por design |
| `--font-mono` referenciado em CSS mas **não definido** em `:root` | 🔴 fallback system mono no CSS; Tailwind `font-mono` usa JetBrains via tokens TS |

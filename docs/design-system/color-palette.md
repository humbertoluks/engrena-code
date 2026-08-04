# Color Palette — EngrenaCode (Design Lock)

> Fonte: `src/renderer/index.css` (hexes) + `src/renderer/tokens/design-tokens.ts` (literais). Confiança: 🟢  
> Ownership: `src/renderer`. Shell splash `#0a0a0b` em `src/main/index.ts`.

## Modelo de tema

| Modo | Mecanismo | Persistência |
| ---- | --------- | ------------ |
| `light` | `:root` | `localStorage` chave `engrenacode:theme` |
| `dark` | classe `.dark` em `<html>` | idem |
| `system` | segue `prefers-color-scheme` | idem |

Runtime: `src/renderer/hooks/useTheme.ts` (variante `.dark` + `@theme` Tailwind 4).  
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
| Shell splash (`src/main/index.ts`) | `#0a0a0b` | 🟢 | Paridade com dark `--bg` (anti-flash Electron) |
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
| Escala 50–900 (não existe; paleta flat semântica) | 🔴 N/A por design |
| Font stacks | 🟢 via `@theme` (`--font-display` / `--font-body` / `--font-mono`) |

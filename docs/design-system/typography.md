# Typography — EngrenaCode (Design Lock LionClaw)

> Fonte: `src/renderer/tokens/design-tokens.ts`, `src/renderer/index.css`, `src/renderer/main.tsx`. Confiança: 🟢

## Famílias

| Papel | Stack (Tailwind) | Empacotamento | Confiança |
| ----- | ---------------- | ------------- | --------- |
| `font-display` | `"DM Sans Variable", "Figtree Variable", system-ui, sans-serif` | `@fontsource-variable/dm-sans`, `@fontsource-variable/figtree` | 🟢 |
| `font-body` | idem display | idem | 🟢 |
| `font-mono` | `"JetBrains Mono Variable", "JetBrains Mono", "IBM Plex Mono", monospace` | `@fontsource-variable/jetbrains-mono` | 🟢 |

`body` em `index.css` usa a mesma stack display/body (sem classe Tailwind).

## LionLabs Grotesk

Fora do Escopo Central F01.1 (EngrenaCode). Tipografia canônica = DM Sans + Figtree + JetBrains Mono; sem alias Grotesk no boot.

## Escala de tamanho observada na UI

Não há type-scale tokenizada (sem `fontSize` no `design-tokens`). Tamanhos vêm de utilitários Tailwind arbitrários e CSS de markdown.

### App chrome (amostra 🟡 inferida de componentes)

| Contexto | Classes típicas | ~px |
| -------- | --------------- | --- |
| Título de tela | `text-[26px] font-bold tracking-tight` | 26 |
| Modal title | `font-display text-[17px] font-semibold` | 17 |
| Card title | `text-[15px] font-semibold` | 15 |
| Body / form | `text-[13px]` | 13 |
| Meta / helper | `text-[12.5px]` / `text-[11.5px]` | 12.5 / 11.5 |
| Badge / mono label | `font-mono text-[11px]` / `text-[10.5px]` | 11 / 10.5 |
| Micro badge | `text-[9.5px] font-semibold` | 9.5 |

### Markdown (`.chat-markdown`) — Adiado F03

Critério de markdown de mensagem não faz parte do Escopo Central F01.1; entra na integração do Workspace.

## Pesos usados na UI

| Weight | Onde |
| ------ | ---- |
| `font-medium` (500) | Tabs, botões secundários |
| `font-semibold` (600) | Títulos, badges, CTAs |
| `font-bold` (700) | H1 de telas |
| CSS `font-weight: 600` | Headings markdown |

## Letter-spacing

| Uso | Valor |
| ---- | ----- |
| Títulos de tela | `tracking-tight` |
| Labels de form (`uppercase`) | `tracking-[0.04em]` |

## Lacunas

| Item | Status |
| ---- | ------ |
| Escala tipográfica tokenizada (`text-xs`…`text-2xl` custom) | 🔴 adiada (Escopo Completo); Tailwind default + arbitrários |
| `--font-display` / `--font-body` / `--font-mono` | 🟢 no `@theme` de `index.css` |
| Line-height global do body | 🔴 não declarado (browser default) |

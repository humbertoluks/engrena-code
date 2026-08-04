# Typography — sistema legado (Design Lock)

> Fonte: `design-tokens.ts`, `index.css`, `main.tsx`, `experimento-grotesk.css`. Confiança: 🟢

## Famílias

| Papel | Stack (Tailwind) | Empacotamento | Confiança |
| ----- | ---------------- | ------------- | --------- |
| `font-display` | `"DM Sans Variable", "Figtree Variable", system-ui, sans-serif` | `@fontsource-variable/dm-sans`, `@fontsource-variable/figtree` | 🟢 |
| `font-body` | idem display | idem | 🟢 |
| `font-mono` | `"JetBrains Mono Variable", "JetBrains Mono", "IBM Plex Mono", monospace` | `@fontsource-variable/jetbrains-mono` | 🟢 |

`body` em `index.css` usa a mesma stack display/body (sem classe Tailwind).

## Experimento Grotesk (ativo, reversível)

Arquivo: `packages/renderer/src/assets/fonts/experimento-grotesk/experimento-grotesk.css`  
Importado em `main.tsx` com comentário de rollback.

- Alias `@font-face` redireciona `"DM Sans Variable"` e `"Figtree Variable"` → experimento Grotesk (Regular/Medium/Bold).
- **Não** altera monospace.
- Derivada de Hanken Grotesk (OFL 1.1).
- Confiança: 🟢 presença no boot; 🟡 se é permanente vs teste (comentário diz "teste reversível").

### Pesos Grotesk mapeados

| Faixa weight | Arquivo |
| ------------ | ------- |
| 1–449 | Regular |
| 450–574 | Medium |
| 575–1000 | Bold |

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

### Markdown (`.chat-markdown`) 🟢

| Elemento | Size | Weight | Line-height | Color |
| -------- | ---- | ------ | ----------- | ----- |
| h1 | `1.25rem` (20px) | 600 | 1.3 | `--fg` |
| h2 | `1.125rem` (18px) | 600 | 1.3 | `--fg` |
| h3 | `1rem` (16px) | 600 | 1.3 | `--fg` |
| h4–h5 | `0.875rem` (14px) | 600 | 1.3 | `--fg` |
| h6 | `0.875rem` | 600 | 1.3 | `--muted` |
| Inline code | `0.78em` | 600 | — | `#ffffff` on `--accent` |
| Code block | `0.78rem` | inherit | 1.55 | `--fg` |
| Code title | `0.6875rem` | — | — | `--muted`, mono, lowercase |
| Table | `0.8125rem` | th: 600 | — | `--fg` / border mix |

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
| Escala tipográfica tokenizada (`text-xs`…`text-2xl` custom) | 🔴 não existe; Tailwind default + arbitrários |
| `--font-mono` CSS var | 🔴 referenciada, não definida em `:root` |
| Line-height global do body | 🔴 não declarado (browser default) |

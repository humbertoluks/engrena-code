# Spacing, Grid & Breakpoints — EngrenaCode

> Fonte: `src/renderer/tokens/design-tokens.ts` + `@theme` em `src/renderer/index.css` (Tailwind 4). Confiança: 🟢 (escala) | 🟡 (breakpoints = Tailwind default)

## Escala de espaçamento (travada)

| Token | Valor | Tailwind | Uso típico |
| ----- | ----- | -------- | ---------- |
| `xs` | `4px` | `p-xs` / `gap-xs` / `m-xs` | Gaps internos, padding mínimo |
| `sm` | `8px` | `p-sm` / `gap-sm` | Padding de botões, gaps de lista |
| `md` | `16px` | `p-md` / `gap-md` | Padding de cards, seções |
| `lg` | `24px` | `p-lg` / `gap-lg` | Padding de modal/panel |
| `xl` | `40px` | `p-xl` / `mt-xl` | Espaço vazio / empty states |

Exposto via `--spacing-*` no `@theme` (coexiste com a escala numérica default `p-1`, `p-2`, etc.).

## Border radius (travado)

| Token | Valor | Tailwind |
| ----- | ----- | -------- |
| `sm` | `5px` | `rounded-sm` |
| `md` | `8px` | `rounded-md` |
| `lg` | `12px` | `rounded-lg` |

Também usados na UI (fora do token): `rounded-full` (pills), `rounded-xl` (composer), `rounded-[0.75rem]` (codeblock CSS).

## Grid / layout

Não há grid system próprio (12 colunas / gutter / max-width tokenizados).

Padrões observados 🟡:

| Padrão | Onde |
| ------ | ---- |
| `max-w-5xl` + `mx-auto` | Composer / conteúdo central |
| `max-w-[640px]` | Modais de form |
| `w-[280px]` | Dropdowns (BranchSelector) |
| `fixed inset-0` + `place-items-center` | Overlay de modal |

## Breakpoints

| Token | Valor | Confiança |
| ----- | ----- | --------- |
| sm / md / lg / xl / 2xl | Tailwind defaults (640 / 768 / 1024 / 1280 / 1536) | 🟡 não customizados (F01.1 adia breakpoints tokenizados) |

App Electron desktop-first; breakpoints mobile pouco usados.

## Z-index

Sem escala tokenizada. Valores ad-hoc 🟡:

| Valor | Uso |
| ----- | --- |
| `z-50` | Dropdowns, modais |
| `z-40` / `z-20` | Camadas pontuais em componentes |

## Shadows

Sem elevação tokenizada. Uso 🟡:

| Classe | Uso |
| ------ | --- |
| `shadow-lg` | Modais, menus |
| Arbitrary `shadow-[…]` | Casos isolados |

## Transições

| Token / padrão | Valor | Confiança |
| -------------- | ----- | --------- |
| Chrome action (markdown) | `color 0.12s ease`, `background-color 0.12s ease` | 🟢 |
| `transition-colors` | Tailwind default | 🟡 |
| Troca de tema | duração forçada a `0s` via `.no-transitions` | 🟢 |

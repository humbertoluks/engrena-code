---
name: coding-react
description: >-
  Applies portable React/renderer coding patterns: process isolation, service
  client over raw fetch, business rules extracted to testable modules, shared
  server validation, visible fetch errors, theme/CSS layers, and brand hygiene.
  Use when writing or editing React components, hooks, screens, or renderer
  services. Read rules/*.md for the matched concern; read project.md for this
  repository's path and audit bindings.
---

# Coding — React

Guia proativo para **escrever** código no renderer. Não é review (isso é `review-architecture` / `review-delivery`): aplique antes de o código existir.

**Camadas:**

| Arquivo | Conteúdo |
|---------|----------|
| Este `SKILL.md` | Roteamento — quando aplicar e índice de slugs |
| `rules/*.md` | Regras atômicas **portáveis** (Incorrect/Correct) |
| `project.md` | Bindings deste repositório (paths, IDs de auditoria, marca) |

Carregue também a skill de performance React do ecossistema (ex.: `/vercel-react-best-practices`) quando a sessão for de código React.

## When to Apply

- Escrever ou editar componentes, hooks ou telas React
- Extrair regra de formulário/lista para módulo testável
- Adicionar service HTTP no renderer
- Revisar catch de fetch, tema, Tailwind layers ou copy de marca

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Boundary | CRITICAL | `boundary-` |
| 2 | Logic extraction | HIGH | `logic-` |
| 3 | Error visibility | HIGH | `error-` |
| 4 | State freshness | MEDIUM | `state-` |
| 5 | Style and theme | MEDIUM | `style-` |

## Quick Reference

### 1. Boundary (CRITICAL)

- `boundary-no-node-imports` — Never import Node/Electron as values in the renderer
- `boundary-no-direct-fetch` — Domain data via service client, not raw fetch in screens
- `boundary-single-api-client` — One shared HTTP client for authenticated requests
- `boundary-no-secrets-in-storage` — Never store secrets in renderer localStorage

### 2. Logic extraction (HIGH)

- `logic-extract-from-tsx` — Business rules out of TSX into testable modules
- `logic-shared-server-validation` — Share validation with the server from one pure module
- `logic-ui-spec-first` — Write or consult the screen UI spec before implementing

### 3. Error visibility (HIGH)

- `error-no-silent-catch` — Never swallow fetch errors with empty catch

### 4. State freshness (MEDIUM)

- `state-refetch-on-modal-close` — Refetch derived link counts when the mutating modal closes

### 5. Style and theme (MEDIUM)

- `style-theme-persistence` — Persist theme preference in localStorage; hexes only in CSS
- `style-explicit-sizing` — Explicit sizing when theme spacing overrides container scales
- `style-css-layer-base` — Element CSS inside `@layer base` under Tailwind 4
- `style-current-brand-only` — Current product brand only in UI/copy/names

## How to Use

1. Escolha o slug pela categoria acima.
2. Leia `rules/<slug>.md` para Incorrect/Correct.
3. Se precisar de path real, header, porta ou ID `RC-*` deste repo, leia `project.md` — **não** invente bindings a partir da regra genérica.
4. Achado novo de auditoria → atualize `project.md` (e o artefato de audit), não o corpo da regra portável.

## New rule

Copy `rules/_template.md` → `rules/<prefix>-<slug>.md`. Section metadata: `rules/_sections.md`.

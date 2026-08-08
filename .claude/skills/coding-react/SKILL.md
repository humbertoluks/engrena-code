---
name: coding-react
description: >-
  Aplica os padrões de React/renderer do EngrenaCode (isolamento sem Node,
  fluxo service → HTTP loopback, regra extraída para *.logic.ts, tema e
  Tailwind 4) e as lições já registradas em auditoria para não repetir erros
  de fronteira ou regra não-testável. Use ao escrever ou editar telas,
  componentes ou hooks em src/renderer/.
---

# Coding — React

Guia proativo para **escrever** código no renderer. Não é review (isso é `review-architecture`/`review-delivery`): aplique antes de o código existir.

Fonte: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (Stack `React`) + `CLAUDE.md`. Carregue também `/vercel-react-best-practices` no início de qualquer sessão de código React (regra do `CLAUDE.md`).

## Padrões obrigatórios

- **Sem Node no renderer.** Nunca importe `node:*`, `fs`, `path`, `os`, `child_process`, `http`, `https`, `electron` como valor em `src/renderer/**`. `import type` de `src/services/**` é aceito; import de *valor* que puxe SQLite/`fs`/spawn não é.
- **Sem `fetch` direto em tela/componente**, exceto `LoginScreen` (unlock, rota pública pré-sessão). Todo dado de domínio passa por `src/renderer/services/<domínio>-service.ts` → `api-client.ts` (`apiRequest`) → `http://127.0.0.1:5174` + header `x-engrenacode-session`.
- **Regra de negócio nunca vive no `.tsx`.** `vitest.config.ts` só cobre `src/**/*.test.ts` — validação, filtro, formatação, ordenação, clamp, habilitação de botão extraídos para `*.logic.ts` colocado + `*.logic.test.ts`. O `.tsx` só renderiza, faz wiring de evento e chama o service. Precedentes: `composer.logic.ts`, `ruleForm.logic.ts`, `subagentRun.format.ts`, `consumoScreen.logic.ts`.
- **Nunca engula erro de fetch com `.catch(() => {})`.** Logue (`console.error('[<módulo>]', err)`) e leve para um estado de erro visível na UI (`InlineFeedback`/`role="alert"`), com o botão voltando a habilitar após falha. Cancelamento deliberado (`AbortError` por unmount) pode ser silencioso.
- **Um cliente HTTP só** (`api-client.ts`). Não crie `fetch` + headers de sessão duplicados em cada `*-service.ts` novo.
- Tema: persista em `localStorage` chave `engrenacode:theme` (`light|dark|system`); hexes só em `:root`/`.dark`. Tailwind 4 via `@theme inline`, nunca `tailwind.config.ts` clássico.
- Tailwind 4: nunca use `max-w-`/`w-`/`h-` com sufixo `xs|sm|md|lg|xl` — `--spacing-*` do Design Lock vence `--container-*` e colapsa o elemento (`max-w-sm` vira `8px`). Use valor explícito, ex. `max-w-[24rem]`.
- Envolva CSS de elemento em `@layer base` — `@import 'tailwindcss'` põe utilitários em `@layer utilities`, e regra sem layer vence layer, anulando `p-*`/`m-*`. Nunca repita reset de margin/padding/box-sizing (preflight já cobre).
- Marca: só `EngrenaCode`/`engrenacode` em UI, copy e nomes de componente. Nunca `Lion*`.
- Antes de implementar uma tela nova ou corrigir uma existente, escreva/consulte o `ui.md` da feature (anatomia + tabela de copy) — tokens sozinhos não garantem fidelidade visual.

## Erros já registrados aqui — não repita

Abertos nesta auditoria (corrija ao tocar a tela):

- `R-business-rule-in-tsx` (D01) — `ConfiguracaoScreen.tsx:530`, filtros de Skills/Mcps/Subagents/Rules, `ProjectMemoryModal.tsx:43-47` têm regra/filtro/formatação ainda dentro do `.tsx`. Ao tocar qualquer um desses arquivos, extraia para `*.logic.ts` com teste antes de adicionar comportamento novo por cima.
- `R-business-rule-in-tsx` (D02) — `ConsumoScreen.tsx:114`, `LogTable.tsx:53` têm formatação residual no `.tsx`; mesma correção ao tocar.

Já corrigidos — não regrida:

- `RC-no-silent-catch` — `.catch(() => {})` vazio já foi substituído por log + tratamento; não reintroduza catch mudo em `loadStatus`/chamadas equivalentes.
- `RC-shared-api-request` — services já usam `api-client.ts`; não volte a duplicar `fetch` com headers próprios num service novo.

## Se encontrar um padrão novo

Se um erro não listado aqui aparecer no caminho, registre em `docs/AUDIT-CODE-REVIEW.md` (via `audit-full-base`) ou, se for regra transferível e não-óbvia, em `CLAUDE.md` no formato `Origem · Categoria · [Sempre/Nunca] X porque Y`.

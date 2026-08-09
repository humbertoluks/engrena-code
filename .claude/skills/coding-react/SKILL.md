---
name: coding-react
description: >-
  Aplica os padrões de React/renderer do EngrenaCode (isolamento sem Node,
  fluxo service → HTTP loopback, regra extraída para *.logic.ts, validação
  compartilhada com o servidor, tema e Tailwind 4) e as lições já registradas
  em auditoria para não repetir erros de fronteira ou regra não-testável. Use
  ao escrever ou editar telas, componentes ou hooks em src/renderer/.
---

# Coding — React

Guia proativo para **escrever** código no renderer. Não é review (isso é `review-architecture`/`review-delivery`): aplique antes de o código existir.

Fonte de verdade: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (Stack `React`) + `CLAUDE.md`. A lista de abertos abaixo é **espelho** da última passagem — releia o código antes de agir sobre um item. Carregue também `/vercel-react-best-practices` no início de qualquer sessão de código React (regra do `CLAUDE.md`).

## Padrões obrigatórios

- **Sem Node no renderer.** Nunca importe `node:*`, `fs`, `path`, `os`, `child_process`, `http`, `https`, `electron` como valor em `src/renderer/**`. `import type` de `src/services/**` é aceito; import de *valor* só se o módulo for **puro** (sem SQLite/`fs`/spawn/`electron`) — precedente: `composer.logic.ts` ← `composer-images.ts`; validadores de key ← `vault/provider-keys.ts` / `http/github-token.ts`.
- **Sem `fetch` direto em tela/componente**, exceto `LoginScreen` (unlock, rota pública pré-sessão). Todo dado de domínio passa por `src/renderer/services/<domínio>-service.ts` → `api-client.ts` (`apiRequest`) → `http://127.0.0.1:5174` + header `x-engrenacode-session`.
- **Regra de negócio nunca vive no `.tsx`.** `vitest.config.ts` só cobre `src/**/*.test.ts` — validação, filtro, formatação, ordenação, clamp, habilitação de botão extraídos para `*.logic.ts` + `*.logic.test.ts`. O `.tsx` só renderiza, faz wiring de evento e chama o service.
- **Regra compartilhada com o servidor: uma fonte só.** Não re-declare `MIN_KEY_LENGTH`, prefixos (`sk-ant-`, `xai-`, `ghp_`, …) nem mensagens de formato no `*.logic.ts` se o servidor já valida em `provider-keys.ts` / `github-token.ts`. Importe o validador puro e adapte o retorno à UX (`string | null`). Drift cliente/servidor é 🔴 (`R-duplicated-client-server-validation`).
- **Nunca engula erro de fetch com `.catch(() => {})`.** Logue (`console.error('[<módulo>]', err)`) e leve para estado de erro visível (`InlineFeedback`/`role="alert"`), com o botão voltando a habilitar após falha. Cancelamento deliberado (`AbortError` por unmount) pode ser silencioso.
- **Um cliente HTTP só** (`api-client.ts`). Não crie `fetch` + headers de sessão duplicados em cada `*-service.ts` novo.
- `localStorage` do renderer: `sessionToken`, `engrenacode:theme`, e filas/UX sem credencial (ex.: composer queue). Nunca chave de provider, token VCS ou segredo de MCP.
- Tema: persista em `localStorage` chave `engrenacode:theme` (`light|dark|system`); hexes só em `:root`/`.dark`. Tailwind 4 via `@theme inline`, nunca `tailwind.config.ts` clássico.
- Tailwind 4: nunca use `max-w-`/`w-`/`h-` com sufixo `xs|sm|md|lg|xl` — `--spacing-*` do Design Lock vence `--container-*` e colapsa o elemento (`max-w-sm` vira `8px`). Use valor explícito, ex. `max-w-[24rem]`.
- Envolva CSS de elemento em `@layer base` — `@import 'tailwindcss'` põe utilitários em `@layer utilities`, e regra sem layer vence layer, anulando `p-*`/`m-*`. Nunca repita reset de margin/padding/box-sizing (preflight já cobre).
- Marca: só `EngrenaCode`/`engrenacode` em UI, copy e nomes de componente. Nunca `Lion*`.
- Antes de implementar uma tela nova ou corrigir uma existente, escreva/consulte o `ui.md` da feature (anatomia + tabela de copy) — tokens sozinhos não garantem fidelidade visual.
- **Contador derivado de vínculo N:N refetch no fechamento do modal que pode mutá-lo, não só na troca da entidade pai.** Um `useEffect([project])` que busca contagem de Rules/Skills/SubAgents/MCPs não reexecuta quando o modal de vínculo fecha — extraia a busca pra função reutilizável e chame também no `onClose` do modal (padrão `refreshHarnessCounts` em `WorkspaceSidebar.tsx`).

## Erros já registrados aqui — não repita

Abertos: nenhum nesta Stack.

Já corrigidos — não regrida:

- `RC-shared-validation` — `configuracaoScreen.logic.ts` importa `validate*Key` de `vault/provider-keys.js` e `validateGithubToken` de `http/github-token.js`. Não volte a re-declarar prefixo, comprimento mínimo ou mensagem de formato no renderer: o `*.logic.ts` só adapta o retorno à UX.
- `RC-business-rule-in-tsx` — regras de telas/modais migradas para `*.logic.ts` (17/17 com teste irmão na base). Não devolva validação/filtro/formatação para o `.tsx`.
- `RC-no-silent-catch` — não reintroduza `.catch(() => {})` mudo em `loadStatus`/chamadas equivalentes.
- `RC-shared-api-request` — services já usam `api-client.ts`; não volte a duplicar `fetch` com headers próprios.
- `RC-harness-count-stale-after-modal-close` — `WorkspaceSidebar.tsx` refetch das 4 contagens do Repo Harness (Rules/Skills/SubAgents/MCPs) extraído para `refreshHarnessCounts(projectId)`, chamado tanto na troca de projeto quanto no `onClose` dos 4 modais de vínculo. Achado ao vivo no smoke de F05 (dado certo no servidor, contagem obsoleta na tela até reselecionar o projeto). Não volte a deixar o `useEffect` reagir só à entidade pai.

## Se encontrar um padrão novo

Se um erro não listado aqui aparecer no caminho, registre em `docs/AUDIT-CODE-REVIEW.md` (via `audit-full-base`) ou, se for regra transferível e não-óbvia, em `CLAUDE.md` no formato `Origem · Categoria · [Sempre/Nunca] X porque Y`.

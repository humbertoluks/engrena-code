---
name: coding-typescript
description: >-
  Aplica tipagem estrita transversal do EngrenaCode (zero any injustificado,
  narrowing em toda fronteira, union discriminada, contrato de wire
  espelhado) quando o achado não pertence a uma Stack mais específica. Use
  ao escrever tipos, interfaces ou funções puras em qualquer .ts/.tsx, ou
  quando a dúvida for de tipagem e não de Electron/React/Node.js/SQLite.
---

# Coding — TypeScript

Guia proativo de tipagem, transversal às demais Stacks. Achados de tipagem em arquivo de Electron/React/Node.js/SQLite ficam registrados na Stack do arquivo, não aqui — esta skill é para o que sobra (tipos puros, contratos compartilhados) ou como reforço geral de tipagem ao lado da skill da Stack do arquivo tocado.

Fonte: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (checklist "Tipagem estrita" herdado de `review-robustness`).

## Padrões obrigatórios

- **Zero `any` sem justificativa.** `any`, `as any`, `<any>` novo é erro, salvo comentário na linha explicando por que `unknown` + narrowing não serve.
- **Toda fronteira recebe `unknown` e estreita** — não recebe o tipo desejado por fé. Fronteira = body HTTP, argumento de IPC, leitura de arquivo, resposta de provider externo, payload de `postMessage`/WS.
- `as` que força a forma de um objeto em código de **produção** é erro. Em fake de teste (`fakeReq`/`fakeRes`) é aceito.
- `!` (non-null assertion) e `?? {}` mascarando ausência real de dado: prefira checagem explícita com erro nomeado em vez de assumir presença.
- Resultado de validação usa **união discriminada**, não booleano com mensagem por fora:

```ts
type ValidationResult =
  | { ok: true }
  | { ok: false; code: 'type' | 'size'; message: string }
```

- Estado com combinações impossíveis (`isLoading` + `error` + `data` todos opcionais soltos) é sinal de que falta uma união — modele os estados válidos como variantes, não como campos independentes.
- Contrato de wire duplicado entre `src/renderer/services/*-service.ts` e o handler/repositório correspondente precisa bater campo a campo. Divergência silenciosa (campo renomeado só de um lado) é bug crítico, não estilo — teste de contrato ou tipo compartilhado evita isso.
- Limite numérico e enum validados contra a fonte canônica (ex.: `provider-catalog.ts`, `composer-images.ts`), nunca contra um literal duplicado solto no arquivo novo.

## Como isto se encaixa nas outras Stacks

Achado de `any`/narrowing em `src/services/http/*` é reportado como `Node.js` (ver `coding-nodejs`); em `src/main`/`src/preload` como `Electron`; em `src/renderer/**` como `React`; em `src/services/db/**` como `SQLite`. Use esta skill como reforço de princípio geral, não como categoria concorrente.

## Se encontrar um padrão novo

Se um erro de tipagem não listado aqui aparecer no caminho, registre em `docs/AUDIT-CODE-REVIEW.md` (via `audit-full-base`) na Stack do arquivo tocado, ou, se for regra transferível e não-óbvia, em `CLAUDE.md` no formato `Origem · Categoria · [Sempre/Nunca] X porque Y`.

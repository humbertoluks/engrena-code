# Smoke: F16. Composer Avançado

**Data:** 2026-08-06 (smoke inicial) e 2026-08-07 (2 gaps de AC fechados ao vivo)
**Método:** `pnpm dev` (Electron real, `dangerouslyDisableSandbox`) + `playwright-cli` em `http://localhost:5173`, `ENGRENACODE_USER_DATA` isolado, projeto fixture git fora do repo. Residual: build empacotado + `playwright-cli`, `ANTHROPIC_API_KEY` unset (autenticação pela assinatura do binário).

**Nota de proveniência:** este arquivo foi escrito em 2026-08-09 formalizando, no local e formato padrão, o smoke real já narrado com detalhe em `docs/PROGRESS.md` (linhas 70–89 na época) — não é uma nova rodada de smoke ao vivo.

## Confirmado ao vivo (2026-08-06, sem turno real de agente — só verificação visual/funcional)

1. **Picker de provider/modelo**: "Claude · claude-sonnet-4-6" abre popover com sidebar de providers + busca + listbox de modelos; troca de modelo reflete no trigger.
2. **Pill de reasoning**: abre os 5 níveis (Low/Medium/High/Extra High/Max); seleção de "High" reflete no trigger.
3. **Menu `@`**: debounce real contra `GET /api/projects/:id/files` (`200 OK` confirmado nos requests) — mostra `Nenhum arquivo` num repo vazio e depois o arquivo real após criar um; inserção do path relativo (`@App.tsx`) no texto.
4. **Upload de imagem real**: PNG via `input[type=file]` mostra thumb na tira acima do textarea; botão "Remover" funciona.
5. **`GET /api/composer/catalog`**: `200 OK` confirmado nos requests de rede.
6. **Zero erros/warnings de console** durante toda a sessão.
7. **Light/dark**: conferido via screenshot (tokens do Design Lock, sem hex solto) — `ui/composer-avancado-referencia.png`.

## Confirmado ao vivo — 2 gaps de AC fechados (2026-08-07, provider `claude` real via assinatura)

8. **CTA "Anexar imagens" desabilitado em provider não-multimodal**: draft trocado pra Kimi (`multimodal:false`) via picker real — CTA de anexo desabilitado com `title` lido direto do DOM = `"Este provider não aceita anexos de imagem."`, batendo exato com `ComposerImageAttachments.tsx` (`COPY.disabledMultimodal`); confirmado independente da disponibilidade do provider (Kimi sem CLI, banner separado).
9. **Thumb de imagem no histórico real**: 2 turnos reais dispatchados contra o binário `claude` com imagem anexada via `input[type=file]` real (PNG 1×1 na 1ª tentativa — sem thumb visível por ser fixture degenerado, não bug; PNG 48×48 colorido na 2ª — visualmente confirmado). `MessageImageThumbs` renderizou sob a bolha do usuário nos dois turnos, `alt="Imagem anexada"` e classes exatas de `ui.md`, light e dark.

## Não exercitado neste smoke

- Nenhum item relevante do PRD ficou de fora — os 2 gaps residuais foram fechados ao vivo em 2026-08-07.

## Screenshots

- `ui/composer-avancado-referencia.png` (já existente no repo desde a implementação original)

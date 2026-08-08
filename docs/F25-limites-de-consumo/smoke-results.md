# Smoke: F25. Limites de Consumo (UsageLimits)

**Data:** 2026-08-08
**Método:** app empacotado (`electron-builder --dir`) com `--remote-debugging-port=9222`, `ENGRENACODE_USER_DATA` isolado sob `C:\f25rt`, CDP attach via `playwright-cli`. Vault e `userData` reais do usuário intocados. Gasto seedado direto no SQLite isolado (1 `usage_events` de $41, `cost_source=sdk`) — sem turno pago, já que o objetivo é exercitar o card/gate/banners, não o `cli-driver` (já coberto pelas outras features).

## Setup

- 1 projeto fixture (`F25 Usage Limits Smoke`, `C:\f25rt\project`, repo git real).
- 1 `usage_events` seedado: `costUsd=41`, `provider=claude`.

## Confirmado ao vivo

1. **Card "Limites de consumo"** em `#consumo`: posicionado após o Resumo e antes de Projetos (spec §3.2), anatomia exata do `ui.md` §A — título, hint, Escopo (Global/Este projeto), Limite (USD), segmented Avisar/Bloquear, estado vazio "Sem limite configurado neste escopo.".
2. **Escopo "Este projeto"**: select de projeto aparece só quando o escopo muda para Projeto (decisão spec §3.2); com nenhum projeto selecionado, formulário volta ao estado vazio (sem limite, sem barra).
3. **Salvar limite global 50 USD, modo Avisar**: barra e banner aparecem imediatamente após salvar — `$41.00 / $50.00 · 82%`, exatamente o formato da fixture (`docs/F25-.../ui/usage-limits-usd-fixture.html`); banner âmbar `role="status"` com o texto provisório do spec §3.3 ("Você atingiu 80% do limite de consumo deste período.").
4. **Composer (Workspace)**: mesmo banner âmbar aparece acima do textarea ao selecionar o projeto, com link "Ajustar limite" para `#consumo`; turno **não** bloqueado (Enviar segue disponível).
5. **Trocar para Bloquear com limite 30 USD** (abaixo do gasto de 41): barra vira vermelha, `136%` (largura visual limitada a 100%), banner vermelho `role="alert"` com o texto provisório de bloqueio; no composer, textarea fica `disabled` e o mesmo banner vermelho aparece.
6. **Gate real do servidor**: `POST /api/projects/:id/threads` direto via curl (mesmo token de sessão da UI) contra o projeto bloqueado devolveu `409 usage_limit_exceeded` com `details.spentUsd=41`, `limitUsd=30`, `scope=global`, `adjustHash=#consumo` — confirma que o bloqueio é aplicado no servidor, não só no client.
7. **Light/dark**: ambos os temas conferidos via screenshot no estado bloqueado — tokens do Design Lock, zero hex solto.

## Bug real encontrado e corrigido pelo smoke

O primeiro carregamento de `#consumo` com um projeto real disparou 3 erros de console: `GET /api/usage-limits/status?projectId=...` devolvendo `404 not_found` mesmo com o projeto existindo. Causa: o roteador de nível superior em `createUnlockServer` (`src/services/http/unlock-handler.ts`) só encaminhava para `handleConsumoRequest` quando a URL começava com `/api/metrics/` ou `/api/pricing` — as novas rotas `/api/usage-limits`/`/api/usage-limits/status` nunca chegavam ao `consumo-handler.ts`, que já as roteava corretamente internamente (`isConsumoUrl`). Corrigido em `fix(F25): forward /api/usage-limits routes to the consumo handler`, com um teste de regressão adicionado à cadeia `423 vault_locked` já existente em `unlock-handler.test.ts` (que teria pego esse gap: rota não encaminhada cai em `404`, não `423`, com o vault travado).

## Screenshots

- `smoke/f25_limits_empty_dark.png` — card vazio
- `smoke/f25_limits_warn80_dark.png` — 82%, modo Avisar
- `smoke/f25_composer_warn80_dark.png` — banner âmbar no composer
- `smoke/f25_limits_blocked_dark.png` — 136%, modo Bloquear
- `smoke/f25_composer_blocked_dark.png` — banner vermelho + composer desabilitado
- `smoke/f25_limits_blocked_light.png` — tema claro, estado bloqueado
- `smoke/f25_limits_project_scope_light.png` — escopo Projeto com select

## Não exercitado neste smoke

- `cost_usd IS NULL` não mover a barra — coberto por teste unitário (`sum_ignores_null_cost_usd`), não reproduzido ao vivo (reproduzir exigiria um evento sem preço, cenário já coberto no smoke de F11).
- Combinação global+projeto simultânea (pior estado) — coberta por teste de integração (`eval_worst_of_global_and_project`), não reproduzida ao vivo.

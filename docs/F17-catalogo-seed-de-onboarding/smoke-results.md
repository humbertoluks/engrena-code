# Smoke: F17. Catálogo Seed

**Data:** 2026-08-06/07 (janela de implementação/fechamento de F17)
**Método:** Electron empacotado (`--user-data-dir` isolado, vault real do usuário intocado) + `playwright-cli`.

**Nota de proveniência:** este arquivo foi escrito em 2026-08-09 formalizando, no local e formato padrão, o smoke real já narrado em `docs/PROGRESS.md` (linha 31 da tabela de features na época) — não é uma nova rodada de smoke ao vivo. F17 não tem tela própria (não há `ui.md`/screenshot dedicados): o seed alimenta `#skills`/`#subagents` (F05/F07) e o card "Catálogo" do Dashboard (F04), todas com smoke próprio.

## Confirmado ao vivo

1. **Primeiro unlock aplica o catálogo**: pacote v1 (12 skills + 8 subagents `kind=dev`, provider `inherit`, marca EngrenaCode only) aplicado via `apply-catalog.ts` logo após o primeiro unlock bem-sucedido.
2. **Contagens refletidas nas telas reais**: Dashboard mostra "Catálogo" 12/8; `#skills` e `#subagents` listam todos os 20 `names` do pacote.
3. **Idempotência**: lock + re-unlock não duplica — contagens permanecem estáveis (flag vault `seeds:catalog:v1` impede reaplicação).

## Não exercitado neste smoke

- Conflito de `name` entre catálogo seed e skill/subagent já criado pelo usuário antes do primeiro unlock (skip documentado no código, coberto por `apply-catalog.test.ts`, não reproduzido manualmente na UI).
- Falha parcial do seed (log + continua) — comportamento coberto por teste unitário, não forçado ao vivo.

## Screenshots

- Nenhum screenshot dedicado — evidência visual do resultado do seed está nos smoke-results.md de F04 (Dashboard), F05 (Skills) e F07 (Subagents).

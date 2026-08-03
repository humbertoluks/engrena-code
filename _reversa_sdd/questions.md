# Perguntas para Validação — sistema legado

> Gerado pelo Revisor em 2026-07-28  
> Nível: essencial (apenas lacunas 🔴 que bloqueiam reimplementação)

---

## Pergunta 1

**Contexto:** Módulo `git` — estados `pr-merged` / `pr-closed` existem no CHECK do schema e na UI (`threadVisuals`, DiffViewer), mas o servidor só escreve `pr-open` em `routes/open-pr.ts`.
**Spec afetada:** [`_reversa_sdd/git/design.md`](git/design.md), [`_reversa_sdd/git/commit-pr-worktree/design.md`](git/commit-pr-worktree/design.md)
**Pergunta:** Esses estados são (a) manuais/UI-only, (b) fora de escopo da reimplementação (só espelhar o enum), ou (c) há integração (webhook/polling) fora do código visível?
**Impacto:** Define se a reimplementação precisa de consumidor de eventos GitHub ou apenas espelhar o enum no schema/UI.

✅ Respondida

**Resposta:** (b) fora de escopo — só espelhar o enum.

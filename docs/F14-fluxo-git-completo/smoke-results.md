# Smoke: F14. Fluxo Git Completo

**Data:** 2026-08-06 (smoke inicial, commit + push falho) e 2026-08-07 (residual: PR real contra o GitHub)
**Método:** `pnpm dev` (Electron real, `dangerouslyDisableSandbox`) + `playwright-cli` em `http://localhost:5173`, `ENGRENACODE_USER_DATA` isolado, provider `claude` real. Residual: build empacotado + `playwright-cli`, `ANTHROPIC_API_KEY` unset, repo scratch dedicado (`humbertoluks/engrenacode-f14-smoke`, descartável), autorização explícita do usuário para a ação irreversível de PR real.

**Nota de proveniência:** este arquivo foi escrito em 2026-08-09 formalizando, no local e formato padrão, o smoke real já narrado com detalhe em `docs/PROGRESS.md` (linhas 103–109 e linha 28 da tabela na época) — não é uma nova rodada de smoke ao vivo.

## Confirmado ao vivo (2026-08-06, projeto fixture com remote `origin` local — bare repo, não GitHub)

1. **Anatomia**: bate com `ui.md` — subject + "Gerar com IA", body, toggle "Detalhes do PR", três ações.
2. **Gerar com IA real** (2 chamadas de textgen contra o binário `claude`): preencheu subject/body reais a partir do diff (modo commit) e title/body/subject reais (modo PR, incluindo o "subject" reaproveitado do title, conforme spec §5.4).
3. **Commit real**: caiu no disco com a mensagem gerada pela IA (`git log` confirmado fora do app).
4. **Commit & push**: commitou localmente e falhou o push com "Configure um token do GitHub em Configuração antes de fazer push." **sem reverter o commit local**.
5. **Gate `thread_busy`**: todos os campos e os três botões ficaram desabilitados com `thread.state=running` durante um turno real.
6. **Light/dark**: conferido via screenshot, tokens do Design Lock sem hex solto — `ui/git-actions-referencia.png`.

## Confirmado ao vivo — residual PR real (2026-08-07, com autorização explícita do usuário)

7. **PR real contra o GitHub ponta a ponta**: thread com `executionMode=main` numa branch feature checked-out manualmente (`executionMode=worktree` bateu num limite de path do Windows nesse ambiente de smoke — `fatal: '$GIT_DIR' too big.`, artefato de path profundo do userData isolado, não investigado, fora de escopo desta rodada); turno real do `claude` criando um arquivo; "Gerar com IA" preenchendo subject/body do commit e title/body do PR; "Commit, push & PR" → commit real, push real (branch `f14-pr-smoke-feature` confirmada no GitHub), **PR real criado e confirmado via API** (`https://github.com/humbertoluks/engrenacode-f14-smoke/pull/1`, head→base `f14-pr-smoke-feature`→`main`); CTA "Ver PR" clicado sem erro (`engrenacode:shell:open-external`, https-only).
8. No caminho: o PAT fine-grained do usuário precisava de `Contents: Read and write` e `Pull requests: Read and write` explícitos — sem bug no app, só permissão de token; usuário ajustou e o retry passou.

## Não exercitado neste smoke

- Nenhum item relevante do PRD ficou de fora — a criação real de PR (residual mais arriscado) foi fechada em 2026-08-07 com autorização explícita.

## Screenshots

- `ui/git-actions-referencia.png` (já existente no repo desde a implementação original)

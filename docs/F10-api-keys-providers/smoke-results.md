# Smoke: F10. API Keys dos Providers

**Data:** 2026-08-05
**Método:** `pnpm dev` (Electron real) + `playwright-cli`, `ENGRENACODE_USER_DATA` apontando para diretório isolado.

**Nota de proveniência:** este arquivo foi escrito em 2026-08-09 formalizando, no local e formato padrão, o smoke real já narrado com detalhe em `docs/PROGRESS.md` (linhas 134–140 na época) — não é uma nova rodada de smoke ao vivo.

## Confirmado ao vivo

1. **Anatomia do card**: "API keys dos providers" (Claude/Codex/Minimax) conferido contra `ui/api-keys-referencia.png` em light e dark — placeholders, badges.
2. **Erro de formato inline**: `Formato inválido. Esperado: sk-ant-…`.
3. **Save parcial preserva badges**: salvar só uma key não derruba o status "configurada" das outras.
4. **Feedback de sucesso**: `Chaves salvas localmente...`.
5. **Toggle Assinatura↔API key**: habilita só depois da key salva; aviso âmbar em modo API key.
6. **Integração no composer**: Minimax aparece no picker do Workspace (`#principal`) e o banner "Provider indisponível — Minimax sem key salva" desaparece assim que a key é salva.

## Nota técnica (não é bug)

A primeira tentativa de smoke usou o `app.getPath('userData')` padrão do Electron e bateu no vault real do usuário (`%APPDATA%\engrena-code\vault.enc`, já existente antes da sessão) — as tentativas de unlock com senha de teste corretamente falharam (`vault_corrupted`, comportamento anti-enumeração esperado). Nenhuma senha real foi comprometida ou tentada em excesso; o vault do usuário não foi alterado. A partir daí, todo smoke rodou com `ENGRENACODE_USER_DATA` isolado.

## Não exercitado neste smoke

- Teste de conexão real contra os providers (fora de escopo do card, que não tem CTA "Testar conexão" — só formato/persistência da key).

## Screenshots

- `ui/api-keys-referencia.png` (já existente no repo desde a implementação original)

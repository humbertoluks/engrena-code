# Prompt para o Claude Code — implementar F30

Cole o bloco abaixo num chat novo do Claude Code neste repositório.

---

Implemente a feature **F30. Avisos de runtime e permissão** com a skill `implement-feature`.

Pasta da feature (leia **todos** antes de codar):

- `apps/engrena-code/docs/F30-avisos-de-runtime-e-permissao/spec.md`
- `apps/engrena-code/docs/F30-avisos-de-runtime-e-permissao/plan.md`
- `apps/engrena-code/docs/F30-avisos-de-runtime-e-permissao/ui.md`
- `apps/engrena-code/docs/F30-avisos-de-runtime-e-permissao/copy.md`

PRD: `apps/engrena-code/docs/PRD.md` (bloco F30 + AC §9).  
Card/chips de permissão já especificados em `apps/engrena-code/docs/F03-workspace/{ui,copy}.md`. Não reabra o contrato de concessão no clique.

São **duas** entregas no mesmo plano (fases 1 e 2). Não entregue só uma.

## O que fazer

1. **Versão do Claude CLI** deixa de aparecer na tarja âmbar do chat. Continua no `log_entries` (linha técnica já existente). Na UI, vira caption muted na row Claude de `#configuracao` depois de Testar conexões (e se o cache `readClaudeCliVersion` já estiver quente). `GET /api/config/status` **não** spawna `claude --version`. Copy: só `{version}` e, se fora da faixa, “Ainda não conferida nesta versão.” Nunca citar `PreToolUse`, `2.1.226`, “contrato de permissão” ou “o turno não foi bloqueado” no chat.

2. **Card de permissão que expira** continua fail-closed em 2 minutos (`PERMISSION_TIMEOUT_MS` **não muda**). O card ganha relógio `mm:ss` no header (`gate.expiresAt`). A tarja pós-expiry usa só: “A permissão de {tool} expirou. Peça de novo ao agente.” Sem “negou por segurança”. Motivo cru do CLI vai para o log, não para a tarja. Os outros casos de `nativeDenialMessage` também passam pelos ids de `copy.md` (frases curtas).

## Regras deste repo (não pular)

- Conventional Commit **por fase** do `plan.md`, subject em inglês, sem acento. Não push. Não criar branch.
- Copy e anatomia: só o que está em `ui.md`/`copy.md` da F30 (deltas) e F03 (card).
- Tipos: `pnpm --filter engrena-code exec tsc -b` (nunca `tsc --noEmit -p tsconfig.json`).
- Testes da área no mesmo diff. Suite com git/spawn: rodar **duas vezes** antes de tratar vermelho como regressão.
- Sem `any` injustificado. Sem tela Sobre nova. Sem mudar a faixa validada do contrato. Sem classificador/sandbox.
- Marca: só EngrenaCode.
- Ao fechar com sucesso: marcar AC F30 no PRD e a linha em `PROGRESS.md` (passo 6.6 da skill).

## Fora de escopo

- Revalidar Claude CLI 2.1.234 contra o contrato de permissão.
- Auto-review, modo `auto` nativo, allowlist nova, timeout diferente de 2 min.
- Reescrever o fluxo de chips (já concede na hora).

Relatório final: checklist AC F30 ✓/✗ contra testes reais, desvios e smoke combinado (turno sem tarja de versão + Config com versão + expiry com copy curta).

# Bindings — EngrenaCode (Implementação)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

O `SKILL.md` é method puro e não cita este produto. Toda vez que ele diz "o PRD", "o arquivo de
progresso" ou "os gates", o valor está aqui.

## Mapa do repo

| Conceito | Neste repo |
|----------|------------|
| PRD | [`apps/engrena-code/docs/PRD.md`](../../../apps/engrena-code/docs/PRD.md) |
| Arquivo de progresso | [`apps/engrena-code/docs/PROGRESS.md`](../../../apps/engrena-code/docs/PROGRESS.md) — status real por feature + espelho de ondas |
| Pasta da feature | `apps/engrena-code/docs/F<ID>-<kebab-name>/` com `spec.md` + `plan.md` |
| Fonte de verdade de UI/copy | `ui.md` e `copy.md` na mesma pasta, quando existem |
| Regras aprendidas do repo | [`CLAUDE.md`](../../../CLAUDE.md) na raiz — leia antes de qualquer fase |
| Coding Experts | `.claude/skills/coding-{typescript,react,nodejs,electron,sqlite,vitest}/` |

## Gates deste repo

| Gate | Comando | Armadilha |
|------|---------|-----------|
| Tipos | `pnpm --filter engrena-code exec tsc -b` | `tsc --noEmit -p tsconfig.json` passa sem checar nada — falso verde |
| Testes | `pnpm --filter engrena-code test` | Rodar **duas vezes** antes de tratar vermelho como regressão: casos com git/spawn reais estouram timeout sob carga |
| Lint | `npx biome lint <arquivos tocados>` | `biome check` no repo inteiro falha no baseline |
| Build | `pnpm --filter engrena-code build` | Encerrar o app de dev antes: o rename de `release/win-unpacked` dá EPERM com Electron aberto |

## Convenções deste produto

- **Conventional Commits**, um por fase do plano, mensagem sem acento.
- Documentação e comentários em **português do Brasil**; código, identificadores e mensagem de commit
  em inglês.
- Ao fechar a feature: atualizar a linha em "Resumo por feature" do `PROGRESS.md`, reconciliar a
  tabela de Ondas contra o PRD §8, e marcar os critérios do PRD §9 **com evidência do tipo certo**
  (ver `prd-writer/rules/evidence-matches-claim.md`).
- Onda com qualquer feature pendente **não** é "Completa".

## Depois da implementação

O ciclo não termina no código verde. Feature com superfície visível exige homologação ao vivo antes
de qualquer critério de tela ser marcado — ver a skill `homologar`.

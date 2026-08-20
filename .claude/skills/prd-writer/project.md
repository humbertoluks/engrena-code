# Bindings — EngrenaCode (PRD)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

O `SKILL.md` é method puro e não cita este produto. Toda vez que ele diz "o PRD", "a raiz de docs"
ou "o espelho de ondas", o valor está aqui.

## Mapa do repo

| Conceito | Neste repo |
|----------|------------|
| PRD | [`apps/engrena-code/docs/PRD.md`](../../../apps/engrena-code/docs/PRD.md) — existe, PT-BR, 9 seções |
| Raiz de docs do app | `apps/engrena-code/docs/` |
| Espelho de ondas | [`apps/engrena-code/docs/PROGRESS.md`](../../../apps/engrena-code/docs/PROGRESS.md), tabela "Ondas (PRD §8)" |
| Pasta por feature | `apps/engrena-code/docs/F<ID>-<kebab-name>/` |
| Nome do produto | EngrenaCode |
| Segundo app do monorepo | `apps/engrena-plan/docs/PRD.md` — PRD próprio, nunca misturar |
| Docs de nível Engrena | `docs/` na raiz (Design Lock, sprints, architecture) — fora do escopo desta skill |

## Modo padrão: extensão, não criação

O PRD existe. A skill entra em **modo extensão** automaticamente — não pergunte se deve sobrescrever,
apenas confirme quais features está adicionando ou alterando antes de escrever.

- IDs seguem a sequência sem gap. Último em uso: **F35**. Próximo livre: **F36**.
- Nunca renumere nem reescreva feature existente sem pedido explícito.
- `F01.1` é a exceção de numeração já existente (Design System) — não replique o padrão.

## Ondas de execução

A tabela "Ondas (PRD §8)" de `PROGRESS.md` é **espelho derivado** da Seção 8, nunca segunda fonte.
Toda vez que esta skill mexer nas ondas, sincronize o espelho na mesma execução.

- Toda feature da tabela de dependências aparece em exatamente uma linha de onda, **incluindo as
  pendentes**. Feature nova nunca fica só num parágrafo de roadmap.
- O estado da onda reflete o status real das features nela: onda com qualquer pendência não é
  "Completa".
- O status por feature vem da tabela "Resumo por feature" do próprio `PROGRESS.md`. Esta skill
  reconcilia composição e paralelismo, não inventa status.
- Última onda em uso: **9**.

## Convenções deste produto

- Documento inteiro em **português do Brasil**.
- Features de Fundação: `F01` (Vault/scaffold), `F01.1` (Design System) e `F02` (Configuração).
  O repo está com Fundação **completa** — a subseção "Features de Fundação" da Seção 8 já existe e
  não deve ser recalculada sem motivo.
- Release gates de produto convivem com as ondas mecânicas e não as substituem. Em uso até
  **Versão 1.5 = F32–F35**.

## Precedentes vivos

| Slug da regra | Onde este repo pagou por ela |
|---|---|
| `evidence-matches-claim` | 2026-08-19: quatro critérios de F30 marcados `[x]` com base em teste unitário quando descreviam o que aparece na tela; a auditoria do mesmo dia apontou a contabilidade otimista. No sentido inverso, um critério de F35 classificado como "depende de tela" era tabela de transição no backend — um unitário de três linhas teria pego o defeito que só o smoke encontrou |
| `waves-mirror-is-derived` | Backlog descrito só em prosa ("próxima frente de produto") saiu do radar enquanto a onda correspondente aparecia como Completa |

## Marcação de critério de aceitação (Seção 9)

Regra deste produto, aprendida em 2026-08-19: `[x]` só com **evidência do tipo certo**. Critério que
descreve o que o usuário vê exige evidência de tela; teste unitário não serve. Ver
`rules/evidence-matches-claim.md`.

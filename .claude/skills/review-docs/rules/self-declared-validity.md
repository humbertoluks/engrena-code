---
title: Arquivo não pode ser a única testemunha da própria validade
impact: HIGH
impactDescription: Cabeçalho que declara frescor é acreditado sem conferência e sobrevive à própria obsolescência
tags: documentação, cache, staleness
---

## Arquivo não pode ser a única testemunha da própria validade

Artefato gerado costuma carregar cabeçalho dizendo quando foi produzido e se ainda vale:
`status: fresh`, `generated_at`, `última revisão`, `versão do índice`. O campo é útil e é
exatamente onde a mentira se instala, porque nada o atualiza quando o mundo muda.

O problema não é o campo existir — é ele ser **acreditado sem conferência**. Quem lê vê `fresh`,
confia, e usa. Pior quando existe uma regra de invalidação escrita em algum lugar ("se o sha não
bater com HEAD, não use") que ninguém executa, porque executá-la exige justamente desconfiar do
campo que diz estar tudo bem.

Duas saídas, nessa ordem de preferência:

1. **Torne o frescor verificável contra algo externo.** Guarde junto o commit, a versão ou o hash da
   entrada, e faça quem consome comparar. Aí o próprio artefato não é a testemunha.
2. **Se ninguém vai comparar, não guarde o campo.** Um artefato sem promessa de validade é lido com a
   desconfiança certa; um com promessa falsa é lido com confiança errada.

Numa revisão documental, todo campo de auto-validade é suspeito por padrão: confira contra a fonte
externa que ele cita, e se não citar nenhuma, o achado é esse.

**Incorrect:**

```markdown
| Campo | Valor |
|-------|-------|
| generated_at | 2026-08-07T09:30:00-03:00 |
| git_sha | 5908e276... |
| status | fresh |
```

O sha é de antes de uma reestruturação grande do repo; `status` continua dizendo `fresh`, e a regra
que manda recusar brief stale nunca disparou porque ninguém releu o cabeçalho.

**Correct:**

```markdown
| Campo | Valor |
|-------|-------|
| generated_at | 2026-08-07T09:30:00-03:00 |
| git_sha | 5908e276... |

> Este artefato é válido apenas enquanto `git_sha` for ancestral de HEAD.
> Confira antes de usar: `git merge-base --is-ancestor 5908e276 HEAD`
> Não há campo de status: o frescor é conferido, não declarado.
```

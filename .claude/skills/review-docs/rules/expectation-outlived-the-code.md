---
title: Expectativa documentada tem de acompanhar a mudança do código
impact: CRITICAL
impactDescription: Check desatualizado reprova o comportamento correto e manda desfazer a correção
tags: documentação, runbook, critério
---

## Expectativa documentada tem de acompanhar a mudança do código

O achado mais caro de uma revisão documental não é a instrução que parou de funcionar — é a
**expectativa** que descreve o comportamento antigo. Instrução quebrada dá erro e alguém investiga.
Expectativa velha faz o contrário: reprova o comportamento **correto**.

Aparece em runbook ("o esperado é X"), em critério de aceitação, em teste descrito em prosa, em
comentário que documenta invariante. Quando o código muda de propósito, esses lugares não quebram —
eles passam a mentir com autoridade, e a próxima pessoa a executar acredita neles.

Por isso, mudança de comportamento tem duas metades: alterar o código e **varrer o que declarava o
comportamento anterior**. A segunda metade não é opcional e não é documentação "para depois" — sem
ela a primeira vira regressão aos olhos de quem valida.

Busca útil ao mudar comportamento: procure o nome do valor antigo em todo o repo, não só no código.

**Incorrect:**

```markdown
| ✅ | **D1** · BLOQUEIA | Matar o app durante um turno e reabrir |
     Thread presa é reconciliada para `error` com motivo no registro |
```

O código passou a reconciliar para `interrupted`, de propósito. O check continua exigindo `error` —
e traz `✅` de uma rodada anterior, sob o critério antigo.

**Correct:**

```markdown
| ☐ | **D1** · BLOQUEIA | Matar o app durante um turno e reabrir |
    Thread presa é reconciliada para **`interrupted`** (não `error`), com motivo no registro |
```

A expectativa acompanhou o código, e a marcação voltou a aberto — o `✅` anterior provou outra coisa.

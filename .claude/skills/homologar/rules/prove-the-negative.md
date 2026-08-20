---
title: Prove também pelo negativo
impact: HIGH
impactDescription: Feature que existe para impedir algo só está provada quando o impedimento é observado
tags: homologação, evidência, permissão
---

## Prove também pelo negativo

Feature cujo valor é **impedir** alguma coisa não fica provada mostrando que o caminho feliz
funciona. Fica provada quando a coisa que não devia acontecer é observada não acontecendo.

Isso vale para toda superfície de política: permissão, limite, borda, isolamento, sandbox, quota.
Nessas, o caminho feliz é a parte fácil; a promessa está no que fica de fora.

O negativo é mais barato de medir do que parece, porque quase sempre é uma contagem: quantos pedidos
abriram, quantos arquivos mudaram, quantas linhas foram escritas. Zero é uma evidência forte e curta.

E o negativo tem um segundo uso: **provar que o teste sabe falhar**. Um jail que nunca detectou
escapatória nenhuma pode estar detectando nada. Vale rodar de propósito o caso que deve ser barrado,
para ver a barreira funcionando.

**Incorrect:**

```
Três comandos de shell rodaram em auto-accept. ✅ passou.
```

Não diz nada sobre a promessa da feature, que é rodar **sem pedir permissão**.

**Correct:**

```
Três comandos rodaram, e nenhum pedido de permissão foi criado:
  SELECT COUNT(*) FROM permission_gates WHERE thread_id = ... → 0

E a borda foi conferida pelo outro lado: o mesmo nível, com um caminho fora
do projeto, ABRIU pedido em vez de passar.
```

Duas medidas, uma contando ausência e outra confirmando presença onde deve haver.

---
title: Prova de precedência exige regras mutuamente exclusivas
impact: MEDIUM
impactDescription: Teste que as duas fontes podem satisfazer juntas não prova precedência nenhuma
tags: homologação, método, prova
---

## Prova de precedência exige regras mutuamente exclusivas

Para provar qual de duas fontes de instrução vence — configuração global contra local, regra de
projeto contra regra de sessão, default contra override — o teste precisa ser construído de forma que
**satisfazer as duas ao mesmo tempo seja impossível**.

O erro comum é escolher instruções compatíveis: "prefixe a resposta com A" numa fonte e "prefixe com
B" na outra. O sistema obedece as duas, responde com os dois prefixos, e o resultado não distingue
precedência de acumulação. O teste passa e não provou nada.

Escolha um eixo onde as opções se excluem por natureza. Idioma é o mais limpo: nenhuma resposta está
em português e em inglês ao mesmo tempo. Formato de saída, unidade de medida e persona funcionam pelo
mesmo motivo.

Segundo cuidado: **o gatilho não pode dar pista de qual lado deveria vencer**. Se o pedido menciona
uma das fontes, o resultado mede a sugestão, não a precedência.

**Incorrect:**

```
Fonte A: "comece toda resposta com [A]"
Fonte B: "comece toda resposta com [B]"
→ resposta: "[A][B] ..."   (nada provado)
```

**Correct:**

```
Fonte A: "responda sempre em português"
Fonte B: "responda sempre em inglês"
Pedido:  "quanto é 2+2?"      (neutro, sem citar nenhuma das fontes)
→ a resposta só pode estar num idioma, e o idioma nomeia o vencedor
```

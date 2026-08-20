---
title: Não edite o sistema no meio da bateria
impact: MEDIUM
impactDescription: Editar durante a medição reinicia processos, invalida sessão e mistura o resultado de duas versões
tags: homologação, método
---

## Não edite o sistema no meio da bateria

Achar defeito no meio da homologação é o resultado esperado — é para isso que ela existe. A tentação
é corrigir na hora, com o app aberto e o contexto fresco. Não corrija.

Editar durante a bateria custa de três formas:

- **Reinício silencioso.** Ferramenta de desenvolvimento observa arquivo e reinicia processo. Sessão
  em memória morre, cofre trava, credencial expira, e a próxima chamada falha por um motivo que não
  tem nada a ver com o que estava sendo medido.
- **Placar misturado.** Metade dos checks passou numa versão, metade em outra. O placar deixa de
  descrever qualquer build existente.
- **Achado perdido.** Corrigido de imediato, o defeito costuma não ser registrado com a evidência que
  o produziu — e a razão de ele ter escapado dos testes se perde junto.

O laço certo: **registre o achado com evidência, termine a bateria, corrija depois, e reexecute o
check que reprovou.** O check reexecutado é o que vira `✅`, e o registro conta as duas rodadas.

Exceção: defeito que impede continuar a bateria. Aí corrija, mas **reinicie a bateria do começo** —
não emende no meio.

**Incorrect:**

```
E11 reprovou → editei o arquivo → o app reiniciou → sessão caiu →
próximo check falhou com "não autorizado" → depurei a autorização por 10 min
```

**Correct:**

```
E11 reprovou. Evidência registrada: estado correto no banco, envio recusado
com <código>, sem botão para destravar. Causa localizada em <arquivo>.
Continuei E12. Ao fim da bateria: correção + teste + E11 reexecutado → ✅
```

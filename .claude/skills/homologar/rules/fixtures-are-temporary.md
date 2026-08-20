---
title: Fixture no dado do usuário nasce marcada e morre no fim
impact: HIGH
impactDescription: Dado de teste esquecido no ambiente do usuário vira dado real na leitura seguinte
tags: homologação, fixtures, dados
---

## Fixture no dado do usuário nasce marcada e morre no fim

Homologar às vezes exige uma condição que não existe: uma conversa longa demais para acontecer
naturalmente, um estado que só surge depois de um crash, um volume que levaria semanas.

Criar essa condição direto no armazenamento é legítimo — costuma ser mais barato e mais preciso que
provocá-la de verdade. Mas é escrita no dado de alguém, e por isso carrega três obrigações:

1. **Peça autorização.** É o dado do usuário, não do teste. Diga o que vai escrever, onde, e como
   remove depois.
2. **Marque no próprio conteúdo.** Um prefixo reconhecível no título ou no nome. Se algo der errado
   e a limpeza não rodar, o resíduo tem de ser identificável sem consultar aquela conversa.
3. **Remova ao fim e confira órfãos.** Contar o que sobrou é parte da remoção; cascade que não
   disparou deixa lixo invisível.

Estado alterado à mão também é fixture: anote o valor anterior antes de mudar e restaure depois.

O critério de saída da homologação inclui o ambiente: termina como começou, exceto pelo que o
**produto** escreveu enquanto era exercitado.

**Incorrect:**

```sql
UPDATE threads SET state = 'interrupted' WHERE id = 'thr_a1b2';
-- (conferiu a tela e seguiu em frente)
```

**Correct:**

```sql
-- 1. guarda o valor anterior
SELECT state FROM threads WHERE id = 'thr_a1b2';   -- 'idle'

-- 2. cria a condição, marcada
INSERT INTO threads (id, title, state, ...)
VALUES ('thr_fix1', '[fixture E12 - remover] thread interrompida', 'interrupted', ...);

-- 3. ao fim: remove, restaura e confere
DELETE FROM threads WHERE title LIKE '[fixture %';
UPDATE threads SET state = 'idle' WHERE id = 'thr_a1b2';
SELECT COUNT(*) FROM messages WHERE thread_id = 'thr_fix1';   -- 0, sem orfao
```

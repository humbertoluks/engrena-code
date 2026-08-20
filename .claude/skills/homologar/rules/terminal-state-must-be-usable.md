---
title: Estado terminal precisa ser testado como usável, não só como terminal
impact: CRITICAL
impactDescription: Estado que assenta corretamente mas trava a interação deixa o objeto inutilizável para sempre
tags: estado, máquina de estados, homologação
---

## Estado terminal precisa ser testado como usável, não só como terminal

Ao introduzir um estado, modo ou flag "final", a bateria natural de testes prova que ele **assenta**:
que a transição escreve o valor certo, que ele entra nos conjuntos de terminalidade, que a varredura
é idempotente. Todos passam, e nenhum responde a pergunta que o usuário faz: *e agora, dá para
continuar?*

Estado terminal quase nunca é fim de linha do ponto de vista de quem usa. É ponto de retomada. O
objeto tem de aceitar a próxima ação — mandar outra mensagem, reabrir, reexecutar, editar.

A armadilha específica: sistemas maduros costumam ter **mais de uma lista** classificando estados,
em camadas diferentes, e elas não se derivam umas das outras. Acrescentar o valor em algumas e
esquecer de outra não gera erro de tipo — gera recusa em tempo de execução, com mensagem que descreve
uma situação que não existe.

Ao acrescentar estado novo: liste **todos** os lugares que particionam o universo de estados, e
prefira uma trava que quebre a suíte quando um valor ficar sem classificação.

**Incorrect:**

```typescript
it('thread cortada volta como interrupted', () => { /* ... */ })
it('interrupted entra nos conjuntos terminais', () => { /* ... */ })
it('a varredura é idempotente', () => { /* ... */ })
```

Três verdes, e a thread não aceita mensagem nenhuma.

**Correct:**

```typescript
it('aceita follow-up e volta a rodar', () => {
  expect(nextState('interrupted', 'follow_up')).toBe('running')
})

it('todo estado assentado aceita follow-up', () => {
  for (const s of BUCKETS.settled) expect(nextState(s, 'follow_up')).toBe('running')
})

it('todo estado da união cai em exatamente um balde', () => {
  expect([...BUCKETS.live, ...BUCKETS.settled, ...BUCKETS.transitional].sort())
    .toEqual([...ALL_STATES].sort())
})
```

O último fecha a classe: valor novo sem classificação quebra aqui, e não em produção.

---
title: Leia a evidência onde ela já está, não instrumente para vê-la
impact: MEDIUM
impactDescription: Instrumentação muda o sistema medido e vira manutenção paralela
tags: homologação, evidência, observabilidade
---

## Leia a evidência onde ela já está, não instrumente para vê-la

Software que registra o que faz já produz a evidência da homologação. Banco, log e resposta de API
são fontes de primeira mão, acessíveis sem tocar no sistema medido.

Prefira essas a instrumentar: injetar contador, interceptar WebSocket, dublar módulo ou raspar DOM
para observar. Instrumentação tem três custos que aparecem depois — muda o que está sendo medido,
vira código a manter, e produz evidência que não corresponde ao que o usuário viveria.

Abra o acesso em **modo somente leitura** e mantenha assim. A homologação observa; o único que
escreve durante a bateria é o produto.

Corolário útil: se um comportamento importante **não deixa rastro** em lugar nenhum, isso é achado
por si só. Não é motivo para instrumentar — é motivo para registrar que a observabilidade tem um
buraco ali.

**Incorrect:**

```
Para conferir se a permissão foi concedida, subir um proxy no WebSocket
e contar as mensagens de decisão.
```

**Correct:**

```sql
-- O produto já grava a decisão; basta ler.
SELECT state, resolution_json, (resolved_at - created_at) AS aberto_ms
FROM permission_gates ORDER BY created_at DESC LIMIT 1;
```

```
E a linha de log correspondente, que é o que o usuário veria na tela de registros:
  "Permissão de Bash: granted após 53s (prazo 480s)"
```

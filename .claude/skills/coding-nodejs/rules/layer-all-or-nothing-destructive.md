---
title: Apply destructive batch side effects all-or-nothing before persisting status
impact: HIGH
impactDescription: partial disk failure leaves DB claiming success
tags: layer, transactions, destructive
---

## Apply destructive batch side effects all-or-nothing before persisting status

Efeito destrutivo em lote é tudo-ou-nada: aplique o efeito em disco/processo em todos os itens antes de persistir qualquer status no DB — nunca marque status e só depois arrisque falhar o efeito real no meio do loop.

**Incorrect:**

```typescript
for (const id of ids) {
  db.markDeleted(id)
  await rm(pathFor(id)) // may throw mid-loop
}
```

**Correct:**

```typescript
for (const id of ids) await rm(pathFor(id))
db.markDeletedMany(ids)
```

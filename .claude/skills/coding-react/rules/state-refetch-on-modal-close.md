---
title: Refetch derived link counts when the mutating modal closes
impact: MEDIUM
impactDescription: N:N harness counts go stale until parent entity is reselected
tags: state, modal, refetch, derived
---

## Refetch derived link counts when the mutating modal closes

Um `useEffect` que depende só da entidade pai (ex.: projeto) não reexecuta quando o modal de vínculo fecha. Extraia a busca para função reutilizável e chame também no `onClose` do modal que pode mutar o vínculo.

**Incorrect (só na troca do pai):**

```tsx
useEffect(() => {
  void loadHarnessCounts(projectId)
}, [projectId])

<LinkModal onClose={() => setOpen(false)} />
```

**Correct (refetch no close):**

```tsx
const refreshHarnessCounts = useCallback(async (id: string) => {
  setCounts(await fetchCounts(id))
}, [])

useEffect(() => {
  void refreshHarnessCounts(projectId)
}, [projectId, refreshHarnessCounts])

<LinkModal
  onClose={() => {
    setOpen(false)
    void refreshHarnessCounts(projectId)
  }}
/>
```

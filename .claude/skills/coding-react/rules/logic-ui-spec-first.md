---
title: Write or consult the screen UI spec before implementing
impact: MEDIUM
impactDescription: tokens alone do not guarantee visual fidelity
tags: logic, ui-spec, design
---

## Write or consult the screen UI spec before implementing

Antes de implementar ou corrigir uma tela, escreva/consulte o documento de anatomia + tabela de copy da feature. Tokens de design sozinhos não garantem fidelidade visual nem microcopy correta.

**Incorrect (implementar de memória):**

```tsx
// "parece com o mock" — labels inventados, hierarquia sem spec
return <h1>Login</h1>
```

**Correct (spec primeiro):**

```text
1. Abrir docs/<feature>/ui.md (anatomia + estados)
2. Abrir copy.md (labels/CTA/erros)
3. Compor via primitives alinhados à spec
4. Só então escrever o .tsx
```

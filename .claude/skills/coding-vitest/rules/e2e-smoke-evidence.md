---
title: UI acceptance criteria require written smoke evidence
impact: HIGH
impactDescription: narrative in progress docs does not replace smoke-results
tags: e2e, smoke, evidence
---

## UI acceptance criteria require written smoke evidence

Smoke E2E é obrigatório quando o critério depende de DOM, navegação, formulário ou comportamento visual. Grave evidência num `smoke-results.md` da feature citando o que foi exercitado (não só "rodou"), cobrindo temas e copy real da spec quando existirem. Narrativa em progress **não** substitui o arquivo. Não marque critério de UI como feito sem o arquivo.

**Incorrect:**

```markdown
PROGRESS: "smoke ok na sessão"  # no smoke-results.md
```

**Correct:**

```markdown
docs/<feature>/smoke-results.md
## Exercised
- Unlock → open #skills → create → link to project
- Light + dark; CTA copy matches copy.md
```

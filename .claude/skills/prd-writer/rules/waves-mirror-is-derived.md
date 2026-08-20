---
title: Espelho de ondas é derivado, e cobre também o pendente
impact: HIGH
impactDescription: Feature que só existe em texto de roadmap sai do radar e a onda mente sobre estar completa
tags: ondas, progresso, backlog
---

## Espelho de ondas é derivado, e cobre também o pendente

Quando o progresso do projeto espelha as ondas de execução do PRD, o espelho é **derivado** da
tabela de dependências — nunca uma segunda fonte de verdade que alguém edita à mão.

Duas regras que o espelho tem de respeitar:

1. **Toda feature da tabela de dependências aparece em exatamente uma linha de onda, incluindo as
   pendentes.** Feature descrita só em prosa de roadmap ("próxima frente", release gate) sai do
   radar: ninguém a encontra procurando por onda.
2. **O estado da onda reflete o status real das features nela.** Onda com qualquer pendência não é
   "Completa". Marcar completa porque a maioria terminou é como o backlog vira invisível.

A onda é **mecânica, não cronológica**: `onda(feature) = max(onda das dependências) + 1`. Uma feature
criada hoje pode pousar numa onda antiga se suas dependências forem antigas — isso não é erro de
cálculo, e o espelho deve dizer isso explicitamente para ninguém "corrigir" depois.

**Incorrect:**

```markdown
| 5 | F18, F19, F24 | Sim — independentes | **Completa** |

## Próxima frente de produto
Ainda queremos fazer F34 e F35 em algum momento.
```

F34 e F35 pertencem mecanicamente à onda 5 e sumiram dela; a onda se declara completa sem elas.

**Correct:**

```markdown
| 5 | F18, F19, F24, F34, F35 | Sim — nenhuma depende de outra da onda; F34 e F35 são adição
  posterior mas caem mecanicamente aqui (dependem só de features das ondas 3 e 4) | **Pendente** —
  F18, F19 e F24 feitas; F34 e F35 abertas |
```

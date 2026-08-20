---
title: Registro encerrado tem de dizer que encerrou
impact: HIGH
impactDescription: Auditoria fechada sem marcação vira backlog fantasma que alguém tenta trabalhar
tags: documentação, registro, staleness
---

## Registro encerrado tem de dizer que encerrou

Auditoria, investigação, migração e sprint produzem documento vivo enquanto acontecem. Quando
terminam, o documento não some — vira registro histórico. E registro histórico que continua escrito
no presente é lido como trabalho pendente.

O custo não é confusão momentânea: é alguém abrindo o arquivo semanas depois, encontrando achados
descritos em tom de "a corrigir", e gastando tempo sobre problema que já foi resolvido. Ou pior,
"corrigindo" de novo algo que mudou desde então.

Todo documento de processo encerrado carrega, no topo: **que encerrou, quando, e com que resultado**.
E, quando for o caso, que não deve ser editado.

Vale para o inverso também: documento que **não** encerrou, mas parou de ser atualizado, deve dizer
desde quando está parado. "Última revisão" só é útil quando alguém confere se ainda vale.

**Incorrect:**

```markdown
# Auditoria de código

Artefato vivo das revisões full-base. Achados abertos abaixo, por severidade.

## Achados
### RC-07 — guard() sem checagem de cofre travado
...
```

Encerrada há semanas, com todos os achados corrigidos, e ninguém que abre o arquivo sabe disso.

**Correct:**

```markdown
# Auditoria de código

> ⚠️ **Registro histórico.** Encerrada em 2026-08-17 com **zero achados abertos**. Este arquivo
> documenta o processo e os achados já corrigidos. Não editar.

## Achados
### RC-07 — guard() sem checagem de cofre travado  ✔ corrigido
...
```

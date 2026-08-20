---
name: review-docs
description: >-
  Revisa um conjunto de documentos em duas passadas — coerência estrutural (dono de assunto,
  índice, duplicação, links, órfãos de reestruturação) e depois veracidade do conteúdo, conferida
  contra código e config. Use com /review-docs, após split ou reescrita de docs, antes de release,
  ou ao suspeitar que a documentação envelheceu. Somente leitura: relata, não corrige.
---

# Review — Documentação

Revisão **somente leitura** de um conjunto documental. Observa, confere e relata; nunca edita. A
correção é decisão de quem lê o relatório.

O modo de falha da documentação madura **não é feiúra, é fato velho com cara de fato atual**. Prosa
mal escrita se percebe na leitura; registro encerrado que ainda soa como trabalho em aberto não se
percebe — ele é obedecido. Por isso esta skill não revisa estilo: ela caça afirmação que deixou de
ser verdade.

## Bindings

Raiz dos docs, conjunto sob revisão, vizinhos que o conjunto não deve duplicar e precedência de
fontes de verdade vivem em [`project.md`](project.md) — único arquivo a reescrever ao levar esta
skill para outro projeto.

## Duas passadas, nesta ordem

A ordem não é preferência: revisar o conteúdo de um documento que não deveria existir é trabalho
jogado fora.

### Passada 1 — coerência do conjunto

Responda com evidência, sempre `arquivo:linha`:

1. **Cada documento tem dono de assunto exclusivo?** Descreva o propósito de cada um em uma frase.
   Dois documentos que precisam da mesma frase são um documento só.
2. **O índice reflete o que existe?** Todo arquivo aparece no índice; todo item do índice aponta para
   arquivo existente. Liste os dois lados que não fecham.
3. **Há duplicação entre eles, ou com os vizinhos?** Onde o mesmo fato aparece em dois lugares,
   aponte qual deve ser o dono e qual deve virar link. Fato duplicado envelhece em um dos lados.
4. **Todo link relativo resolve?** Inclusive âncoras.
5. **Nada essencial ficou órfão numa reestruturação?** Se houve split recente, compare com a versão
   anterior (`git show <commit>:<arquivo>`) e liste o que sumiu sem reaparecer em lugar nenhum.
   Conteúdo perdido em split é o defeito mais comum e o menos visível.

### Passada 2 — conteúdo, documento a documento

Para **cada afirmação verificável**, confira contra a fonte de verdade e classifique:

| Classe | Significado |
|---|---|
| ✅ confere | bate com o código ou a config |
| ⚠️ desatualizado | era verdade e deixou de ser |
| ❌ falso | nunca foi verdade, ou contradiz outro doc |
| ❓ não verificável | vago demais para ter valor de verdade |

Confira com prioridade, porque é onde a documentação mente mais rápido: comandos e flags, caminhos de
arquivo, portas e variáveis de ambiente, chaves de storage, versões e faixas de compatibilidade,
nomes de função/tabela/coluna/rota, e a ordem dos passos de um processo.

## O que caçar — a parte que paga

`rules/` detalha cada um. Em resumo, procure ativamente por:

| Suspeito | Por que importa |
|---|---|
| Registro encerrado lido como trabalho em aberto | Quem lê age sobre backlog que não existe |
| Expectativa que o código mudou | **O pior:** reprova o comportamento correto na próxima execução |
| Marcação de "feito" mais forte que a evidência | Encerra a discussão sem ter provado nada |
| Referência a artefato removido | Envelhece como fato falso |
| Número que envelhece sozinho | Contagem de testes, "os 12 handlers", data de passagem |
| Arquivo que declara a própria validade | `status: fresh`, "última revisão" — confiado por construção |

## Formato da saída

1. **Veredito em uma frase por documento:** publicável como está / correção pontual / reescrita.
2. **Tabela de achados**, mais grave primeiro:

   | # | Arquivo:linha | Classe | Achado | Fonte que contradiz | Correção sugerida |

3. **Achados de conjunto** (duplicação, órfão, índice furado) em bloco separado — não cabem em linha
   de arquivo único.
4. **O que não consegui verificar, e por quê.** Explícito: silêncio aqui vira falso verde.

## Regras

- **Somente leitura.** Nenhum arquivo é alterado.
- **Toda afirmação carrega evidência** `arquivo:linha`. Sem citação, o achado não entra na tabela.
- **Não confie na prosa de outro doc como fonte** — só código, config e specs. Doc citando doc é como
  o erro se propaga.
- **Não invente o que não verificou.** "Não verificável com as ferramentas disponíveis" é resposta
  legítima e útil.
- **Não proponha reescrita de estilo.** Voz e formatação só entram se atrapalharem a compreensão ou
  contrariarem convenção já estabelecida no repo.
- **Distinga defeito de decisão.** Doc que contraria outro por escolha registrada em algum lugar é
  contexto, não achado — cite onde a decisão está registrada.

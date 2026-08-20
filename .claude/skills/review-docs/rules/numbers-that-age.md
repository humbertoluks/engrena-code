---
title: Número que envelhece sozinho vira link ou sai
impact: MEDIUM
impactDescription: Contagem congelada em prosa é lida como fato atual e desmente o documento inteiro
tags: documentação, métricas
---

## Número que envelhece sozinho vira link ou sai

Documentação atrai números que só valiam no dia em que foram escritos: "2320 testes verdes", "os 12
handlers", "cobertura de 84%", "validado em 2026-08-19". São verdadeiros na hora e viram falsos sem
que ninguém os edite.

O dano é maior que o próprio número: quando o leitor percebe **um** desatualizado, passa a
desconfiar do documento inteiro, inclusive das partes que continuam certas.

Três destinos, nessa ordem:

1. **Referência à fonte viva** — o comando que produz o número, a tela que o mostra, o arquivo que o
   mantém. "Rode `pnpm test`" envelhece muito melhor que "2320 testes".
2. **Datado explicitamente e marcado como instantâneo** — quando o valor histórico importa, o
   documento diz que é foto: "em 2026-08-19 eram 2320". Aí ninguém lê como estado atual.
3. **Fora** — quando não muda decisão nenhuma, o número é ruído com prazo de validade.

O mesmo vale para lista fechada de coisas que crescem ("os handlers são: A, B, C"): ou vira ponteiro
para onde a lista real vive, ou nasce desatualizada.

**Incorrect:**

```markdown
A suíte tem 2320 testes e cobre os 12 handlers HTTP. Última validação: 2026-08-19.
```

**Correct:**

```markdown
A suíte cobre todos os handlers HTTP (`src/services/http/*-handler.ts`); rode `pnpm test`
para o número atual.

> Instantâneo de 2026-08-19: 2320 testes, verde em duas rodadas. Registrado como evidência
> daquela homologação, não como estado corrente.
```

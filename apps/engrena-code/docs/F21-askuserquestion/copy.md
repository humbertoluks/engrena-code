# Catálogo de copy: F21-askuserquestion

**Produto:** EngrenaCode
**Fonte:** LionCodeLabs (`QuestionPrompt.tsx`) — reaproveitado só onde o slot existe aqui; o vocabulário de fila (`+N na fila`) e de múltiplas perguntas (`Responda todas as perguntas para continuar`) não tem equivalente no contrato de pergunta única do F21.
**Última atualização:** 2026-08-08

Strings literais para UI. `ui.md` e código devem usar estes textos — não reinventar.

## Convenção de ids

`askQuestion.{{slot}}`
Exemplos: `askQuestion.header`, `askQuestion.cta.send`.

## Telas

### askQuestion (card inline, `AskUserQuestionCard`)

| Id | Texto | Notas |
|----|-------|-------|
| `askQuestion.header` | O agente precisa da sua resposta | Rótulo do cabeçalho; adaptado do título do modal da fonte |
| `askQuestion.hint.single` | Escolha uma opção | Quando `multiSelect === false` |
| `askQuestion.hint.multi` | Escolha uma ou mais opções | Quando `multiSelect === true` |
| `askQuestion.freeTextPlaceholder` | Outra… | Placeholder do campo livre; PRD chama a resposta livre de "Outra" |
| `askQuestion.blocked` | Marque uma opção ou escreva uma resposta. | Hint enquanto o envio está bloqueado |
| `askQuestion.cta.send` | Enviar | |
| `askQuestion.cta.sending` | Enviando… | Enquanto o `POST /answer` está em voo |
| `askQuestion.error.generic` | Não foi possível enviar a resposta. Tente novamente. | Falha de rede ou erro inesperado |
| `askQuestion.error.notWaiting` | Esta pergunta não está mais pendente. | Os dois 409 definitivos: `thread_not_waiting` (thread saiu de `waiting_user`) e `no_pending_question` (thread ainda no estado, mas o turno que segurava a pergunta morreu). Nunca usar `error.generic` aqui — o "Tente novamente" dele manda repetir algo que não pode dar certo |

## Placeholders dinâmicos

Nenhum — todos os slots são texto fixo. O `prompt` e os rótulos de opção vêm dos parâmetros da chamada da tool, não deste catálogo.

## Slots da fonte sem equivalente aqui

| Slot da fonte | Texto | Por que não entra |
|---------------|-------|-------------------|
| `+{n} na fila` | contador de pedidos enfileirados | Contrato Engrena é uma pergunta por chamada, sem fila |
| `Responda todas as perguntas para continuar` | hint de bloqueio multi-pergunta | Só uma pergunta; hint equivalente é `askQuestion.blocked` |
| `Pronto para enviar` | hint de estado válido | Aqui o hint simplesmente some quando válido, em vez de virar texto positivo |
| `Responder` | CTA | Virou `Enviar`, alinhado ao composer do Workspace |

## Lacunas

Nenhuma. Todo slot da anatomia em `ui.md` tem string definida.

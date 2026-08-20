---
name: homologar
description: >-
  Conduz homologação ao vivo de features já implementadas: sobe o app, exercita cada critério
  contra o produto rodando, colhe evidência citável e preenche o placar do runbook. Use com
  /homologar, "rodar o roteiro", "smoke ao vivo", "validar antes de liberar", ou ao fechar
  critério de aceitação que descreve o que o usuário vê. Somente leitura sobre o código —
  encontra defeito, não conserta.
---

# Homologar

Valida o **produto rodando**, não o código. Testes provam que a lógica se comporta; esta skill prova
que o usuário consegue usar. São perguntas diferentes, e a segunda pega defeito que a primeira não vê.

> Em 2026-08-19, num repo com 2320 testes verdes e `tsc -b` limpo, o primeiro roteiro de homologação
> encontrou um estado de thread que voltava do boot corretamente mas deixava a conversa incapaz de
> receber mensagem. A suíte não pegou porque provava que o estado era *terminal* e nenhum teste
> tentava *conversar* com ele. Nenhum código estava errado do ponto de vista dos testes.

**Somente leitura sobre o código.** Esta skill observa, mede e relata. Quando encontra defeito, o
relatório nomeia causa e evidência; a correção é outra skill, outro turno, outra decisão.

## Bindings

Portas, caminho do banco, rota de unlock, header de sessão, caminho do runbook e marcador de fixture
vivem em [`project.md`](project.md) — o único arquivo a reescrever ao levar esta skill para outro
projeto.

## O laço

### 1. Preparar

- Confirme o que vai ser homologado: quais features, quais critérios, qual roteiro.
- Leia os critérios **antes** de subir o app. Critério lido depois vira confirmação do que você já viu.
- Separe cada critério em **verificável por API** ou **exige tela**. A separação decide quem executa
  o passo: você pode dirigir a API sozinho; a tela precisa de um humano olhando.
- Verifique o ambiente contra `project.md` (variáveis que não podem estar setadas, portas livres).

### 2. Subir

Suba o app como um usuário sobe — build de dev ou empacotado, conforme o roteiro. Registre a versão
e o commit: placar sem isso não vale como registro.

### 3. Exercitar

Um critério por vez. Para cada um:

- **Prove pelo positivo e pelo negativo.** Que a coisa acontece, e que a coisa que não devia
  acontecer não aconteceu. O negativo costuma valer mais — ver `rules/prove-the-negative.md`.
- **Colha evidência citável**, não impressão. Consulta ao banco, linha de log, código HTTP, contagem.
  "Funcionou" não é evidência; `COUNT(*) = 0` é.
- Critério de tela: descreva ao humano **o que exatamente esperar**, com número quando houver, para
  a resposta ser falsificável. "Confira se está certo" não é check; "o box tem de marcar 7, não 4" é.

### 4. Marcar

- `✅` só com evidência do tipo certo (`rules/evidence-matches-claim.md` em `prd-writer`).
- `❌` com a causa nomeada e o caminho para reproduzir.
- `☐` continua aberto quando não deu para verificar — **e o motivo é escrito**. Silêncio aqui vira
  falso verde, que é o defeito que a homologação existe para não cometer.
- Preencha o placar do roteiro. Um roteiro cujo placar fica em branco não homologou nada.

### 5. Limpar

Toda fixture criada sai. Todo estado alterado à mão volta. Confira órfãos. O banco do usuário termina
como começou, exceto pelo que o próprio produto escreveu durante o teste — ver `rules/fixtures-are-temporary.md`.

### 6. Registrar

Escreva o resultado num documento de evidência: o que passou, o que reprovou, **como** foi verificado,
e o que ficou aberto com o motivo. Se algum check reprovou e virou correção, o registro conta a
história inteira — inclusive por que os testes não pegaram.

## Regras

`rules/` contém o que este método pagou para aprender. Leia antes de começar:

| Regra | Quando morde |
|---|---|
| `evidence-matches-claim` (em `prd-writer/rules/`) | Ao marcar qualquer critério |
| `prove-the-negative` | Feature cujo valor é *impedir* algo |
| `terminal-state-must-be-usable` | Estado, flag ou modo "final" |
| `read-evidence-dont-instrument` | Ao decidir como observar |
| `fixtures-are-temporary` | Ao precisar de uma condição que não existe |
| `dont-edit-while-measuring` | Ao ver um defeito no meio da bateria |

## Nunca

- Marcar `✅` porque o passo anterior passou, porque o teste unitário cobre, ou porque "obviamente
  funciona".
- Corrigir código no meio da bateria (ver `dont-edit-while-measuring`).
- Matar processo por nome. Sempre por PID ou por porta.
- Deixar fixture, estado alterado ou processo de fundo para trás.
- Declarar versão aprovada com roteiro parcialmente executado, quando o critério do runbook exige
  execução completa.

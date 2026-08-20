---
title: Evidência tem de casar com o tipo da afirmação
impact: CRITICAL
impactDescription: Critério marcado com evidência do tipo errado vira falso verde no release gate
tags: aceitação, evidência, homologação
---

## Evidência tem de casar com o tipo da afirmação

Marcar um critério de aceitação como cumprido exige evidência **do mesmo tipo que a afirmação**.
Critério que descreve o que o usuário vê exige que alguém tenha visto. Teste unitário prova lógica,
não tela; teste de rota prova contrato, não percepção.

O modo de falha não é marcar errado de má-fé — é marcar de boa-fé com a evidência que estava à mão.
Um documento com todos os critérios `[x]` e nenhum deles verificado no tipo certo é pior que um
documento com critérios abertos, porque o primeiro encerra a discussão.

Quando a evidência do tipo certo não existe ainda, o critério fica aberto **e o motivo é nomeado**.
"Depende de tela, pendente de homologação" é informação; silêncio é falso verde.

Cuidado com o inverso, que também acontece: classificar como "depende de tela" algo que na verdade
é verificável por unitário. Aí a marcação fica aberta por preguiça e o defeito escapa por não ter
sido testado em lugar nenhum.

**Incorrect:**

```markdown
### F30. Avisos de runtime
- [x] Card de permissão mostra countdown `mm:ss` derivado de `expiresAt`
- [x] `#configuracao` mostra a versão parseada na row do CLI
- [x] Expiry gera tarja curta sem "negou por segurança"
```

Os três descrevem pixels. A evidência era unitária.

**Correct:**

```markdown
> Marcação: `[x]` só com evidência — teste automatizado ou smoke ao vivo registrado.

### F30. Avisos de runtime
- [x] `GET /api/config/status` permanece PATH-only, sem spawn de `--version` — teste de rota
- [ ] Card de permissão mostra countdown `mm:ss` — **depende de tela, pendente de homologação**
- [ ] `#configuracao` mostra a versão na row do CLI — **depende de tela**
```

E, depois do smoke, a marcação nomeia o que foi visto:

```markdown
- [x] Card mostra countdown `mm:ss` — conferido ao vivo, abriu em 08:00 e contou para baixo
```

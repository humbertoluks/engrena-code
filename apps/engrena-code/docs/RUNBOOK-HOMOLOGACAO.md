# EngrenaCode — Runbook de Homologação

Roteiro de validação manual do build empacotado antes de liberar uma versão. Não substitui os gates
automáticos (`tsc -b`, `vitest`): eles provam que o código compila e que a lógica se comporta; este
runbook prova que o **produto instalado** funciona na máquina de destino.

**Aplica-se a:** EngrenaCode (`apps/engrena-code`), Windows x64, features F01–F29.
**Duração:** ~40 min sem turno pago (Roteiros A, C, D) · ~75 min com turno pago (todos).
**Última revisão:** 2026-08-17.

---

## 1. Critério de aprovação

A versão é **aprovada** quando:

- Todos os checks marcados **BLOQUEIA** passam.
- Nenhum check deixa dado do usuário em estado pior do que encontrou (cofre, banco, repositórios).
- Cada falha não-bloqueante está registrada em §8 com ID, evidência e decisão (aceita / corrige antes).

Um único **BLOQUEIA** vermelho reprova a versão. Não existe aprovação parcial.

---

## 2. Pré-requisitos

| Item | Verificação |
|---|---|
| Windows 10/11 x64 | `winver` |
| Instalador gerado | `apps/engrena-code/release/*.exe` (NSIS) e/ou `release/win-unpacked/EngrenaCode.exe` |
| CLI `claude` autenticada por **assinatura** | `claude --version` responde e a conta está logada |
| Git ≥ 2.40 no PATH | `git --version` |
| Repositório de teste | pasta git com ao menos 1 commit, **caminho curto** (ex.: `D:\temp\hml`) |
| Token do GitHub (só Roteiro C) | PAT com escopo `repo` |
| Chave de voz (só C6) | OpenAI ou Groq |

**Caminho curto não é preferência.** `git worktree` falha com `fatal: '$GIT_DIR' too big` em caminhos
profundos no Windows, e o F13/F18 usam worktree. Repositório de homologação fora de `Documents`,
`OneDrive` e de qualquer árvore longa.

---

## 3. Preparação do ambiente

### 3.1 Decidir entre perfil real e perfil isolado

| Perfil | Quando usar | Como |
|---|---|---|
| **Isolado** (recomendado) | homologação de rotina | variável `ENGRENACODE_USER_DATA` apontando para pasta vazia |
| **Real** | validar migração de dados de uma versão anterior | sem variável — usa `%APPDATA%\engrena-code` |

```powershell
# perfil isolado
$env:ENGRENACODE_USER_DATA = "D:\temp\hml-userdata"
& "C:\Program Files\EngrenaCode\EngrenaCode.exe"
```

No perfil isolado o cofre nasce vazio: a **primeira** senha digitada cria o cofre. No perfil real a
senha é a do usuário — e um erro de digitação repetido aciona o backoff de tentativas.

### 3.2 Antes de começar

- [ ] Fechar qualquer instância do EngrenaCode e do `pnpm dev` (as duas disputam a porta 5174).
- [ ] Confirmar que **nada** escuta em 5174: `Get-NetTCPConnection -LocalPort 5174 -State Listen`.
- [ ] Se for perfil real, copiar `%APPDATA%\engrena-code\vault.enc` e `engrenacode.db` para backup.

**Nunca** derrube processo por nome (`Stop-Process -Name node`): isso mata Electron e Vite de outras
sessões. Sempre por porta ou PID.

---

## 4. Roteiro A — Fumaça (sem custo, sem turno)

Prova que o app instala, abre, destrava e navega. Nenhum passo aqui gasta token.

| ID | Passo | Esperado | Peso |
|---|---|---|---|
| A1 | Executar o instalador NSIS | Escolha de diretório oferecida; atalhos de Desktop e Menu Iniciar criados | BLOQUEIA |
| A2 | Olhar o ícone do `.exe` e do atalho | Ícone do EngrenaCode, não o do Electron nem quadrado preto | — |
| A3 | Abrir o app | Splash e, em seguida, a tela de destravamento | BLOQUEIA |
| A4 | Destravar com a senha | Entra no `#dashboard`; o nome do workspace aparece no topo | BLOQUEIA |
| A5 | Destravar com senha errada 3× | Recusa com mensagem clara e backoff crescente; **não** apaga nem recria o cofre | BLOQUEIA |
| A6 | Percorrer as 9 telas do menu | `#dashboard` `#principal` `#configuracao` `#subagents` `#skills` `#rules` `#mcps` `#registros` `#consumo` abrem sem tela branca | BLOQUEIA |
| A7 | Alternar tema (botão do topo) | Claro / Escuro / Sistema aplicam na hora e sobrevivem ao restart | — |
| A8 | Conferir o catálogo semente | `#skills` com 12 skills e `#subagents` com 8 subagents no perfil novo | — |
| A9 | Adicionar o repositório de teste em `#principal` | Projeto aparece na barra lateral com o nome da pasta | BLOQUEIA |
| A10 | Fechar e reabrir o app | Cofre volta travado; depois de destravar, o projeto continua lá | BLOQUEIA |

**Evidência de A5:** o cofre corrompido responde diferente de senha errada (`vault_corrupted`). Se
aparecer mensagem de cofre danificado com a senha certa, é reprovação imediata — pare e restaure o backup.

---

## 5. Roteiro B — Turno real (com custo)

Gasta cota da assinatura. Só depois do Roteiro A verde.

**Antes de abrir o app:** confirmar que `ANTHROPIC_API_KEY` **não** está no ambiente. Com ela setada, o
processo filho `claude` autentica por API key em vez da assinatura já logada, e o consumo vai para a
conta errada (às vezes com saldo zero).

| ID | Passo | Esperado | Peso |
|---|---|---|---|
| B1 | Nova thread no projeto, access **Supervised**, pedir a leitura de um arquivo | Indicador de atividade aparece; o rótulo acompanha a ferramenta corrente | BLOQUEIA |
| B2 | Durante o turno, olhar o Work log | Cada ferramenta aparece com início e fim | — |
| B3 | Pedir uma **escrita** em arquivo | Card de permissão inline na timeline, com as opções | BLOQUEIA |
| B4 | Clicar em "Permitir" | O clique **preenche o composer**; a concessão só acontece no Enviar | BLOQUEIA |
| B5 | Enviar | Ferramenta executa; o diff aparece na aba Diff | BLOQUEIA |
| B6 | Aceitar o diff | Arquivo alterado no repositório; entrada em `#registros` | BLOQUEIA |
| B7 | Rejeitar um segundo diff | Arquivo volta ao estado anterior | BLOQUEIA |
| B8 | Responder um follow-up ("sim") na mesma thread | O agente entende o contexto (usa `--resume`), não pergunta "qual tarefa?" | BLOQUEIA |
| B9 | Disparar turno longo e clicar em **Parar** | Ferramenta cancelada em segundos, processo morto, thread assentada em `cancelled` | BLOQUEIA |
| B10 | Enviar durante turno em execução | Mensagem entra na fila e roda no turno seguinte | — |
| B11 | Trocar access para **Auto-accept edits** e pedir edição | Edição passa direto; Bash ainda abre card | — |
| B12 | Usar "Permitir todos" numa ferramenta | Próxima chamada da mesma ferramenta não pergunta mais nesta thread | — |
| B13 | Abrir a aba **Grafo** durante uma delegação | Nó do subagente com ferramenta corrente e contador subindo | — |
| B14 | Conferir `#consumo` | Turnos aparecem com custo; `cost_source` coerente com assinatura | BLOQUEIA |

**B4 é contrato de produto, não detalhe.** Se o clique no card conceder sozinho, é reprovação: a decisão
tem de passar pelo Enviar.

---

## 6. Roteiro C — Governança, segredos e integrações

| ID | Passo | Esperado | Peso |
|---|---|---|---|
| C1 | `#configuracao` → salvar token do GitHub | Salvo no cofre; status vira conectado | BLOQUEIA |
| C2 | Commit + push + PR pelo painel de Git | PR criado; título e corpo editáveis antes de enviar | BLOQUEIA |
| C3 | Forçar erro de push (token inválido) | Mensagem **sem** o segredo em claro — nada de `x-access-token:ghp_...` na tela | BLOQUEIA |
| C4 | `#rules` → criar rule e vincular ao projeto | Rule entra no turno seguinte (o agente obedece) | — |
| C5 | Criar modo de chat com filtro de skills/rules | Só o que o modo lista chega ao turno; o resto não | — |
| C6 | Ditado por voz no composer | Áudio vira texto no cursor (exige chave OpenAI/Groq) | — |
| C7 | `#mcps` → instalar preset sem segredo | Server aparece e conecta | — |
| C8 | `#registros` → filtrar por tipo | Entradas de tool, git e task aparecem com filtro funcionando | — |
| C9 | `#consumo` → definir limite e estourar | Faixa de aviso em 80% e bloqueio de turno em 100% | BLOQUEIA |
| C10 | Terminal no dock | Abre shell real, aceita comando, fecha sem deixar processo órfão | — |

**C3 é de segurança.** Qualquer segredo visível em mensagem de erro reprova a versão, mesmo que todo o
resto passe.

---

## 7. Roteiro D — Resiliência

| ID | Passo | Esperado | Peso |
|---|---|---|---|
| D1 | Matar o app durante um turno e reabrir | Thread presa em `running` é reconciliada para `error` com motivo em `#registros` | BLOQUEIA |
| D2 | Derrubar o WebSocket (fechar/reabrir a janela) | Ao voltar, o composer reflete o estado real do backend — sem ficar preso em "Executando…" | BLOQUEIA |
| D3 | Execução em **Worktree** | Turno roda em worktree separada; o repositório principal não é tocado até o aceite | BLOQUEIA |
| D4 | Delegar a 2+ subagentes em paralelo no mesmo arquivo | Diff nasce em `conflict` com um candidato por filho | — |
| D5 | Apagar a pasta da worktree vencedora e tentar resolver o conflito | Recusa com "worktree não existe mais"; arquivo do pai **intacto** e conflito ainda resolvível | BLOQUEIA |
| D6 | Abrir 2 threads no mesmo projeto e disparar as duas | A segunda recusa com `thread_busy` (lease de projeto), sem corromper estado | BLOQUEIA |
| D7 | Criar `.engrena/modes/x.chatmode.md` com o projeto já aberto | Abrir o picker de modo mostra o arquivo, sem precisar trocar de projeto | — |

---

## 8. Registro do resultado

Preencher a cada rodada e anexar ao PR de release.

```
Versão empacotada:  ______   Commit: ______   Data: ______
Perfil usado:       ( ) isolado  ( ) real
Executado por:      ______

Roteiro A: __/10    Roteiro B: __/14    Roteiro C: __/10    Roteiro D: __/7

Falhas:
| ID | O que aconteceu | Evidência (print/log/linha do banco) | Decisão |
|----|-----------------|--------------------------------------|---------|
|    |                 |                                      |         |

Veredito: ( ) APROVADA   ( ) REPROVADA
```

**Evidência barata:** em vez de instrumentar a UI, ler o banco direto. `%APPDATA%\engrena-code\engrenacode.db`
(ou o `ENGRENACODE_USER_DATA` do perfil isolado) com `node:sqlite`: `log_entries` mostra hook e gate,
`subagent_runs` mostra `action_count` e status, `diffs` mostra status e candidatos.

---

## 9. Rollback

1. Fechar o app.
2. Desinstalar pelo Painel de Controle (o instalador é `perMachine: false`, então é por usuário).
3. Reinstalar a versão anterior.
4. **Não apagar** `%APPDATA%\engrena-code`: cofre e banco são do usuário, não do instalador. Se a
   versão nova migrou o banco, restaurar o backup de §3.2 antes de abrir a antiga.

Migração é o único caminho sem volta automática. Por isso o backup de §3.2 não é opcional em perfil real.

---

## 10. Limitações conhecidas (não reprovam)

| Item | Situação |
|---|---|
| Gravação real de voz (F27) | Mecanismo coberto por unitário; transcrição real contra OpenAI/Groq depende de credencial de teste |
| Turno pago com modo editado pela UI (F28) | O filtro é resolvido antes do CLI e está provado por unitário + API; o turno pago não acrescentaria informação |
| Providers Codex/Kimi/MiniMax/GLM/Grok | Caminho implementado e testado; homologação de rotina exercita só `claude` |

---

## 11. Armadilhas do ambiente

Erros que já custaram tempo e não são defeito do produto:

- **Duas instâncias na 5174.** Uma em `127.0.0.1` e outra em `::1` convivem e produzem 401 e listas
  vazias. Confira a porta antes de começar.
- **`pnpm dev` aberto durante o `pnpm build`.** O empacotamento falha com EPERM ao renomear
  `release/win-unpacked`. Feche o app antes.
- **Sem rede no `electron-builder`.** O primeiro empacotamento baixa o Electron e recursos do NSIS do
  GitHub; sem DNS a tarefa falha em `getaddrinfo`, mesmo com `tsc` e `vite build` verdes.
- **`ANTHROPIC_API_KEY` no ambiente.** Desvia o faturamento da assinatura para a API key. Ver §5.
- **Caminho longo no repositório de teste.** Quebra `git worktree` (F13/F18). Ver §2.

---

## Referências

- Status por feature: [`PROGRESS.md`](./PROGRESS.md)
- Critérios de aceitação: [`PRD.md`](./PRD.md) §9
- Achados de revisão: [`AUDIT-CODE-REVIEW.md`](./AUDIT-CODE-REVIEW.md)
- Evidência de cada feature: `docs/F0*/smoke-results.md` (29 arquivos)
- Setup de desenvolvimento: [`DEVELOPMENT.md`](./DEVELOPMENT.md)

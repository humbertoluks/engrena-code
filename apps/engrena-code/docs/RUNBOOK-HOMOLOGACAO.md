# EngrenaCode — Runbook de Homologação

Roteiro de validação manual do build empacotado antes de liberar uma versão. Não substitui os gates
automáticos (`tsc -b`, `vitest`): eles provam que o código compila e que a lógica se comporta; este
runbook prova que o **produto instalado** funciona na máquina de destino.

**Aplica-se a:** EngrenaCode (`apps/engrena-code`), Windows x64, features F01–F29.
**Duração:** ~40 min sem turno pago (Roteiros A, C, D) · ~75 min com turno pago (todos).
**Última revisão:** 2026-08-17.

> **Como marcar.** As listas de preparação (§3.2) são checkbox de clique. Nos roteiros a marcação é na
> coluna **✔**: troque `☐` por **`✅`** (passou) ou **`❌`** (falhou) — dentro de tabela o markdown não
> renderiza checkbox clicável, então ali a marca é digitada.
>
> Todo `❌` vira uma linha em §8 com a evidência. `❌` em check **BLOQUEIA** reprova a versão na hora:
> pare o roteiro, registre e devolva para correção.
>
> Copie este arquivo para `docs/homologacao/<versão>.md` antes de preencher, para o template no repo
> ficar sempre em branco.

---

## 1. Critério de aprovação

A versão é **aprovada** quando:

- Todos os checks marcados **BLOQUEIA** estão `✅`.
- Nenhum check deixou dado do usuário em estado pior do que encontrou (cofre, banco, repositórios).
- Cada `❌` não-bloqueante está registrado em §8 com evidência e decisão (aceita / corrige antes).

Um único **BLOQUEIA** em `❌` reprova a versão. Não existe aprovação parcial.

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

**Montar o repositório de teste em 30 segundos:**

```powershell
mkdir D:\temp\hml; cd D:\temp\hml
git init
"# HML" | Out-File README.md -Encoding utf8
git add -A; git commit -m "chore: commit inicial"
```

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
- [ ] Confirmar que `ANTHROPIC_API_KEY` não está no ambiente: `echo $env:ANTHROPIC_API_KEY` sai vazio.
- [ ] Se for perfil real, copiar `%APPDATA%\engrena-code\vault.enc` e `engrenacode.db` para backup.
- [ ] Montar o repositório de teste de §2 e anotar o caminho.

**Nunca** derrube processo por nome (`Stop-Process -Name node`): isso mata Electron e Vite de outras
sessões. Sempre por porta ou PID.

---

## 4. Roteiro A — Fumaça (sem custo, sem turno)

Prova que o app instala, abre, destrava e navega. Nenhum passo aqui gasta token.

| ✔ | ID | Passo | Esperado |
|---|---|---|---|
| ✅ | **A1** · BLOQUEIA | Executar o instalador NSIS | Escolha de diretório oferecida; atalhos de Desktop e Menu Iniciar criados |
| | | *Exemplo:* duplo clique em `EngrenaCode Setup 0.0.0.exe` → instala por usuário, sem pedir admin | |
| ✅ | **A2** | Olhar o ícone do `.exe` e do atalho | Ícone do EngrenaCode, não o do Electron nem quadrado preto |
| | | *Exemplo:* se sair preto, limpar o cache do Explorer (`ie4uinit.exe -show`) antes de reprovar | |
| ✅ | **A3** · BLOQUEIA | Abrir o app | Splash e, em seguida, a tela de destravamento |
| ✅ | **A4** · BLOQUEIA | Destravar com a senha | Entra no `#dashboard`; o nome do workspace aparece no topo |
| | | *Exemplo:* Workspace `hml` + senha do cofre → topo mostra `hml` ao lado do seletor de tema | |
| ✅ | **A5** · BLOQUEIA | Destravar com senha errada 3× | Recusa com mensagem clara e backoff crescente; **não** apaga nem recria o cofre |
| | | *Exemplo:* digitar `errado1`, `errado2`, `errado3`; depois a senha certa ainda tem de entrar | |
| ✅ | **A6** · BLOQUEIA | Percorrer as 9 telas do menu | `#dashboard` `#principal` `#configuracao` `#subagents` `#skills` `#rules` `#mcps` `#registros` `#consumo` abrem sem tela branca |
| ✅ | **A7** | Alternar tema pelo botão do topo | Claro / Escuro / Sistema aplicam na hora e sobrevivem ao restart |
| | | *Exemplo:* deixar em Claro, fechar e reabrir o app; tem de voltar em Claro | |
| ✅ | **A8** | Conferir o catálogo semente | `#skills` com 12 skills e `#subagents` com 8 subagents no perfil novo |
| | | *Exemplo:* entre as 12 devem estar `code-review`, `write-tests`, `commit-message` | |
| ☐ | **A9** · BLOQUEIA | Adicionar o repositório de teste em `#principal` | Projeto aparece na barra lateral com o nome da pasta |
| | | *Exemplo:* botão **Adicionar projeto** → escolher `D:\temp\hml` → card `hml` na lista, com **Nova thread** e **Remover projeto** ao passar o mouse | |
| ☐ | **A10** · BLOQUEIA | Fechar e reabrir o app | Cofre volta travado; depois de destravar, o projeto continua lá |
| | | *Exemplo:* o card `hml` tem de reaparecer sem precisar adicionar de novo | |

**Evidência de A5:** o cofre corrompido responde diferente de senha errada (`vault_corrupted`). Se
aparecer mensagem de cofre danificado com a senha certa, é reprovação imediata — pare e restaure o backup.

---

## 5. Roteiro B — Turno real (com custo)

Gasta cota da assinatura. Só depois do Roteiro A verde.

**Antes de abrir o app:** confirmar que `ANTHROPIC_API_KEY` **não** está no ambiente. Com ela setada, o
processo filho `claude` autentica por API key em vez da assinatura já logada, e o consumo vai para a
conta errada (às vezes com saldo zero).

| ✔ | ID | Passo | Esperado |
|---|---|---|---|
| ☐ | **B1** · BLOQUEIA | Nova thread no projeto, access **Supervised**, pedir a leitura de um arquivo | Indicador de atividade aparece; o rótulo acompanha a ferramenta corrente |
| | | *Exemplo de prompt:* `Leia o README.md e resuma em 3 linhas.` | |
| ☐ | **B2** | Durante o turno, abrir o Work log | Cada ferramenta aparece com início e fim |
| | | *Exemplo:* para o prompt de B1, ao menos um `Read` do `README.md` | |
| ☐ | **B3** · BLOQUEIA | Pedir uma **escrita** em arquivo | Card de permissão inline na timeline, com as opções |
| | | *Exemplo de prompt:* `Crie o arquivo hml.txt com a palavra homologado.` | |
| ☐ | **B4** · BLOQUEIA | Clicar em "Permitir" no card | O clique **preenche o composer** e nada mais; a concessão só acontece no Enviar |
| | | *Exemplo:* depois do clique, o composer mostra o texto da opção e o arquivo ainda **não** existe no disco | |
| ☐ | **B5** · BLOQUEIA | Enviar | Ferramenta executa; o diff aparece na aba **Diff** |
| | | *Exemplo:* `hml.txt` listado com 1 adição | |
| ☐ | **B6** · BLOQUEIA | Aceitar o diff | Arquivo alterado no repositório; entrada em `#registros` |
| | | *Exemplo:* `Get-Content D:\temp\hml\hml.txt` devolve `homologado` | |
| ☐ | **B7** · BLOQUEIA | Rejeitar um segundo diff | Arquivo volta ao estado anterior |
| | | *Exemplo de prompt:* `Acrescente uma segunda linha em hml.txt.` — depois do rejeitar, `git status` fica limpo | |
| ☐ | **B8** · BLOQUEIA | Responder um follow-up na mesma thread | O agente entende o contexto (usa `--resume`), não pergunta "qual tarefa?" |
| | | *Exemplo:* fazer o agente perguntar `Quer que eu apague o arquivo?` e responder só `sim` — ele tem de saber qual arquivo | |
| ☐ | **B9** · BLOQUEIA | Disparar turno longo e clicar em **Parar** | Ferramenta cancelada em segundos, processo morto, thread assentada em `cancelled` |
| | | *Exemplo de prompt:* `Rode python -m http.server 8931 no terminal.` — bloqueia em foreground; depois do Parar a porta 8931 tem de ficar livre | |
| ☐ | **B10** | Enviar durante turno em execução | Mensagem entra na fila e roda no turno seguinte |
| | | *Exemplo:* o composer mostra **Parar** e **Enviar** juntos, e a fila aparece com "1 na fila" | |
| ☐ | **B11** | Trocar access para **Auto-accept edits** e pedir edição | Edição passa direto; Bash ainda abre card |
| | | *Exemplo de prompt:* `Troque a palavra homologado por aprovado em hml.txt e depois rode git status.` | |
| ☐ | **B12** | Usar "Permitir todos" numa ferramenta | Próxima chamada da mesma ferramenta não pergunta mais **nesta** thread |
| | | *Exemplo:* conceder em um `Bash`, pedir outro `Bash` e ver que não abre card | |
| ☐ | **B13** | Abrir a aba **Grafo** durante uma delegação | Nó do subagente com ferramenta corrente e contador subindo |
| | | *Exemplo de prompt:* `Delegue ao subagente explorer um mapa das pastas do projeto.` | |
| ☐ | **B14** · BLOQUEIA | Conferir `#consumo` | Turnos aparecem com custo; origem coerente com assinatura |
| | | *Exemplo:* os turnos de B1–B9 somam valor > 0 e o projeto `hml` aparece na lista | |

**B4 é contrato de produto, não detalhe.** Se o clique no card conceder sozinho, é `❌` bloqueante: a
decisão tem de passar pelo Enviar.

---

## 6. Roteiro C — Governança, segredos e integrações

| ✔ | ID | Passo | Esperado |
|---|---|---|---|
| ☐ | **C1** · BLOQUEIA | `#configuracao` → salvar token do GitHub | Salvo no cofre; status vira conectado |
| | | *Exemplo:* depois de salvar, o card de saúde no `#dashboard` mostra GitHub em verde | |
| ☐ | **C2** · BLOQUEIA | Commit + push + PR pelo painel de Git | PR criado; título e corpo editáveis antes de enviar |
| | | *Exemplo:* usar um repositório de teste **seu** no GitHub como `origin`; o PR abre em branch nova, nunca na default | |
| ☐ | **C3** · BLOQUEIA | Forçar erro de push com token inválido | Mensagem **sem** o segredo em claro |
| | | *Exemplo:* salvar o token `ghp_invalido123` e tentar push — a mensagem não pode conter `x-access-token:ghp_...`; o esperado é `***@github.com/...` | |
| ☐ | **C4** | `#rules` → criar rule e vincular ao projeto | Rule entra no turno seguinte e o agente obedece |
| | | *Exemplo:* rule `so-ingles` com "Responda sempre em inglês"; perguntar em português e a resposta tem de vir em inglês | |
| ☐ | **C5** | Criar modo de chat com filtro de skills/rules | Só o que o modo lista chega ao turno; o resto não |
| | | *Exemplo:* no picker **Modo**, desmarcar tudo menos `code-review`, salvar como `revisor`, e pedir `Liste as skills disponíveis` — só `code-review` deve ser anunciada | |
| ☐ | **C6** | Ditado por voz no composer | Áudio vira texto no cursor (exige chave OpenAI/Groq) |
| | | *Exemplo:* botão 🎙️, falar uma frase curta, parar — o texto entra no ponto do cursor, sem apagar o que já estava escrito | |
| ☐ | **C7** | `#mcps` → instalar preset sem segredo | Server aparece e conecta |
| | | *Exemplo:* preset `filesystem`, que não pede credencial | |
| ☐ | **C8** | `#registros` → filtrar por tipo | Entradas de tool, git e task aparecem com o filtro funcionando |
| | | *Exemplo:* o `Commit` de C2 e os `Read`/`Write` de B1–B6 têm de estar lá | |
| ☐ | **C9** · BLOQUEIA | `#consumo` → definir limite e estourar | Faixa de aviso em 80% e bloqueio de turno em 100% |
| | | *Exemplo:* com consumo já > 0, definir o limite abaixo do gasto atual e tentar novo turno — tem de recusar com link para ajustar | |
| ☐ | **C10** | Terminal no dock | Abre shell real, aceita comando, fecha sem deixar processo órfão |
| | | *Exemplo:* botão **Terminal** → `git status` → fechar a aba → nenhum `pwsh`/`cmd` órfão no Gerenciador de Tarefas | |

**C3 é de segurança.** Qualquer segredo visível em mensagem de erro reprova a versão, mesmo que todo o
resto passe.

---

## 7. Roteiro D — Resiliência

| ✔ | ID | Passo | Esperado |
|---|---|---|---|
| ☐ | **D1** · BLOQUEIA | Matar o app durante um turno e reabrir | Thread presa em `running` é reconciliada para `error` com motivo em `#registros` |
| | | *Exemplo:* disparar o prompt longo de B9 e matar o processo por PID no meio | |
| ☐ | **D2** · BLOQUEIA | Derrubar o WebSocket | Ao voltar, o composer reflete o estado real do backend — sem ficar preso em "Executando…" |
| | | *Exemplo:* com a thread ociosa, fechar e reabrir a janela; o composer tem de mostrar **Enviar**, não **Parar** | |
| ☐ | **D3** · BLOQUEIA | Execução em **Worktree** | Turno roda em worktree separada; o repositório principal não é tocado até o aceite |
| | | *Exemplo:* thread nova com execution **Worktree**, pedir uma escrita e rodar `git worktree list` — a pasta principal continua sem a alteração | |
| ☐ | **D4** | Delegar a 2+ subagentes em paralelo no mesmo arquivo | Diff nasce em `conflict`, com um candidato por filho |
| | | *Exemplo:* usar dois subagentes que **escrevem** — agente read-only recusa a escrita e o conflito nunca acontece (não é defeito) | |
| ☐ | **D5** · BLOQUEIA | Apagar a worktree vencedora e tentar resolver o conflito | Recusa com "worktree não existe mais"; arquivo do pai **intacto** e conflito ainda resolvível |
| | | *Exemplo:* `Remove-Item -Recurse -Force <worktree do filho>` e então escolher esse filho como vencedor | |
| ☐ | **D6** · BLOQUEIA | Abrir 2 threads no mesmo projeto e disparar as duas | A segunda recusa com `thread_busy` (lease de projeto), sem corromper estado |
| ☐ | **D7** | Criar `.engrena/modes/x.chatmode.md` com o projeto já aberto | Abrir o picker de modo mostra o arquivo, sem precisar trocar de projeto |
| | | *Exemplo:* frontmatter `model: haiku` e corpo `Só revise.` → aparece como `x (do repositório)`, sem ✎ nem × (arquivo do repo é somente leitura) | |

---

## 8. Registro do resultado

Preencher a cada rodada e anexar ao PR de release.

```
Versão empacotada:  ______   Commit: ______   Data: ______
Executado por:      ______

Roteiro A: __/10    Roteiro B: __/14    Roteiro C: __/10    Roteiro D: __/7
```

Perfil usado:

- [ ] isolado (`ENGRENACODE_USER_DATA`)
- [ ] real (`%APPDATA%\engrena-code`)

Falhas — uma linha por `❌`:

| ID | O que aconteceu | Evidência (print/log/linha do banco) | BLOQUEIA? | Decisão |
|---|---|---|---|---|
| | | | | |

Veredito:

- [ ] APROVADA
- [ ] REPROVADA

**Evidência barata:** em vez de instrumentar a UI, ler o banco direto.
`%APPDATA%\engrena-code\engrenacode.db` (ou o `ENGRENACODE_USER_DATA` do perfil isolado) com
`node:sqlite`: `log_entries` mostra hook e gate, `subagent_runs` mostra `action_count` e status,
`diffs` mostra status e candidatos.

```powershell
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.ENGRENACODE_USER_DATA+'/engrenacode.db');console.log(db.prepare('SELECT kind,message FROM log_entries ORDER BY created_at DESC LIMIT 10').all())"
```

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

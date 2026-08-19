# Smoke ao vivo — F30 a F35 (Versões 1.4 e 1.5)

**Data:** 2026-08-19
**Build:** `pnpm dev` (Electron real), Vite 5173, unlock/API/WS em `127.0.0.1:5174`
**Ambiente:** userData real do usuário (`%APPDATA%/engrena-code`), projeto `HomologacaoEngrena`
**Método:** o usuário opera a janela; a evidência é lida direto do `engrenacode.db` em modo
read-only, sem instrumentar WebSocket nem DOM.

`ANTHROPIC_API_KEY` foi removida do ambiente antes de subir o app (`env -u`), para o `claude` filho
autenticar pela sessão de assinatura e não por API key.

---

## Resultado

| Feature | Veredito | Evidência |
|---|---|---|
| F32 — prazo do card | ✅ passou | banco + log |
| F33 — histórico paginado | ✅ passou | visual + fixture de 74 mensagens |
| F34 — rascunho persistente | ✅ passou | visual |
| F35 — thread interrompida | ✅ passou **na segunda tentativa** | banco + log; primeira rodada achou defeito |
| F30 — avisos de runtime | ✅ passou | API de config + log do turno |
| F31 — shell em auto-accept | ✅ passou | log de auto-aprovação + zero gates; borda conferida |

Roteiro E do `RUNBOOK-HOMOLOGACAO.md` fechou **10/12** nesta rodada; os dois abertos (caption em
`#configuracao` e inbox do Dashboard) estão nomeados lá com o motivo.

---

## F32 — prazo do pedido de permissão

Turno em `supervised` pedindo `git status`. O card abriu marcando **08:00** (relatado pelo usuário
em 7:52, contando para baixo).

O banco mostra o antes e o depois na mesma consulta — mesma tool, mesma máquina:

| Gate | `expires_at - created_at` | Estado |
|---|---|---|
| deste smoke (`Bash`) | **480000 ms** | `resolved` |
| homologação de 18/08 (`Bash`) | 120000 ms | **`expired`** ← o que morreu por timeout |
| homologação de 18/08 (`Bash`) | 120000 ms | `resolved` |

Após o clique em Permitir:

```
Permissão de Bash: granted após 53s (prazo 480s, motivo user_decision).
```

`thread_gates.resolved_at - created_at = 52648` — bate com os 53 s do log. O `payload` (que é o
`tool_input`, com o comando dentro) **não** aparece no registro. O turno seguiu: `Bash (completed)`
logo em seguida.

## F33 — histórico de chat paginado

A thread real tinha 8 mensagens, insuficiente para a janela de 60 paginar. Com autorização explícita
do usuário, foi inserida no banco uma thread de fixture com **74 mensagens numeradas**
(`[fixture F33 — remover] conversa longa`, `seq` 0–73). Nenhuma linha existente foi alterada.

Conferido na tela:

- abertura mostra o fim da conversa, "Mensagem 74 de 74"
- topo traz **"Carregar mensagens anteriores"**, não o marcador de início
- mensagem mais antiga da janela é a **15 de 74** (`seq` 14–73 — a janela de 60 está sendo aplicada)
- o clique prepende as 14 restantes, o botão sai e entra **"Início da conversa"**
- **o scroll não salta**: a mensagem que estava no topo permanece na mesma posição visual

Conferido também na thread real, e este era o ponto de maior risco: **o Work log abre com o
resultado dentro**. A listagem passou a mandar `resultPreview` no lugar de `result`, e um erro nessa
ligação abriria o work log vazio, sem erro em tela nenhum.

## F34 — rascunho persistente do composer

Conferido na tela: texto não enviado e chip de anexo voltam depois de `Ctrl+R`; rascunhos de duas
threads não se misturam; imagem colada não é persistida e a linha muted informa quantas se
perderam, sumindo ao primeiro toque no campo.

## F35 — estado honesto de thread interrompida

### Primeira rodada — reprovou, e achou defeito real

Turno disparado e o processo main do Electron morto **por PID** (nunca por nome) enquanto a thread
estava viva. Ela morreu em `waiting_permission`, com um gate `open` — o caso mais exigente, porque
exercita a ordem "fechar gate antes de mexer no estado".

O backend fez tudo certo no unlock seguinte:

```
state = interrupted
gate  = expired, {"allow":false,"reason":"app_restarted"}     ← fail-closed, nunca allow
log   = "Aplicação reiniciada durante a execução. A thread estava esperando decisão de permissão."
```

Mas **a thread não aceitava mais nenhuma mensagem**. O composer devolvia *"Esta thread ainda tem um
turno em andamento; aguarde ou pare o turno atual."* e não havia botão de Parar, porque não havia
turno.

**Causa raiz:** `interrupted` entrou na união `ThreadState`, em `SETTLED_THREAD_STATES` do renderer e
na recuperação de boot, mas ficou de fora de `SETTLED_STATES` em `turn-state.ts` — a terceira lista.
`follow_up` só é legal a partir dela, então o dispatch rejeitava com `thread_busy`. A thread ficava
permanentemente muda: **pior que o `error` que a F35 veio substituir**, porque com `error` ela ainda
aceitava mensagem.

Por que a suíte não pegou: os testes provavam que `interrupted` era **terminal** (nos conjuntos, na
recuperação, na idempotência) e nenhum tentava **conversar** com uma thread interrompida. O critério
do PRD que descreve exatamente isso estava classificado como "depende de tela" — não era; era tabela
de transição no backend, e um unitário de três linhas teria pego.

### Correção

`interrupted` entrou em `SETTLED_STATES`. Além do caso, a classe foi fechada: `TURN_STATE_BUCKETS`
particiona a união inteira (vivo / assentado / transitório) e um teste cobra que a partição é exata,
então estado novo sem classificação quebra a suíte em vez de virar `thread_busy` em produção. Outro
teste cobra que **todo** estado assentado aceita `follow_up`.

### Segunda rodada — passou

Com o app reiniciado: badge muted na sidebar, separador de interrupção na timeline, composer normal,
e o envio funcionou — a thread percorreu `interrupted → running → waiting_permission`, ou seja,
voltou a rodar de verdade e abriu card novo.

---

## Pendências

- A thread de fixture da F33 continua no banco, marcada `[fixture F33 — remover]`. Remover quando
  não for mais útil.
- O `RUNBOOK-HOMOLOGACAO.md` ainda não tem roteiro para F30–F35; este documento é o registro do que
  foi conferido, não substitui o check no runbook.
- F30 e F31 seguem **sem smoke ao vivo**.

---

## F30 — avisos de runtime e permissão

O CLI da máquina é **2.1.234** e a faixa validada do contrato é 2.1.226–2.1.231, então a condição do
smoke é `above-max` — exatamente o caso que a feature existe para tratar sem alarmar.

A distinção que a F30 introduziu, conferida pelas três chamadas:

| Chamada | `version` | Spawn de `--version` |
|---|---|---|
| `GET /api/config/status` (cache frio) | ausente | **não** |
| `POST /api/config/clis/test` ("Testar conexões") | `2.1.234` / `above-max` | sim |
| `GET /api/config/status` (cache quente) | `2.1.234` / `above-max` | **não** (`peekClaudeCliVersion`) |

A rota que alimenta o Dashboard nunca paga o spawn de até 5 s, e a diferença entre "cache frio" e
"sem versão" fica preservada.

No turno, a linha técnica foi para `log_entries` e **não** para a tarja do chat:

```
Claude CLI 2.1.234 está acima da faixa 2.1.226 a 2.1.231 em que o contrato de permissão
foi validado. Aviso apenas, o turno não foi bloqueado.
```

O turno rodou até `idle`. Não há como o aviso aparecer no chat: a variante `cli.version_notice` foi
removida do union do `ws-hub`, então não existe emissor.

**Não conferido em tela:** a caption na row do Claude em `#configuracao` (E2 do roteiro).

## F31 — shell de edição e leitura em auto-accept

Turno em `auto-accept-edits` pedindo três comandos de shell, um por chamada. As três executaram e
**nenhum card abriu** — `SELECT COUNT(*) FROM thread_gates WHERE thread_id = …` devolveu `0`.

| Comando | Registro |
|---|---|
| `mkdir smoke-f31` | `Auto-accept edits escreveu sem card: mkdir em …\HomologacaoEngrena\smoke-f31 (raiz …\HomologacaoEngrena).` |
| `ls -la` | `Auto-accept edits leu sem card: ls no diretório do turno (raiz …\HomologacaoEngrena).` |
| `head teste.txt` | `Auto-accept edits leu sem card: head em …\HomologacaoEngrena\teste.txt (raiz …\HomologacaoEngrena).` |

A borda foi conferida pelo lado negativo, que é o que importa numa feature de permissão: com o mesmo
nível, `cat ../fora-do-projeto.txt` **abriu card** em vez de passar, e a negação registrou
`Permissão de Bash: denied após 27s (prazo 480s, motivo user_decision).`

### Defeito de copy achado aqui

A linha do `ls` saía como *"leu sem card: ls **em o** diretório do turno"*: a preposição estava fixa
no template e a alternativa sem caminho já vinha com artigo. Registros é superfície que o usuário lê,
então virou correção mais teste (`permission-broker.test.ts`), não só ajuste de texto.

---

## Notas de método

- **Editar arquivo do processo main durante o smoke reinicia o Electron e trava o cofre de novo.** O
  cofre vive em memória; o vite reconstrói e reinicia o main a cada mudança em `src/services/**`, e a
  próxima chamada de API responde `423 vault_locked`. Destravar outra vez resolve, mas convém não
  editar código do main no meio de uma bateria.
- O cofre foi destravado por `POST /api/vault/unlock` (`workspace` só chaveia o backoff) e os turnos
  foram disparados pela API com `x-engrenacode-session`, sem tocar na janela — exceto os checks que
  são visuais por natureza.
- Resíduos removidos ao fim: a thread de fixture da F33 (com as mensagens e tool calls artificiais) e
  o diretório `smoke-f31` criado no projeto de homologação.

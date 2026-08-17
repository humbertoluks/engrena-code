# F28 — Paridade de chat com o Copilot Chat: smoke

Referência upstream (MIT): clone raso de `microsoft/vscode` em `C:\Users\Me\Code\repos\github\microsoft\vscode`
(sparse: `extensions/copilot` + `src/vs/workbench/contrib/chat`).

---

## Onda 1 — contexto no composer (2026-08-11)

**Ambiente:** `pnpm dev` (Electron real, `dangerouslyDisableSandbox`) + `playwright-cli` em `http://localhost:5173`;
`ENGRENACODE_USER_DATA` isolado em `%TEMP%\engrenacode_onda1_smoke`; `ANTHROPIC_API_KEY` unset.
Projeto `projeto de smoke` com `marcador.ts` contendo `MARCADOR_SMOKE = "engrena-onda1-7788"`.
Provider Claude, modelo `claude-haiku-4-5`, access `Full access`.

| # | Cenário | Esperado | Resultado |
|---|---------|----------|-----------|
| 1 | Abrir arquivo no viewer | chip implícito no composer | **pass** — `📄 marcador.ts ×` |
| 2 | Fechar o viewer | chip implícito some | **pass** — tira vazia |
| 3 | Arrastar arquivo da árvore para o composer | vira chip explícito | **pass** |
| 4 | Colar imagem (Ctrl+V) no composer | miniatura entra na mesma tira | **pass** — 1 thumb ao lado do chip de arquivo |
| 5 | Turno real pedindo o valor da constante "sem usar ferramenta" | resposta traz o valor vindo do contexto | **pass** — resposta contém `engrena-onda1-7788` com **zero** tool calls (work log vazio) |
| 6 | Histórico | mensagem enviada mostra os chips do que foi anexado | **pass** |

**Coberto por unitário** (não reexercitado na UI): teto de 10 anexos, dedupe por path, recusa de seleção
acima de 20k chars, rejeição de payload malformado no HTTP (`attachment_invalid`), anexo com path inseguro
ou arquivo inexistente ignorado sem derrubar o turno.

**Nota de ambiente:** a pasta `projeto de smoke` foi encontrada no início desta rodada apenas com `.git` e sem os
arquivos gerados na sessão anterior (`index.js`, `package.json`, `node_modules`) — reset externo a este
trabalho, não houve remoção por esta sessão.

---

## Onda 2 — gestão da conversa (2026-08-11)

**Ambiente:** mesmo da Onda 1, `ENGRENACODE_USER_DATA` em `%TEMP%\engrenacode_onda2_smoke`.

| # | Cenário | Esperado | Resultado |
|---|---------|----------|-----------|
| 1 | Fim de turno real | 3 sugestões de follow-up abaixo da resposta | **pass** — ex.: "Localize onde MARCADOR_SMOKE é usado no projeto" |
| 2 | Clicar numa sugestão | preenche o composer sem enviar | **pass** |
| 3 | 👍 numa resposta | fica marcado (`aria-pressed=true`) | **pass** |
| 4 | Recarregar o app e reabrir a thread | voto continua marcado | **pass** — veio do histórico persistido |
| 5 | Renomear conversa (✎, Enter) | título novo na sidebar | **pass** — "Conversa renomeada no smoke" |
| 6 | Buscar por conteúdo de mensagem (`marcador.ts`) | acha a conversa | **pass** (1 resultado) |
| 7 | Buscar por título (`renomeada`) | acha a conversa | **pass** (1 resultado) |
| 8 | Buscar termo inexistente | lista vazia | **pass** (0 resultados) |
| 9 | Exportar (⤓) | baixa markdown com nome derivado do título | **pass** — `conversa-renomeada-no-smoke-d67ae528.md` |

**Coberto por unitário:** título > 120 chars rejeitado, título vazio volta ao automático, `format` inválido
no export → 400, voto em mensagem de usuário → 400, voto inválido → 400, toggle do voto (mesmo voto limpa),
parsing de follow-up (bloco de código, duplicata, teto de 3, lixo → lista vazia).

---

## Onda 3 — contexto profundo e governança (2026-08-11)

**Ambiente:** mesmo das ondas anteriores, `ENGRENACODE_USER_DATA` em `%TEMP%\engrenacode_onda3_smoke`.
Fixtures no `projeto de smoke`: `frete.ts` (indexável), `segredo.ts` (com `CHAVE_SECRETA`) e
`.engrenaignore` com `segredo.ts`.

| # | Cenário | Esperado | Resultado |
|---|---------|----------|-----------|
| 1 | Arquivo em `.engrenaignore` | some do explorer e da menção `@` | **pass** — `segredo.ts` 0 ocorrências, `frete.ts` presente |
| 2 | Leitura direta pela API do arquivo excluído | 403 explicando o motivo | **pass** — `403 file_ignored` |
| 3 | `#codebase` com o pedido "como o projeto calcula o frete?" | anexa o trecho certo como chip | **pass** — `✂ frete.ts:1-2` |
| 4 | Busca no índice por termo que só existe no arquivo excluído | nenhum resultado | **pass** — 0 hits para `CHAVE_SECRETA` |

**Coberto por unitário:** parser do `.engrenaignore` (negação, `**`, âncora `/`, diretório, precedência do
último padrão), cache por mtime, indexação incremental por mtime, remoção do arquivo apagado, isolamento
entre projetos, um trecho por arquivo no resultado, allowlist de ferramenta por projeto (grava, não duplica,
não vaza entre projetos, revoga, cascade ao apagar o projeto).

**Não exercitado ao vivo:** "Sempre neste projeto" sobrevivendo ao restart do app — exigiria um turno
supervised extra mais reinício; o caminho está coberto por unitário no repositório e no broker.

---

## Onda 4 — prompts salvos e modos de chat (2026-08-11)

**Ambiente:** mesmo das anteriores, `ENGRENACODE_USER_DATA` em `%TEMP%\engrenacode_onda4_smoke`.
Fixtures versionadas no `projeto de smoke`: `.engrena/prompts/checar-rota.prompt.md` (com variável
`${input:rota:GET /todos}`) e `.engrena/modes/modo-repo.chatmode.md` (`model: claude-haiku-4-5`,
`access: full-access`, instrução com o marcador `MODO-REPO-4321`).

| # | Cenário | Esperado | Resultado |
|---|---------|----------|-----------|
| 1 | Digitar `/` no composer | menu com "Comandos" e "Prompts salvos" | **pass** — `/checar-rota — … (do repositório)` |
| 2 | Escolher o prompt do repo | corpo entra no composer com a 1ª variável selecionada | **pass** — texto `Explique em uma linha o que a rota GET /todos faz.`, seleção `GET /todos` |
| 3 | "+ prompt" com nome "Explicar Rota" | salva com nome em slug | **pass** — `/explicar-rota` no menu, com ✕ |
| 4 | ✕ no prompt salvo | some da lista; o do repo permanece | **pass** — sobra só `checar-rota` (source `file`) |
| 5 | Abrir a pill MODO | lista modos do projeto, inclusive o do repo | **pass** — `modo-repo — … (do repositório)` |
| 6 | Aplicar `modo-repo` | preset do frontmatter cai nos controles | **pass** — modelo `claude-haiku-4-5`, access `Full access` |
| 7 | Turno real com o modo aplicado | instrução do modo governa a resposta | **pass** — resposta abre com `MODO-REPO-4321` |
| 8 | Reiniciar o app e reabrir a thread | pill volta com o modo da thread | **pass** — `MODO modo-repo` veio de `threads.chat_mode` |
| 9 | Salvar preset atual como modo, com instruções | modo novo vira o ativo na hora | **pass** — pill vira `modo-ui` (ver bug 1) |
| 10 | Follow-up na mesma thread com o modo trocado | novo modo governa o turno retomado | **pass** — resposta abre com `MODO-UI-9182` (ver bug 2) |
| 11 | ✕ no modo salvo | some da lista e a pill volta para "Sem modo" | **pass** |

**Dois bugs achados no smoke e corrigidos aqui:**

1. Salvar o preset gravava no banco mas a pill continuava no modo anterior — `applyChatMode` lia a lista
   do render anterior, ainda sem o modo recém-criado. Passou a marcar o nome direto no rascunho.
2. Trocar de modo no meio da thread não mudava nada no turno seguinte: com `--resume`, o Claude CLI
   reaproveita o system prompt gravado na sessão e ignora o `--append-system-prompt` novo. O bloco do modo
   passou a viajar no prompt do turno quando a thread é retomada, como já acontece com os anexos de contexto.

**Coberto por unitário:** slug do nome (acento, pontuação, teto de 40), variáveis `${input:nome:placeholder}`
(ordem, dedupe, valor vazio não vence o placeholder), frontmatter (sem frontmatter, aspas, linha inválida),
arquivo com outra extensão / corpo vazio ignorado, nome do banco vencendo o mesmo nome em arquivo, conflito
de nome (409), projeto inexistente (404), guarda de cofre travado (423) antes do token (401), modo
desconhecido não vira bloco, turno sem modo não ganha bloco.

**Não implementado nesta onda:** o plano previa que o modo também ligasse skills/rules do projeto; ficou de
fora — o modo cobre provider, modelo, reasoning, access, execution e instruções. Instruções pela UI existem
no formulário de salvar; edição posterior de prompt/modo só via API ou arquivo do repo.
**Fechado em 2026-08-17** — ver "Modo de chat filtrando skills/rules" no fim deste arquivo.

---

## Decisão no momento da pergunta (2026-08-11)

**Origem:** print do usuário — o agente pediu autorização para `npm install` em prosa, ele respondeu
"sim" no composer, e só depois apareceram opções (que são sugestões de follow-up, geradas por uma
chamada extra ao provider) embaixo da mensagem seguinte.

**Ambiente:** `pnpm dev` (Electron real), `ENGRENACODE_USER_DATA` em `%TEMP%\engrenacode_decision_smoke`,
`ANTHROPIC_API_KEY` unset, projeto `projeto de smoke` vazio, Claude Sonnet, access `Auto-accept edits`.

| # | Cenário | Esperado | Resultado |
|---|---------|----------|-----------|
| 1 | Pedido que exige decisão, com a tool MCP liberada | card do agente com opções no instante da pergunta | **pass** — "O agente precisa da sua resposta" + 3 opções escritas pelo próprio agente |
| 2 | Responder pelo card | turno retoma e conclui | **pass** — "Cancelado. Nada criado.", nenhum arquivo criado no projeto |
| 3 | Resposta que termina em pergunta, sem chamar a tool | botões de decisão sob a resposta, sem chamada extra ao modelo | **pass** — `Sim, pode prosseguir` / `Não, aguarde` junto com a resposta (16,4 s = o próprio turno) |
| 4 | Clicar num botão de decisão | envia direto, sem passar pelo composer | **pass** — bolha em 9,8 s e resposta "Ok, aguardo." no turno seguinte |
| 5 | Sugestões de follow-up | esqueleto enquanto gera, chips depois, ancorados na mensagem certa | **pass** — esqueleto no instante em que o turno assenta; GET devolveu cache em 35 ms quando o prefetch teve folga |

**Achado que destravou o caso:** sob `auto-accept-edits` o Claude CLI libera edição de arquivo mas
**nega tool MCP** — inclusive a `ask_user_question`, que é justamente a que desenha os botões. O agente
não conseguia perguntar pela tool e caía para pedir aprovação em prosa. Corrigido passando as tools
internas em `--allowedTools`; nas duas tentativas antes disso o agente respondeu em prosa, e na
tentativa seguinte à correção usou a tool.

**Coberto por unitário:** detecção da pergunta final (pt e en), alternativas enumeradas viram opções,
pergunta no meio do texto / pergunta aberta / pergunta longa não viram decisão, bloco gravado na
mensagem pelo runner, `alwaysAllowedTools` no turno.

**Um clique no card do agente (2026-08-11, mesma rodada):** o card exigia marcar a opção e depois
`Enviar`. Com escolha única e sem texto livre digitado, o clique passou a ser a resposta inteira —
mesmo comportamento dos botões de decisão do fallback. Verificado ao vivo: card com `Sim`/`Não` e a
dica "o clique já envia", um clique em `Não` fechou o card em 4,3 s, turno retomou e o agente
respondeu "Não cria. Diz." sem criar arquivo. Múltipla escolha e texto livre em andamento continuam
enviando pelo botão (o texto se perderia).

**Correções a partir de print do usuário (2026-08-11, mesma rodada):**

| # | Cenário | Esperado | Resultado |
|---|---------|----------|-----------|
| 1 | Turno gerando sugestões | estado de carregamento legível, não pílulas vazias | **pass** — linha "Sugerindo próximos passos…"; o esqueleto anterior tinha a forma dos chips e era lido como botão quebrado |
| 2 | Resposta pedindo aprovação **sem** interrogação ("Espero aprovação pra rodar npm install. Manda ok pra prosseguir.") | botões de decisão mesmo assim | **pass** — `Sim, pode prosseguir` / `Não, aguarde` em 12,8 s (o próprio turno) |

**Coberto por unitário:** pedido de aprovação em pt e en (`Aguardo sua confirmação.`, `Me avise quando
puder.`, `Waiting for your approval.`, `Let me know.`), afirmação comum sem pedido (`Instalei as
dependências…`, `Aguardo o build terminar…`) não vira decisão, pedido no meio do texto com relato
depois não conta.


---

## Modo de chat filtrando skills/rules do projeto (2026-08-17)

Fecha a lacuna declarada acima.

**Semântica: filtro, nunca ativação.** O modo restringe o que o projeto já vincula; o catálogo do projeto
continua sendo o teto. Nome que o projeto não vinculou é ignorado em silêncio — assim um `.chatmode.md`
versionado no repo não vira porta de entrada para skill ou rule que ninguém aprovou naquele projeto.

| Valor no modo | Efeito no turno |
|---|---|
| chave ausente | tudo que o projeto vincula (comportamento de sempre) |
| `skills: a, b` ou `skills: ['a', 'b']` | só `a` e `b`, interseção com o vínculo do projeto |
| `skills: []` | nenhuma skill |
| `skills:` (em branco) | tratado como ausente — um campo digitado sem valor por engano não pode zerar o catálogo |

**Onde declara:** frontmatter dos `.engrena/modes/*.chatmode.md`, colunas `skills_json`/`rules_json`
(migração `020_chat_mode_catalog`) e os campos `skills`/`rules` no POST/PUT de `/api/projects/:id/modes`.
O formulário de salvar modo do composer **não** ganhou seletores nesta fatia: isso cai junto da outra
pendência, a de editar prompt/modo pela própria UI.

**O filtro entra na origem, não só no texto.** `createSkillSnapshot` recebe a lista e filtra o snapshot
inteiro — o mesmo que alimenta o arquivo lido pela tool `load_skill`. Anunciar menos no system prompt e
continuar servindo tudo deixaria a restrição valendo só de fachada.

### Verificação

- **Migração contra o banco real do usuário:** `020_chat_mode_catalog` aplicada, `chat_modes` com
  `skills_json`/`rules_json`, nenhuma linha existente perdida.
- **API ao vivo** (loopback 5174, cofre destravado): POST com
  `skills: ["skill-a","skill-a","Skill-A","outra"]` e `rules: []` devolveu `skills: ["skill-a","outra"]`
  (dedupe case-insensitive, primeira grafia preservada) e `rules: []` distinto de `null`; o GET seguinte
  trouxe o mesmo. `skills: "a,b"` (string em vez de lista) devolveu **400**, em vez de virar `null` em
  silêncio. Modo de smoke apagado no fim — o projeto voltou a zero modos.
- **Composição do prompt:** três casos em `dispatch.test.ts` capturam o `systemPrompt` real entregue ao
  runner — modo com `skills`/`rules` filtrando skill e rule; modo sem as chaves deixando o catálogo
  inteiro passar; modo de arquivo filtrando pelo frontmatter e ignorando nome que o projeto não vinculou.
- **Não exercitado:** turno pago real com modo filtrando. O filtro é resolvido inteiramente antes do CLI
  (snapshot e blocos já montados), e os testes acima passam pelo `dispatchNewThread` de verdade — o que
  sobraria para o turno pago provar é o CLI, que não toca nisso.

# CLAUDE.md

Orientações para Claude Code ao trabalhar neste repositório.

## Meta-instruções

Leia este arquivo antes de qualquer tarefa. Aplique todas as regras em "REGRAS APRENDIDAS".
Ao final de cada tarefa: se o usuário corrigiu algo ou você descobriu padrão não-óbvio, adicione regra.
Regra: `Origem · Categoria · [Sempre/Nunca] X porque Y`.
Este arquivo é sempre em português do Brasil, com acentuação correta — regras novas inclusive. A regra
de "sem acento" vale só para mensagem de commit, não para documentação.
Limite deste arquivo: 220 linhas. Ao atingir 210, consolide regras antigas em `apps/engrena-code/docs/archived/CLAUDE_ARCHIVE.md`.

### Quando ADICIONAR regra
- Usuário corrigiu explicitamente
- Abordagem foi rejeitada
- Bug causado por suposição errada
- Padrão recorrente

### Quando NÃO adicionar
- Coisas que qualquer dev saberia
- Estados temporários
- Informação derivável do código

### Quando NÃO usar este arquivo

| Caso | Lugar certo |
|---|---|
| Comportamentos automáticos | hooks em `settings.json` |
| Preferências cross-session | memory files |

---

## Contexto do Projeto

Monorepo **Engrena** (pnpm). Apps: `apps/engrena-code/` + `apps/engrena-plan/`. Packages: `@engrena/ui|vault|http-core|db-core`. Plano operacional: `docs/engrena/MONOREPO-SPRINTS.md`. Arquitetura: `docs/architecture/monorepo.md`.

**EngrenaCode** — IDE desktop Electron local-first para orquestração de agentes de IA (Claude, Codex, Kimi) com vault cifrado, workspace com diffs, skills/rules/subagents reutilizáveis e auditoria. MVP: F01–F07.

**EngrenaPlan** — planeja (Discovery → PRD → Spec → Plano) antes da entrega no Code; scaffold unlock + shell (não ampliar domínio sem pedido).

### Docs Engrena vs Code vs Plan

| Escopo | Path | Conteúdo |
|--------|------|----------|
| Engrena | `docs/` | Design Lock, sprints, architecture |
| Code | `apps/engrena-code/docs/` | PRD, PROGRESS, F0*-*, AUDIT |
| Plan | `apps/engrena-plan/docs/` | PRD/README stub |

Nunca misturar: feature Code não vai em `docs/` raiz; Design Lock não duplica sob apps.

---

## Docs de Referência

Leia apenas os arquivos relevantes para a tarefa em andamento:

| Arquivo | Quando ler |
|---------|------------|
| `apps/engrena-code/docs/PROGRESS.md` | Status real F01–F11 (feito vs pendente); não usar `_reversa_forward` actions como progresso |
| `apps/engrena-code/docs/PRD.md` | Visão completa Code, features F01–F11, critérios de aceitação |
| `apps/engrena-code/docs/DEVELOPMENT.md` | Setup inicial, deps, vite/biome/tsconfig, correções aplicadas, dev/build |
| `apps/engrena-code/docs/RUNBOOK-HOMOLOGACAO.md` | Validar o build empacotado antes de liberar versão: roteiros A–D, critério de aprovação, rollback, armadilhas de ambiente |
| `apps/engrena-code/docs/F01-vault-e-sessao-local/spec.md` | Spec de Vault: encryption, unlock gate, IPC, erro handling |
| `apps/engrena-code/docs/F01.1-design-system/spec.md` | Tokens, tema tri-modo, Shiki/xterm, superfícies |
| `apps/engrena-code/docs/F28-chat-parity/smoke-results.md` | Paridade de chat com o Copilot Chat (contexto/anexos, histórico, `#codebase`, exclusions, prompts salvos e modos): o que já foi validado ao vivo e o que ficou só em unitário |
| `apps/engrena-plan/docs/PRD.md` | Escopo mínimo Plan (stub) |
| `docs/design-system/` | Design Lock Engrena (raiz): hexes, spacing, tipografia |
| `docs/architecture/monorepo.md` | Contratos packages, portas, env, isolamento |
| `docs/engrena/MONOREPO-SPRINTS.md` | Sprints / memória da conversão monorepo |

---

## Definition of Done

Tarefa concluída quando:
- Código implementado segue padrões em REGRAS APRENDIDAS
- TypeScript type-safe, zero `any` sem justificativa
- Compilação sucede (`pnpm --filter engrena-code build` ou `pnpm build` na raiz)
- Testes passam se há spec
- Performance review completa (React patterns via /vercel-react-best-practices)
- CLAUDE.md atualizado se padrão novo descoberto

---

## AMBIENTE

- Workspace: `pnpm-workspace.yaml` com `apps/*` + `packages/*`. Filters: `engrena-code`, `engrena-plan`, `@engrena/*`.
- Vite Code: primeira livre ≥5173; **exceto 5174 e 5184**. Atualize `VITE_DEV_SERVER_URL` em `apps/engrena-code/.env.local`.
- Unlock Code: `127.0.0.1:5174`. Unlock Plan: `127.0.0.1:5184`. Vite Plan tipico: `5175`.
- Sem Postgres/Docker: local-first; vault em `userData/vault.enc` (userData isolado por `appId`).
- Dados de sessão: nunca apague/substitua `vault.enc` ou userData do usuário. Remova só artefatos desta sessão (`.playwright-cli/`, fixtures `engrenacode_claude_<slug>` / `engrenaplan_*`).
- `.env.local`: copie `.env.example` do app alvo; nunca commit. Env override: `ENGRENACODE_USER_DATA` / `ENGRENAPLAN_USER_DATA`.
- `launch.json`: mesma porta do `.env.local`; nunca commit (`.vscode/*` no `.gitignore`).
- Setup Code: `apps/engrena-code/docs/DEVELOPMENT.md`. Contratos monorepo: `docs/architecture/monorepo.md`.

## DESENVOLVIMENTO
- Sempre carregar a skill /vercel-react-best-practices no início de qualquer sessão que envolva código (TS/TSX, rotas, server actions, Prisma) porque performance e padrões React devem orientar geração e review desde o começo

## TESTE

- Unit (Vitest): `pnpm --filter engrena-code test` (ou `pnpm test`) para Code; `pnpm --filter engrena-plan test` (ou `pnpm test:plan`) para Plan; packages via `pnpm --filter @engrena/<pkg> test`.
- E2E / UI: obrigatório quando o critério de aceitação depende de DOM, navegação, formulários ou comportamento visual (qualquer frase do tipo "usuário consegue clicar / ver / enviar / navegar"). Critérios só de vault/crypto/IPC/API sem superfície UI não exigem E2E.
- Como rodar E2E: tente via `launch.json` se existir e apontar para o app em preview/dev. Se falhar, carregue a skill `playwright-cli` e rode em headless.
- Antes do E2E: `.env.local` ok; Vite na porta de `VITE_DEV_SERVER_URL`; unlock loopback em `127.0.0.1:5174` se a tela exigir sessão.
- Artefatos: smoke/E2E sob `.playwright-cli/` (gitignored). Não grave dumps no vault/`userData` do usuário.

## GIT

- Depois de resolver conflitos de merge ou rebase, rode de novo os unit tests da área afetada (`pnpm test`). Se algum critério de aceitação impactado pelo conflito exigir interação de frontend, rode também o E2E correspondente antes de concluir.

## REGRAS APRENDIDAS

Regras de setup/build já materializadas no repo foram consolidadas em `apps/engrena-code/docs/archived/CLAUDE_ARCHIVE.md` (2026-08-17). Continuam válidas; saíram daqui por não guiarem mais decisão nova.

- `Dev · React · Sempre carregar a skill /vercel-react-best-practices no início de qualquer sessão que envolva código (TS/TSX, rotas, server actions, Prisma) porque performance e padrões React devem orientar geração e review desde o começo`
- `Design · Processo · Sempre escrever ui.md (anatomia + tabela de copy + referência) e compor via primitives antes de implementar tela porque tokens sozinhos não garantem fidelidade visual`
- `Smoke · Electron real · Sempre passar dangerouslyDisableSandbox:true ao rodar pnpm dev (Electron real) via Bash tool porque o sandbox padrão bloqueia GPU/network process do Electron ("Network service crashed"/"GPU process exited") e o processo cai silencioso com exit 0, sem log de erro óbvio`
- `Smoke · Turno real CLI · Nunca deixar ANTHROPIC_API_KEY setada no shell ao subir pnpm dev para turno real porque o processo filho claude herda a env var e autentica por API key (saldo pode ser zero) em vez da sessão de assinatura já logada no binário; unsetar antes do dev server subir e conferir billing em #consumo (subscription/cost_source=sdk confirma)`
- `Runner · Claude CLI · Supervised usa --permission-mode auto + --settings com hook PreToolUse (permission-broker.ts/permission-hook.ts) porque manual/dontAsk/default negam toda tool por decision_reason_type:"mode" antes do hook rodar — permissionDecision:"allow" do hook é ignorado nesses modos; só sob auto o hook tem autoridade real de allow/deny. settings.json exige wrapper {"hooks":{"PreToolUse":[...]}}, não a forma "direta" sem wrapper que a doc pública mostra — confirmado ao vivo contra claude-code 2.1.226, sem esse wrapper o hook nunca dispara`
- `Runner · Claude CLI · Sempre incluir hookEventName:'PreToolUse' no hookSpecificOutput do hook de permissão porque sem esse campo o CLI dispara o hook, ignora a decisão em silêncio e cai no default headless que nega escrita ("Claude requested permissions to write to X, but you haven't granted it yet") — o agente então pede confirmação em prosa e encerra o turno, sem modal e sem arquivo. Decidir por stdout + exit 0 nos dois casos (allow e deny): é onde permissionDecisionReason chega limpo ao modelo`
- `Runner · Claude CLI · Follow-up de thread Claude sempre passa --resume <session_id> (persistido em threads.cli_session_id a partir do session_id do stream-json) porque -p sem resume abre conversa nova: responder "Sim" a uma pergunta do agente virava turno sem contexto ("Qual tarefa?")`
- `Permissão · Allowlist · Sempre gravar "Permitir todos" pela chave de escopo de bash-command-scope.ts (Bash(git *)), nunca pelo nome cru da tool, e derivar de TODOS os segmentos da linha (cd "<proj>" && printf x > a.txt concede cd E printf) porque derivar só do começo dava Bash(cd *) e liberava qualquer coisa encadeada depois de um cd; segmento sem verbo nomeável (./deploy.sh, $(…)) cai na chave larga, que segue válida para o que foi concedido antes (sem migração). O card usa a MESMA função para escrever o rótulo do chip — prometer "esta ferramenta" e gravar o verbo (ou o contrário) faz o usuário conceder mais do que pretendia. Não é fronteira de segurança (git libera git push), é redução de alcance`
- `Permissão · auto-accept-edits · Nunca afirmar que o nível é idêntico ao acceptEdits do Claude Code: lá o modo também auto-aprova uma lista fixa de comandos de arquivo no shell (mkdir/touch/rm/mv/cp/sed) dentro do working dir, aqui nenhum Bash passa sozinho (F31 especifica a paridade, não implementada). Consequência prática medida ao vivo: o agente escreve arquivo por printf > x e o nível abre card em todo turno — por isso o RUNTIME_SAFETY_PROMPT manda usar Write/Edit e deixar o shell para o que não tem tool. Ao diagnosticar "o nível não funcionou", olhar tool_calls.name no engrenacode.db antes de acusar a política`
- `Workspace · Permissão · Sempre manter os dois gatilhos do PermissionPrompt vivos e convergindo em PermissionDecisionKind, nunca em texto (F03-workspace/spec.md §3.5): o chip concede/nega no clique (sem escrever no composer, sem bolha, chips disabled por gateApi.busy) e sim/não/permitir todos digitado + Enviar faz o mesmo por interpretPermissionChatReply; daí para o POST há um caminho só (permissionResolveArgs → decidePermission, por gateId). Reverteu em 2026-08-18 o contrato "clique só preenche o composer" — o motivo dele (a IA dizer “clique no botão” sem o botão conceder) morre junto com a mudança. Nunca fazer o chip escrever no composer e disparar o envio para "ter uma rota só": reparsear string que nós mesmos geramos acopla rótulo de UI aos sets do parser (renomear chip → clique cai em blocked e vira mensagem enfileirada, sem erro em tela), destrói o rascunho em andamento e cria bolha sem nada a ecoar. AskUserQuestionCard segue opção→composer→Enviar: lá a resposta é editada antes de sair`
- `Workspace · Permissão · PermissionPrompt e AskUserQuestionCard são cards inline na timeline (só chips → composer principal → Enviar); nunca overlay nem textarea/Enviar dentro do card — segundo campo no prompt fazia o usuário achar que o clique já concedia e em waiting_user o composer mostrava só Parar`
- `Workspace · Chat · Em running o composer mostra Parar e Enviar (enfileira); só Parar em stopping — esconder Enviar enquanto a IA trabalha quebrava a fila de follow-ups`
- `Workspace · Chat · Nunca mostrar followups/decisões com thread running/waiting_*/pending sending|sent|queued — chips de “próximo passo” em cima de Executando… eram lidos como pedido de permissão duplicado`
- `Workspace · Permissão · No Windows o launcher do hook é permission-hook.cmd (set ELECTRON_RUN_AS_NODE + .mjs); cmd /c set VAR=1&& electron engolia o stdin e o broker via tool “unknown”. Settings registra PreToolUse e PermissionRequest com o mesmo command — sem PermissionRequest o CLI nega Write com “haven't granted it yet” mesmo após o broker allow`
- `Workspace · Permissão · Nunca remover requestId da permissionQueue no renderer antes de POST /permission suceder (res.error ou throw mantém o modal) porque dequeue otimista fazia o clique parecer aceito sem o broker liberar a tool`
- `Workspace · AskUserQuestion · Em waiting_user o Enviar do composer responde via POST /answer (opção clicada ou texto livre); não enfileirar follow-up — senão a pergunta MCP fica presa e o texto vira turno órfão`
- `Docs · Ondas · Sempre manter a tabela "Ondas (PRD §8)" de apps/engrena-code/docs/PROGRESS.md espelhando toda feature da tabela de dependências do PRD (pendentes inclusas) com paralelismo explícito por linha, porque backlog descrito só em texto narrativo ("Próxima frente de produto") sai do radar e ondas com pendência ficam marcadas "Completa"`
- `Setup · Monorepo · Sempre usar pnpm --filter engrena-code|engrena-plan|@engrena/* (ou scripts raiz); docs Code em apps/engrena-code/docs/; docs Plan em apps/engrena-plan/docs/; Design Lock + sprints + architecture em docs/ na raiz; nunca misturar escopos nem git mv docs/engrena/ para o app`
- `Smoke · Vault session · Vault mantém 1 sessionToken global por processo; unlock via UI invalida token pego via curl antes. Sempre reler o token atual (playwright-cli localstorage-get sessionToken) antes de chamar API por fora da UI na mesma sessão de smoke`
- `HTTP · Guard · Sempre copiar o guard() que checa vaultService.isLocked() (423 vault_locked) antes do token de sessão (401 unauthorized) em handler HTTP novo; nunca só isAuthorized/token, porque senão rota protegida com cofre travado vaza 401 e sombra handlers posteriores na cadeia`
- `Segredo · sanitizeProcessError · Sempre atualizar sanitizeProcessError no mesmo diff ao adicionar scheme de URL autenticada (oauth2:/x-token-auth:/https://:token@) ou prefixo de provider (xai-/gsk_/…) porque git push/CLI pode ecoar o segredo na message que chega à UI E nunca reordenar ou "simplificar" as regex: Nunca reordenar ou "simplificar" as regex de sanitizeProcessError: o encurtamento de path roda antes da redação (senão o regex de path come o marcador ***@host/org/repo.git) e a senha do userinfo genérico exclui '*' inicial (senão o padrão re-casa x-access-token:***@ e apaga o rótulo)`
- `Validação · shared · Sempre importar validate*Key/token de módulo puro (provider-keys/github-token) no *.logic.ts do renderer em vez de re-declarar literals; import de valor só se o módulo não puxar Node/fs/electron`
- `Skills · Manutenção · Nunca gravar dado volátil (n testes verdes, "os 12 handlers", data de passagem) em coding-*/rules/ nem SKILL.md de roteamento; IDs RC-*/abertos e mapa de paths ficam em coding-*/project.md; número/data/evidência só em apps/engrena-code/docs/AUDIT-CODE-REVIEW.md, porque snapshot volátil envelhece e a próxima sessão age sobre fato falso`
- `Skills · Estrutura · Sempre manter SKILL.md como roteamento; material auxiliar em references/*.md (playwright-cli/spec-writer) ou, nas coding-*, em rules/*.md (regras portáveis Incorrect/Correct) + project.md (bindings do repo); frontmatter+corpo do SKILL entram no contexto sempre e o resto só sob demanda`
- `Teste · Flaky · Sempre rodar pnpm test duas vezes antes de tratar vermelho como regressão: git-client/git-handler/delegate/pipeline-runner/permission-broker/worktree usam git e spawn reais (8–16 s por arquivo) contra testTimeout default de 5 s e estouram sob carga; caso novo com processo real nasce com testTimeout explícito`
- `Workspace · Access · Sempre persistir accessLevel via PATCH /api/threads/:id ao mudar a pill (e rehidratar do selectedThread) porque draft-only não atualiza DB/sidebar; upgrade mid-turn libera só o que a política do novo nível auto-aprova (full-access solta tudo; auto-accept-edits solta edição e mantém Bash no modal)`
- `Runner · Permissão · Sempre montar o broker PreToolUse (--settings + --permission-mode auto) quando provider === 'claude' && permissionBrokerApplies(accessLevel) — só Claude, e em qualquer nível exceto full-access; settings registra PreToolUse E PermissionRequest com o mesmo command, e o hook espelha o hookEventName do evento recebido. A semântica do nível vem de permission-policy.ts (auto-accept-edits auto-aprova Read/Write/Edit e pergunta Bash/WebFetch/MCP) porque --permission-mode acceptEdits nega Bash/MCP nativamente ("This command requires approval" / "haven't granted it yet") sem abrir modal: não havia permissão pendente, o "Aprovado" do usuário virava turno novo e o agente repetia que era preciso "clicar no prompt da ferramenta"`
- `Runner · Processos · Nunca matar por nome genérico (Stop-Process -Name node / pkill node); sempre kill-by-port ou PID — regra injetada em RUNTIME_SAFETY_PROMPT porque kill-by-name derruba Electron/Vite e entra em loop de permissão`
- `Workspace · Chat · Sempre pintar bolha otimista do usuário no envio (pendingMessages.logic: sending/sent/queued/permission, reconciliada por conteúdo no GET /history) porque o chat só re-busca histórico em tool_call.start/state.change e turno longo deixava a mensagem invisível por ~1 min; fila e resposta de permissão também precisam de bolha, senão o usuário reenvia`
- `Workspace · Permissão · Nunca promover bolha de decisão (status permission) para sent após POST /permission ou /answer — sent vira "Executando…" e o reconcile nunca remove (texto não entra no histórico); o próximo PermissionPrompt nascia sob "Permitir / Executando…" fantasma. Remover a bolha no grant e limpar resíduos em permission.request`
- `Workspace · Chat · Nunca deixar refetch de histórico disparado pelo stream ligar historyLoading/historyError (loadHistory(id,{background:true})) e nunca guardar expansão de Work log só no DOM do <details> porque trocar a árvore por "Carregando…" joga o scroll ao topo e fecha o work log no meio da análise; scroll do chat é programático via useChatScroll + [overflow-anchor:none], com CTA "Ver mensagem" quando a resposta chega fora de vista`
- `Workspace · Permission · Permitir todos grava toolName na allowlist da thread (sessão do processo) e auto-allow no broker sem UI — equivalente Claude Code “don’t ask again”; limpar allowlist no DELETE da thread`
- `Workspace · Chat · Sempre manter o indicador de atividade visível enquanto state === running (nunca condicionar a streamingText vazio) e derivar o rótulo shimmer da tool running mais recente via currentActivity (fallback Trabalhando, nunca o nome cru da tool); o cronômetro de Pensando conta a partir da bolha otimista despachada, senão o follow-up nasce com o tempo do turno anterior`
- `Workspace · Chat · Sempre derivar rótulo/visibilidade do composer e da timeline por chatSurface.logic.ts (deriveChatSurface), que chama routeComposerSend por dentro em vez de reimplementar o predicado, porque TaskComposer.tsx e ChatHistory.tsx tinham cópias independentes da mesma decisão a partir de thread.state cru: waiting_user sem pergunta pendente rotulava "Enviar resposta" enquanto o envio enfileirava. Teste obrigatório compara deriveChatSurface(...).route com routeComposerSend(...).action na matriz estado × flags × texto`
- `Gate · TypeScript · Sempre validar tipos com pnpm --filter engrena-code exec tsc -b (ou pnpm build) porque tsconfig.json da raiz do app só tem "references" e files:[]; tsc --noEmit -p tsconfig.json passa sem checar nada e dá falso verde`
- `HTTP · threads-handler · Sempre registrar rota nova nas DUAS listas (regex + matchesThreadsRoute) porque o guarda de prefixo devolve false antes do dispatch e o request fica pendurado até o teste estourar em 5 s sem erro nenhum`
- `Build · electron-builder · Sempre encerrar o app de smoke antes de pnpm build porque o rename de release/win-unpacked falha com EPERM enquanto o Electron do dev está aberto (tsc/vite já passaram; o erro é só empacotamento)`
- `Ferramenta · Arquivo com backslash · Nunca escrever via heredoc/Bash conteúdo com backslash (regex \n, split('\'), ESCAPE '\') porque o shell colapsa e gera string não terminada; usar a ferramenta Write ou trocar por String.fromCharCode/escape alternativo (LIKE ... ESCAPE '#')`
- `Runner · Claude CLI · Nunca contar com --append-system-prompt para instrução que muda no meio da thread porque o turno com --resume reaproveita o system prompt gravado na sessão do CLI e ignora o novo; bloco que precisa valer no turno retomado (modo de chat) viaja no prompt, como os anexos de contexto`
- `Runner · Claude CLI · Sempre passar as tools internas (ask_user_question/load_skill/call_subagent) em --allowedTools porque o modo acceptEdits (auto-accept-edits) libera edição de arquivo mas nega tool MCP: o agente não consegue nem perguntar ao usuário e cai para pedir aprovação em prosa, sem botão nenhum na tela`
- `Build · Vite · Sempre code-split telas autenticadas com React.lazy, highlighter Shiki via @shikijs/langs|themes (nunca import { codeToHtml } from 'shiki') e CSS do xyflow no painel lazy porque o chunk index passava de 1 MB, o registry completo emitia grammars de 600 kB+ e vite:css-post inflava no CSS global`
- `Build · Electron · Nunca ligar vite-plugin-electron-renderer no Code porque o renderer não usa API Node; o plugin era 13% do tempo de plugin no Rolldown e o polyfill não tem consumidor`
- `Build · Windows icon · Sempre versionar assets/icon.ico multi-size + win.icon + signAndEditExecutable true, copiar icon.png em extraResources, setAppUserModelId(appId) e fechar o Setup/app antes do build porque só SVG ou cache do Explorer deixam .exe/atalho pretos ou com ícone Electron; EPERM no Setup apaga o instalador e a instalação antiga permanece`
- `Workspace · Stream · Sempre reler o estado da thread no resync do socket (todo open, não só reconnect), além de histórico e gate, porque o hub não bufferiza: o state.change de assentamento perdido numa queda deixa o composer em modo ocupado com o backend já idle, e reabrir a thread não conserta (só chama history/diffs/gate) — o usuário fica preso até o F5`
- `Smoke · WebSocket · Nunca usar emulação de rede do Chromium (Network.emulateNetworkConditions/context.setOffline) para derrubar socket em smoke: offline corta fetch/XHR mas não WS em loopback, e a condição gruda na sessão CDP (nem setOffline(false) desfaz, só fechar o browser). Usar addInitScript com subclasse de WebSocket que registra tentativas e, sob flag, reescreve a porta para uma morta`
- `Smoke · Ambiente · Sempre abrir o browser com playwright-cli open --headed quando o usuário precisar digitar (senha do cofre); headless é o default e ele digita numa janela que não existe. O cofre vive na memória do main e só é destravado por IPC da janela do Electron: fechar aquela janela derruba o pnpm dev inteiro (exit 0) e leva a API junto. Header de sessão da API é x-engrenacode-session, não Authorization: Bearer`
- `Runner · Claude CLI · Sempre repassar tool_use_id do payload do PreToolUse ao broker (permission-hook manda toolName+toolInput+toolUseId) porque a negação nativa chega no stream com o mesmo id: é a única chave que liga a decisão à chamada exata, e sem ela duas chamadas da mesma tool no turno viram uma entrada só e o diagnóstico atribui a decisão da chamada errada. O broker grava nas duas chaves (id exato e toolName agregado) e a consulta tenta o id primeiro`
- `Processo · Limites · Nunca declarar "não é possível" sobre integração com CLI/API de terceiro sem conferir o payload real (doc oficial, fixture in-repo ou captura ao vivo) porque é fácil descrever o comportamento do nosso código e apresentar como limite do protocolo: a granularidade por toolName foi registrada no AUDIT como irredutível quando o tool_use_id já vinha no payload e era o nosso hook que o descartava`
- `Smoke · Turno sem UI · Sempre destravar o cofre por POST 127.0.0.1:5174/api/vault/unlock com {workspace:<qualquer string>, password} (workspace só chaveia o backoff) e disparar o turno pela API com header x-engrenacode-session; a mesma 5174 serve unlock, API e o WS (?threadId=<pai>, subprotocol engrenacode-session.<token>), então dá para rodar turno real sem tocar na janela do Electron. Nunca sair do socket no state.change terminal: o emit({type:'error'}) do dispatch chega DEPOIS dele, e quem encerra ali vê a thread morrer sem motivo nenhum`
- `Runner · Catálogo do turno · Sempre aplicar o filtro de skills do modo de chat dentro de createSkillSnapshot (não só no texto do system prompt) porque o mesmo snapshot alimenta o arquivo que a tool load_skill lê: anunciar menos e continuar servindo tudo deixa a restrição valendo só de fachada. A semântica do modo é filtro, nunca ativação (interseção com o vínculo do projeto); chave ausente = catálogo inteiro, [] = nenhum, valor em branco = ausente`
- `Workspace · Subagents · Sempre tratar a correlação tool_call → subagent_run como 1:N (Map<string, SubagentRun[]>), nunca 1:1, porque uma chamada call_subagent com tasks[] (batch paralelo F18) abre até 4 filhos que gravam o MESMO parentToolCallId: com Map<string, SubagentRun> cada set sobrescrevia o anterior e a timeline do pai exibia só o último filho, enquanto grafo e card lateral (que leem subagentRuns direto) mostravam todos`
- `Diff · Materializacao · Nunca deduzir intencao de remocao so por existsSync do arquivo dentro do worktree do filho: o mesmo falso aparece quando o worktree inteiro sumiu (prune, restart, limpeza de disco) e a resolucao apagava o arquivo integro do pai, promovendo o diff com hunks de uma alteracao que nunca aterrissou. Checar o worktree antes de materializar e recusar com worktree_missing (409), preservando arquivo, status conflict e candidatos para o usuario tentar pelo outro filho`
- `Smoke · Batch paralelo · Sempre usar subagents que de fato escrevem ao provocar conflito de path no F18: o explorer do catálogo é read-only por definição do próprio agente e recusa a escrita, então só um filho toca o arquivo, o path vira exclusivo e sai um diff pending comum em vez de conflict com candidatos — não é defeito, é o batch se comportando como deve`
- `Smoke · Prova de precedência · Nunca provar precedência entre duas fontes de instrução com regras que podem ser satisfeitas juntas (prefixo A na rule, prefixo B no CLAUDE.md do repo: o modelo responde com os dois e não prova nada); as instruções precisam ser mutuamente exclusivas por construção — idioma é o caso mais limpo — e o prompt não pode dar pista de qual lado vence`
- `Workspace · Modo de chat · Sempre preservar o tri-estado do catálogo do modo na UI (botão "Todas" = null sem filtro, lista explícita, [] = nenhuma) e oferecer no seletor só o que o turno resolve de fato (skills linked+enabled+enabledInProject, rules enabled+activeInProject) porque um checkbox comum colapsa null e lista-cheia no mesmo estado: o modo passaria a congelar o catálogo de hoje sem o usuário pedir, e nome que o projeto não vincula viraria filtro de fachada`
- `Ferramenta · playwright-cli no Git Bash · Sempre exportar MSYS_NO_PATHCONV=1 antes de digitar texto que começa com / (playwright-cli type "/check") porque o MSYS reescreve o argumento para C:/Program Files/Git/check e o gatilho do menu de comandos nunca dispara — o sintoma é "menu não abriu", não erro nenhum. Quando um fill não refletir no estado React (botão segue disabled), clicar no campo e usar type resolve`
- `Docs · Registro · Sempre varrer PROGRESS.md e smoke-results.md por referências ao que o commit acabou de remover (arquivo, agente, path) porque a linha de F03 apontava para .claude/agents/sprint-*-*.md depois de eles saírem do repo, e registro que aponta para arquivo inexistente envelhece como fato falso`
- `Workspace · Fila · Sempre tratar a fila do composer pelo contrato de F03-workspace/spec.md §3.4: um lugar só (painel, nunca bolha duplicada na timeline), toda mensagem com thread ocupada vai para a fila (inclusive com card de permissão aberto — só palavra de decisão resolve o gate), queueLength entra em routeComposerSend para a mensagem nova não furar a fila, e TURN_RECONCILED_STATES = SETTLED_THREAD_STATES para drenar em todo fim de execução. Nunca criar CTA de "executar agora": excluir cancelled da drenagem congelava a fila e o item saía fora de ordem no turno seguinte`
- `Permissão · auto-accept-edits shell · Sempre decidir comando de shell por lista fechada de verbos + resolução de caminho (F31: file-command-classifier.ts + project-path-scope.ts, compostos em permissionPolicyDecision), nunca por heurística de "parece inofensivo": a única saída nova é allow, e verbo desconhecido, flag desconhecida, encadeamento fora de `cd <raiz> && <cmd>`, redirecionamento, glob/variável/substituição, path fora da raiz efetiva ou por dentro de .git caem todos em card. Resolver com realpath do ancestral que existe antes de comparar (symlink dentro do projeto apontando para fora passa em comparação de string) e usar a MESMA raiz do turno (resolveThreadCwd), senão filho em worktree tem todo comando legítimo reprovado. Tabela de verbos em Map, nunca Record: VERB_RULES['__proto__'] devolve Object.prototype e vira regra válida com campos NaN. Toda auto-aprovação grava log_entries — é o único allow que sai de parser nosso LEITURA (F31 v1.1, mesmas regras de borda): Sempre tratar leitura pelo shell (F31 v1.1: cat/head/tail/wc/ls) como estágio separado do de escrita, com pipe aceito só entre verbos da própria lista e até 3 estágios, porque encadear leitura não compõe poder mas um segmento fora da lista (cat x | sh) compõe tudo. Dois riscos que não existem na escrita: ler fora da borda (mesma resolução de caminho, sem exceção) e TRAVAR o turno — tail -f nunca retorna e cat/wc/head sem argumento esperam stdin, então f/F saem da lista do tail e o primeiro estágio precisa nomear caminho (ls é o único que faz sentido sem argumento). find e grep ficam fora: -exec/-delete/-fprint e -f arquivo são gramática que executa e escreve em posição variável, a armadilha do sed -e num verbo onde errar custa execução arbitrária. Valor de flag que consome argumento (head -n 50) entra como caminho de propósito: pular o valor deixaria -n /etc/passwd sem conferência`
- `Workspace · Tarja · Nunca mandar diagnóstico de runtime para a tarja âmbar do chat (F30): ela é lida como falha do turno que acabou de rodar, e versão de CLI fora da faixa validada não bloqueia spawn nenhum. Diagnóstico tem dois destinos — log_entries (Registros/work log, onde faixa min/max e motivo cru do CLI podem aparecer inteiros) e a superfície de estado do runtime (caption muted na row do CLI em #configuracao). Na tarja só copy de produto: duas frases, o que aconteceu com a tool e o próximo passo. Corolário do outro lado: rota de status que alimenta tela (GET /api/config/status → Dashboard) nunca chama readClaudeCliVersion (spawn de até 5 s); usa peekClaudeCliVersion, que devolve só o que o cache já tem e distingue null (cache frio, sem caption) de unavailable (binário mudo)`
- `Gate · Prazo · Sempre derivar PERMISSION_TIMEOUT_MS de HOOK_COMMAND_TIMEOUT_SEC menos PERMISSION_HOOK_MARGIN_SEC (permission-contract.ts), nunca escrever literal de prazo em gate.ts, porque o teto de quem espera é o do hook do CLI e os dois números divergiram: o literal era 2 min contra 600 s de tolerância, 5x mais apertado sem nada ligando um ao outro, e gate expirando por timeout apareceu na homologação e na medição do F31. A margem cobre o que acontece DEPOIS do clique (spawn do hook no Windows, ida e volta HTTP, gravação da decisão) — sem ela o usuário concede num card que o CLI já matou. Teste anti-drift varre o fonte de gate.ts por `N * 60 * 1000`. Todo gate fechado grava log_entries com desfecho e segundos abertos: é como a próxima revisão do número se decide por dado em vez de impressão`
- `Estado · Listas paralelas · Sempre classificar valor novo de ThreadState nos TRÊS lugares que particionam a união — SETTLED_STATES de turn-state.ts (backend), SETTLED_THREAD_STATES de threadStream.logic.ts (renderer) e LIVE_STATES_AT_BOOT de threads.ts — porque elas não se derivam uma da outra e esquecer a do backend não dá erro de tipo: `interrupted` (F35) entrou na união e nas duas do renderer mas ficou fora de SETTLED_STATES, e como follow_up só é legal a partir dela a thread recuperada no boot parou de aceitar qualquer mensagem (dispatch respondendo thread_busy numa thread parada, sem Parar para destravar) — pior que o `error` que a feature veio substituir. A suíte não pegou porque testava que o estado era TERMINAL e nunca que era USÁVEL; TURN_STATE_BUCKETS agora cobra a partição exata e um teste cobra que todo estado assentado aceita follow_up. Achado só no smoke ao vivo`
- `Chat · Histórico paginado · Sempre paginar GET /history por keyset sobre seq (limit/before/hasMore/cursor), nunca por offset, porque mensagem nova entre duas leituras desloca offset e duplica ou pula linha justo na thread viva. seq é contador ÚNICO por thread — nextSeq tira MAX de messages E tool_calls —, então a faixa recorta as duas tabelas em sincronia e os índices ix_*_thread_seq já existentes bastam. Nunca chavear tool call da janela por message_id (nullable: perde toda tool call sem mensagem, em silêncio) e nunca deixar o piso da última página no cursor: tool call com seq anterior à mensagem mais antiga não é alcançável por página nenhuma e some do histórico inteiro (toolCallWindowStart devolve 0 quando !hasMore). Rota de grafo separada (F29 lê a thread inteira sem corpo de resultado); `limit` gigante no history seria o teto disfarçado de volta NO RENDERER: Sempre unir por seq (unionBySeq) quando o histórico que chega é da MESMA thread já em memória, e só substituir (mergeById) quando a thread muda — por isso o estado carrega historyThreadId. mergeById substitui a lista pela recebida, que é o certo com histórico inteiro e exatamente errado com janela: o refetch da janela recente derruba as páginas antigas que o usuário acabou de carregar. O cursor só RECUA: janela recente rebuscada traz cursor mais novo e adotá-lo faria o botão reoferecer página já na tela`
- `Workspace · Composer · Sempre fotografar texto+imagens+anexos explícitos antes de clearDraftAfterSend e devolvê-los quando o envio não acontece (res.error, throw, sendFollowUp === false) porque o composer é limpo no otimismo e recusa do backend (thread_busy, teto de consumo, rede) apagava o prompt digitado; restaurar de composer.attachments, nunca da lista derivada composerAttachments, senão o contexto implícito do arquivo aberto vira chip fixo. Mensagem de recusa lida pelo usuário não leva id interno: LeaseBusyError guarda projectId em info/details e o texto fala do projeto`

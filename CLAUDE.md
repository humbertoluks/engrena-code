# CLAUDE.md

Orientações para Claude Code ao trabalhar neste repositório.

## Meta-instruções

Leia este arquivo antes de qualquer tarefa. Aplique todas as regras em "REGRAS APRENDIDAS".
Ao final de cada tarefa: se o usuário corrigiu algo ou você descobriu padrão não-óbvio, adicione regra.
Regra: `Origem · Categoria · [Sempre/Nunca] X porque Y`.
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

- `Setup · TypeScript ESM · Sempre adicionar __dirname via fileURLToPath em src/main/index.ts porque ES modules não exportam __dirname nativo`
- `Setup · Electron · Sempre manter preload em CommonJS (require) nunca ESM (import) porque contextBridge não é exportado em ESM`
- `Setup · Build · Sempre adicionar "main": "dist-electron/index.js" e "description"/"author" em package.json porque electron-builder falha sem`
- `Setup · Dependencies · Nunca adicionar electron/electron-builder em dependencies, apenas devDependencies porque o builder recusa`
- `Dev · Vite · Nunca configure orquestração extra no script "dev", vite-plugin-electron gerencia main+renderer automaticamente`
- `Dev · React · Sempre carregar a skill /vercel-react-best-practices no início de qualquer sessão que envolva código (TS/TSX, rotas, server actions, Prisma) porque performance e padrões React devem orientar geração e review desde o começo`
- `Design · Tema · Sempre persistir tema em localStorage chave engrenacode:theme (light|dark|system) e hexes só em :root/.dark; Tailwind 4 via @theme inline, nunca tailwind.config.ts clássico`
- `Setup · Electron · Nunca declarar main e preload só com entry no vite-plugin-electron porque ambos são index.ts e colidem em dist-electron/index.js; preload usa build.lib com formats ['cjs'] e fileName preload.cjs`
- `Setup · Electron · Em produção sempre loadFile(path.join(__dirname, '../dist/index.html')); nunca file:// + ../../../dist porque files do builder empacota dist ao lado de dist-electron e file:// quebra path no Windows`
- `Design · Tailwind 4 · Nunca usar max-w-/w-/h- com sufixo xs|sm|md|lg|xl porque --spacing-* do Design Lock alimenta sizing e vence --container-* (max-w-sm vira 8px e colapsa o card); usar valor explícito max-w-[24rem]`
- `Design · Tailwind 4 · Sempre envolver CSS de elemento em @layer base porque @import 'tailwindcss' põe utilitários em @layer utilities e regra sem layer vence layer, anulando p-*/m-*; nunca repetir reset margin/padding/box-sizing, o preflight já faz`
- `Design · Processo · Sempre escrever ui.md (anatomia + tabela de copy + referência) e compor via primitives antes de implementar tela porque tokens sozinhos não garantem fidelidade visual`
- `Marca · Naming · Nunca usar LionCode/lioncode, LionClaw, LionLabs nem LionSprite em UI, copy, smoke ou docs; só EngrenaCode/engrenacode. Em docs/_reversa: marca = "sistema legado"; Design Lock LionClaw → Design Lock; LionLabs Grotesk → experimento Grotesk; LionSprite → EngrenaSprite. Em smoke, assertar EngrenaCode presente — nunca wait por Lion*`
- `Smoke · Electron real · Sempre passar dangerouslyDisableSandbox:true ao rodar pnpm dev (Electron real) via Bash tool porque o sandbox padrão bloqueia GPU/network process do Electron ("Network service crashed"/"GPU process exited") e o processo cai silencioso com exit 0, sem log de erro óbvio`
- `Smoke · Turno real CLI · Nunca deixar ANTHROPIC_API_KEY setada no shell ao subir pnpm dev para turno real porque o processo filho claude herda a env var e autentica por API key (saldo pode ser zero) em vez da sessão de assinatura já logada no binário; unsetar antes do dev server subir e conferir billing em #consumo (subscription/cost_source=sdk confirma)`
- `Runner · Claude CLI · Supervised usa --permission-mode auto + --settings com hook PreToolUse (permission-broker.ts/permission-hook.ts) porque manual/dontAsk/default negam toda tool por decision_reason_type:"mode" antes do hook rodar — permissionDecision:"allow" do hook é ignorado nesses modos; só sob auto o hook tem autoridade real de allow/deny. settings.json exige wrapper {"hooks":{"PreToolUse":[...]}}, não a forma "direta" sem wrapper que a doc pública mostra — confirmado ao vivo contra claude-code 2.1.226, sem esse wrapper o hook nunca dispara`
- `Runner · Claude CLI · Sempre incluir hookEventName:'PreToolUse' no hookSpecificOutput do hook de permissão porque sem esse campo o CLI dispara o hook, ignora a decisão em silêncio e cai no default headless que nega escrita ("Claude requested permissions to write to X, but you haven't granted it yet") — o agente então pede confirmação em prosa e encerra o turno, sem modal e sem arquivo. Decidir por stdout + exit 0 nos dois casos (allow e deny): é onde permissionDecisionReason chega limpo ao modelo`
- `Runner · Claude CLI · Follow-up de thread Claude sempre passa --resume <session_id> (persistido em threads.cli_session_id a partir do session_id do stream-json) porque -p sem resume abre conversa nova: responder "Sim" a uma pergunta do agente virava turno sem contexto ("Qual tarefa?")`
- `Workspace · Permissão · Clique no card de permissão só preenche o composer (Permitir/Negar/…); a concessão real é o Enviar ou o texto digitado (sim/não/permitir todos), porque resolver no clique direto contradizia o contrato de opções→composer e a IA inventava “só pelo botão”`
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
- `Segredo · stderr · Sempre atualizar sanitizeProcessError no mesmo diff ao adicionar scheme de URL autenticada (oauth2:/x-token-auth:/https://:token@) ou prefixo de provider (xai-/gsk_/…) porque git push/CLI pode ecoar o segredo na message que chega à UI`
- `Validação · shared · Sempre importar validate*Key/token de módulo puro (provider-keys/github-token) no *.logic.ts do renderer em vez de re-declarar literals; import de valor só se o módulo não puxar Node/fs/electron`
- `Segredo · Regex · Nunca reordenar ou "simplificar" as regex de sanitizeProcessError: o encurtamento de path roda antes da redação (senão o regex de path come o marcador ***@host/org/repo.git) e a senha do userinfo genérico exclui '*' inicial (senão o padrão re-casa x-access-token:***@ e apaga o rótulo)`
- `Skills · Manutenção · Nunca gravar dado volátil (n testes verdes, "os 12 handlers", data de passagem) em coding-*/rules/ nem SKILL.md de roteamento; IDs RC-*/abertos e mapa de paths ficam em coding-*/project.md; número/data/evidência só em apps/engrena-code/docs/AUDIT-CODE-REVIEW.md, porque snapshot volátil envelhece e a próxima sessão age sobre fato falso`
- `Skills · Estrutura · Sempre manter SKILL.md como roteamento; material auxiliar em references/*.md (playwright-cli/spec-writer) ou, nas coding-*, em rules/*.md (regras portáveis Incorrect/Correct) + project.md (bindings do repo); frontmatter+corpo do SKILL entram no contexto sempre e o resto só sob demanda`
- `Teste · Flaky · Sempre rodar pnpm test duas vezes antes de tratar vermelho como regressão: git-client/git-handler/delegate/pipeline-runner usam git e spawn reais (8–16 s por arquivo) contra testTimeout default de 5 s e estouram sob carga; caso novo com processo real nasce com testTimeout explícito`
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

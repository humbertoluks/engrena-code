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
- `Workspace · Permissão · Com PermissionPrompt aberto, texto livre no composer não entra na fila de follow-up (só sim/não mapeiam para allow/deny) porque a fila reenviava a resposta como prompt novo depois do turno, criando o turno órfão sem contexto`
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
- `Workspace · Access · Sempre persistir accessLevel via PATCH /api/threads/:id ao mudar a pill (e rehidratar do selectedThread) porque draft-only não atualiza DB/sidebar; upgrade fora de supervised mid-turn libera o permission broker e auto-allow tools seguintes`
- `Runner · Processos · Nunca matar por nome genérico (Stop-Process -Name node / pkill node); sempre kill-by-port ou PID — regra injetada em RUNTIME_SAFETY_PROMPT porque kill-by-name derruba Electron/Vite e entra em loop de permissão`
- `Workspace · Chat · Sempre pintar bolha otimista do usuário no envio (pendingMessages.logic: sending/sent/queued/permission, reconciliada por conteúdo no GET /history) porque o chat só re-busca histórico em tool_call.start/state.change e turno longo deixava a mensagem invisível por ~1 min; fila e resposta de permissão também precisam de bolha, senão o usuário reenvia`
- `Workspace · Chat · Nunca deixar refetch de histórico disparado pelo stream ligar historyLoading/historyError (loadHistory(id,{background:true})) e nunca guardar expansão de Work log só no DOM do <details> porque trocar a árvore por "Carregando…" joga o scroll ao topo e fecha o work log no meio da análise; scroll do chat é programático via useChatScroll + [overflow-anchor:none], com CTA "Ver mensagem" quando a resposta chega fora de vista`
- `Workspace · Permission · Permitir todos grava toolName na allowlist da thread (sessão do processo) e auto-allow no broker sem UI — equivalente Claude Code “don’t ask again”; limpar allowlist no DELETE da thread`

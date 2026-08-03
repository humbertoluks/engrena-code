# Inventário — sistema legado

> Gerado pelo Scout em 2026-07-28  
> Confiança: 🟢 CONFIRMADO (extraído da árvore e configs do repositório)

## Resumo

| Campo | Valor |
|-------|-------|
| Projeto | sistema legado — IDE desktop para orquestração de agentes de IA |
| Tipo | Monorepo pnpm (Electron local-first) |
| Linguagem principal | TypeScript (~805 arquivos `.ts`/`.tsx`) |
| Total de arquivos (excl. deps/build) | ~881 |
| Gerenciador | pnpm (workspace) |
| Node | >= 20 |
| Banco | SQLite via `better-sqlite3` (64 migrations em `packages/server/src/db/migrations`) |
| Testes | ~263 arquivos `*.test.*` / `*.spec.*` (node:test, Vitest, Playwright) |

## Estrutura de pastas (raiz)

```
sistema-legado/
├── package.json              # workspace root (scripts build/app/e2e/validate)
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── playwright.config.ts      # e2e hermético
├── playwright.live.config.ts # e2e live smoke
├── README.md
├── LICENSE
├── AGENTS.md / CLAUDE.md / .cursorrules
├── assets/                   # logos light/dark
├── docs/                     # DEVELOPMENT.md, write-parallel-live-smokes.md
├── scripts/                  # validate, rebuild-native, icons, linux desktop
├── shared/                   # @lioncode/shared — contratos/tipos
├── packages/
│   ├── shell/                # @lioncode/shell — Electron main/preload
│   ├── server/               # @lioncode/server — HTTP+WS local + domínio
│   └── renderer/             # @lioncode/renderer — React/Vite UI
├── mcp-servers/              # MCPs empacotados (Cartesia, ElevenLabs, Linear, n8n, Slack, bridges)
├── tests/                    # Playwright e2e
├── .agents/ / .claude/       # skills Reversa (instalação)
└── .reversa/                 # estado do framework Reversa
```

## Módulos identificados

| Módulo | Caminho | Papel |
|--------|---------|-------|
| `shell` | `packages/shell` | Processo Electron (main, preload, janela, tray) |
| `shared` | `shared` | Tipos e contratos compartilhados (`@lioncode/shared`) |
| `server-core` | `packages/server/src` (server, http, middleware, db) | Bootstrap HTTP+WS, SQLite, auth de sessão |
| `providers` | `packages/server/src/providers` | Drivers Claude, Codex, GLM, MiniMax, Grok, Kimi |
| `runner` | `packages/server/src/runner` | Dispatch, subagents, feature pipeline/build, validators |
| `git` | `packages/server/src/git` | Status, commit, push, PR, worktrees, locks |
| `vault` | `packages/server/src/vault` | Cofre local cifrado (credenciais) |
| `mcp` | `packages/server/src/mcp` + rotas MCP | Catálogo, OAuth, secrets de MCP |
| `memory` | `packages/server/src/memory` | journal.md, memory.md, dreaming/consolidação |
| `codegraph` | `packages/server/src/codegraph` | Índice de grafo de código por projeto |
| `metrics` | `packages/server/src/metrics` | Tokens, custo, pricing |
| `terminal` | `packages/server/src/terminal` | PTY / execução de terminal |
| `renderer` | `packages/renderer` | UI React (screens, composer, diffs, config) |
| `mcp-servers` | `mcp-servers/*` | Servers MCP bundled (integrações externas) |

## Pacotes do workspace

| Pacote | Nome npm | Entry |
|--------|----------|-------|
| Root | `lioncode` | scripts de orquestração |
| Shared | `@lioncode/shared` | `shared/src/index.ts` → dist |
| Server | `@lioncode/server` | `packages/server/src/index.ts` / `server.ts` |
| Renderer | `@lioncode/renderer` | `packages/renderer/src/main.tsx` |
| Shell | `@lioncode/shell` | `packages/shell/src/main.ts` |
| MCP Cartesia | `@lioncode/mcp-cartesia` | `mcp-servers/cartesia` |
| MCP ElevenLabs | `@lioncode/mcp-elevenlabs` | `mcp-servers/elevenlabs` |
| MCP Linear | `@lioncode/mcp-linear` | `mcp-servers/linear` |
| MCP n8n | `@lioncode/mcp-n8n` | `mcp-servers/n8n` |
| MCP Slack | `@lioncode/mcp-slack` | `mcp-servers/slack` |
| Secret wrapper | `@lioncode/mcp-secret-wrapper` | `mcp-servers/lioncode-secret-wrapper` |
| Subagents bridge | `@lioncode/mcp-subagents-bridge` | `mcp-servers/lioncode-subagents` |

## Pontos de entrada

| Path | Tipo |
|------|------|
| `packages/shell/src/main.ts` | Electron main |
| `packages/shell/src/preload.ts` | Electron preload |
| `packages/server/src/server.ts` / `index.ts` | Server bootstrap (HTTP+WS no main) |
| `packages/renderer/src/main.tsx` | Renderer React |
| `packages/renderer/src/App.tsx` | App shell UI |
| `shared/src/index.ts` | Barrel de contratos |

## Configuração

| Arquivo | Uso |
|---------|-----|
| `package.json` | Scripts monorepo (`build`, `app`, `e2e`, `validate`) |
| `pnpm-workspace.yaml` | Members: shared, packages/*, mcp-servers/* |
| `tsconfig.base.json` | TS compartilhado |
| `packages/renderer/vite.config.ts` | Build Vite |
| `packages/renderer/tailwind.config.ts` | Tailwind |
| `playwright.config.ts` | E2E hermético |
| `playwright.live.config.ts` | E2E live smoke |
| `scripts/validate.mjs` | Validação pré-release |
| `scripts/rebuild-native.mjs` | Rebuild better-sqlite3 / node-pty |

## CI/CD e Docker

- **CI/CD:** nenhum workflow `.github/workflows` presente no repositório (🟢 ausente).
- **Docker:** sem `Dockerfile` / `docker-compose` (🟢 ausente). App empacotado via Electron.

## Banco de dados (superficial)

- Persistência local SQLite (`better-sqlite3`).
- Migrations: `packages/server/src/db/migrations/` (001–062 + index/types) — **64 arquivos**.
- Repositórios: `packages/server/src/db/repositories/` (projects, threads, messages, skills, mcps, rules, subagents, feature-builds/pipelines, pricing, codegraph, etc.).
- Seeds de catálogo/dev em `packages/server/src/db/seeds/`.
- Análise detalhada: agente **Data Master**.

## Integrações externas (detectadas)

| Integração | Evidência |
|------------|-----------|
| Anthropic Claude Agent SDK | `@anthropic-ai/claude-agent-sdk`, driver `claude-agent.ts` |
| Codex CLI | driver `codex.ts`, auth `~/.codex` |
| GLM / MiniMax | drivers Claude-compatible via base URL + keys no cofre |
| Grok (ACP) | `grok-acp.ts` |
| Kimi (ACP) | `kimi-acp.ts` |
| MCP SDK | `@modelcontextprotocol/sdk` |
| Agent Client Protocol | `@agentclientprotocol/sdk` |
| GitHub (PR/remote) | rotas `open-pr`, `publish-repository`, git providers |
| Cartesia / ElevenLabs | MCP servers de voz/TTS |
| Linear / Slack / n8n | MCP servers de integração |
| OpenAI / Groq | transcrição de voz (README + rotas transcription) |

## UI (renderer)

Rotas hash (`packages/renderer/src/router/routes.ts`):  
`login`, `principal`, `consumo`, `registros`, `subagents`, `skills`, `mcps`, `rules`, `configuracao`.

## Cobertura de testes

| Camada | Framework | Onde |
|--------|-----------|------|
| Unit/integration server | Node.js `node:test` | `packages/server/test/`, `src/**/*.test.ts` |
| Unit renderer | Vitest + Testing Library | `packages/renderer/src/**/*.test.*` |
| Shell | Node test | `packages/shell/test/` |
| MCP | Node test | `mcp-servers/*/test/` |
| E2E | Playwright | `tests/*.spec.ts` (~18 specs) |

Estimativa: **~263** arquivos de teste no monorepo.

## Sugestão de organização das specs

**Granularidade sugerida:** `hybrid`

Razão: monorepo com pacotes por camada (`shell`/`server`/`renderer`/`shared`) e, ao mesmo tempo, roteamento HTTP centralizado (~88 rotas em `packages/server/src/routes/`) e telas por hash no renderer.

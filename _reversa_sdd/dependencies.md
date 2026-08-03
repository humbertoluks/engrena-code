# Dependências — sistema legado

> Gerado pelo Scout em 2026-07-28  
> Fonte: `package.json` de cada pacote do workspace  
> Confiança: 🟢 CONFIRMADO

## Gerenciador

- **pnpm** (workspace) — `pnpm-lock.yaml` + `pnpm-workspace.yaml`
- Node **>= 20**
- Builds nativos permitidos: `better-sqlite3`, `electron`, `esbuild`, `node-pty`

## Root (`lioncode`)

| Pacote | Versão | Tipo |
|--------|--------|------|
| `@playwright/test` | ^1.61.1 | dev |
| `typescript` | ^5.5.4 | dev |

Scripts principais: `build`, `typecheck`, `app`, `e2e:hermetic`, `e2e:live-smoke`, `validate`, `rebuild:electron`, `rebuild:node`.

## `@lioncode/shared`

Sem runtime deps. Apenas `typescript` ^5.5.4 (dev).

## `@lioncode/server`

### Runtime

| Pacote | Versão | Papel |
|--------|--------|-------|
| `@lioncode/shared` | workspace:* | Contratos |
| `@anthropic-ai/claude-agent-sdk` | ^0.3.177 | Provider Claude / compat |
| `@agentclientprotocol/sdk` | 1.2.1 | ACP (Grok/Kimi) |
| `@modelcontextprotocol/sdk` | ^1.29.0 | MCP |
| `better-sqlite3` | ^12.10.1 | SQLite local |
| `node-pty` | ^1.1.0 | Terminal PTY |
| `zod` | 4.4.3 | Validação |
| `typescript` | ^5.5.4 | (listado em dependencies) |

### Dev

| Pacote | Versão |
|--------|--------|
| `@types/better-sqlite3` | ^7.6.13 |
| `@types/node` | ^20.14.0 |

## `@lioncode/renderer`

### Runtime

| Pacote | Versão | Papel |
|--------|--------|-------|
| `@lioncode/shared` | workspace:* | Contratos |
| `react` / `react-dom` | ^18.3.1 | UI |
| `@xterm/xterm` | ^6.0.0 | Terminal embutido |
| `@xterm/addon-fit` | ^0.11.0 | Fit do xterm |
| `react-markdown` | ^10.1.0 | Markdown no chat |
| `remark-gfm` / `remark-breaks` | ^4 / ^4 | GFM |
| `rehype-raw` / `rehype-sanitize` | ^7 / ^6 | HTML sanitizado |
| `shiki` | ^4.2.0 | Syntax highlight |
| `@fontsource-variable/dm-sans` | ^5.2.8 | Tipografia |
| `@fontsource-variable/figtree` | ^5.2.10 | Tipografia |
| `@fontsource-variable/jetbrains-mono` | ^5.2.8 | Mono |

### Dev

| Pacote | Versão | Papel |
|--------|--------|-------|
| `vite` | ^5.3.4 | Bundler |
| `@vitejs/plugin-react` | ^4.3.1 | React plugin |
| `vitest` | ^2.1.9 | Testes |
| `@testing-library/react` | ^16.3.2 | Testes UI |
| `tailwindcss` | ^3.4.6 | CSS |
| `postcss` / `autoprefixer` | ^8 / ^10 | CSS pipeline |
| `jsdom` | ^25.0.1 | Ambiente de teste |
| `typescript` | ^5.5.4 | Tipos |

## `@lioncode/shell`

### Runtime

| Pacote | Versão |
|--------|--------|
| `@lioncode/server` | workspace:* |
| `@lioncode/shared` | workspace:* |

### Dev

| Pacote | Versão | Papel |
|--------|--------|-------|
| `electron` | ^33.4.11 | Runtime desktop |
| `cross-env` | ^7.0.3 | Dev com Vite |
| `@types/node` | ^20.14.0 | Tipos |
| `typescript` | ^5.5.4 | Build |

## MCP servers

Dependências comuns na maioria: `@modelcontextprotocol/sdk`, `zod`.

| Pacote | Integração |
|--------|------------|
| `@lioncode/mcp-cartesia` | Cartesia (voz) |
| `@lioncode/mcp-elevenlabs` | ElevenLabs (voz) |
| `@lioncode/mcp-linear` | Linear |
| `@lioncode/mcp-n8n` | n8n |
| `@lioncode/mcp-slack` | Slack |
| `@lioncode/mcp-secret-wrapper` | Wrapper de secrets (sem deps runtime listadas) |
| `@lioncode/mcp-subagents-bridge` | Bridge de subagents do sistema legado |

## Dependências críticas (visão rápida)

| Área | Stack |
|------|-------|
| Desktop | Electron 33 |
| UI | React 18 + Vite 5 + Tailwind 3 |
| Backend local | TypeScript Node + HTTP/WS embutido |
| Persistência | better-sqlite3 |
| Agentes | Claude Agent SDK, Codex CLI, ACP (Grok/Kimi) |
| Extensibilidade | MCP SDK |
| Validação | Zod 4 |
| Testes | node:test, Vitest, Playwright |

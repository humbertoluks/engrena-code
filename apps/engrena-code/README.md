# EngrenaCode

IDE desktop local-first (Electron) para orquestrar agentes de IA (Claude, Codex, Kimi — Minimax via API key) no seu próprio repositório: histórico de conversa, revisão de diffs arquivo a arquivo e fluxo GitHub (commit, push, PR) na mesma tela.

App do monorepo Engrena (`apps/engrena-code`). Nada do seu código passa por servidor remoto: o app roda 100% local, com cofre cifrado (`vault.enc`) e um servidor HTTP/WS em loopback (`127.0.0.1`).

## Stack

- Electron + Vite (`vite-plugin-electron`) + React 19 + TypeScript
- Tailwind CSS 4 (tokens via `@theme inline`, sem `tailwind.config.ts` clássico)
- SQLite (`node:sqlite`) local-first, sem Postgres/Docker
- Vitest para testes unitários/integração
- Biome para lint/format

## Pré-requisitos

- Node.js ≥ 18 (recomendado 20+)
- pnpm ≥ 8
- Git
- Opcional, para turnos reais de agente: binário `claude` e/ou `codex`/`kimi` no PATH, autenticado

## Setup

Na raiz do monorepo:

```bash
pnpm install
cp apps/engrena-code/.env.example apps/engrena-code/.env.local
pnpm --filter engrena-code dev
```

`pnpm --filter engrena-code dev` sobe o Vite (renderer) e o Electron (main + preload) juntos via `vite-plugin-electron`. O servidor de unlock do vault fica fixo em `127.0.0.1:5174`; nunca reutilize essa porta para o Vite.

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm --filter engrena-code dev` | Ambiente de desenvolvimento (Vite + Electron) |
| `pnpm --filter engrena-code build` | `tsc -b && vite build && electron-builder` |
| `pnpm --filter engrena-code preview` | Preview do build do renderer |
| `pnpm --filter engrena-code test` | Suite Vitest (unit/integração) |
| `pnpm --filter engrena-code lint` / `format` | Biome |

Atalhos na raiz (`pnpm dev`, `pnpm test`, …) delegam a este package.

## Documentação

| Onde | O quê |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Visão de produto, features, critérios de aceitação |
| [`docs/PROGRESS.md`](docs/PROGRESS.md) | Status real por feature |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Setup, dependências, build, troubleshooting |
| `docs/F0*-*/{spec,plan,ui,copy}.md` | Spec técnica, plano, UI e copy por feature |
| [`../../docs/design-system`](../../docs/design-system) | Design Lock (Engrena, raiz do monorepo) |
| [`../../CLAUDE.md`](../../CLAUDE.md) | Convenções do monorepo |

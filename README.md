# EngrenaCode

IDE desktop local-first (Electron) para orquestrar agentes de IA (Claude, Codex, Kimi — Minimax via API key) no seu próprio repositório: histórico de conversa, revisão de diffs arquivo a arquivo e fluxo GitHub (commit, push, PR) na mesma tela.

Nada do seu código passa por servidor remoto: o app roda 100% local, com cofre cifrado (`vault.enc`) e um servidor HTTP/WS em loopback (`127.0.0.1`).

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

```bash
pnpm install
cp .env.example .env.local   # ajustar VITE_DEV_SERVER_URL se a porta 5173 estiver ocupada
pnpm dev
```

`pnpm dev` sobe o Vite (renderer) e o Electron (main + preload) juntos via `vite-plugin-electron` — sem orquestração extra. O servidor de unlock do vault fica fixo em `127.0.0.1:5174`; nunca reutilize essa porta para o Vite.

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | Ambiente de desenvolvimento (Vite + Electron) |
| `pnpm build` | `tsc -b && vite build && electron-builder` — gera instaladores em `dist/` |
| `pnpm preview` | Preview do build do renderer |
| `pnpm test` | Suite Vitest (unit/integração) |
| `pnpm lint` / `pnpm format` | Biome |

## Estrutura

Layout híbrido: infra compartilhada em camadas (`main`/`preload`/`renderer`/`services`/`db`), features de produto colocalizadas em `src/features/<slug>/`.

```
src/
  main/        # Electron main: janela, IPC, bootstrap do HTTP local
  preload/     # Bridge IPC (contextBridge, CommonJS)
  renderer/    # App React: screens de infra, design system, hooks
  db/          # Schema e migrations (SQLite)
  services/    # Infra/domínio compartilhado (vault, handlers HTTP, providers, github, mcps, runner)
  features/    # workspace, dashboard, skills, rules, subagents, registros, consumo
```

Detalhes de arquitetura, correções aplicadas e troubleshooting: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Documentação

| Onde | O quê |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Visão de produto, features F01–F11, critérios de aceitação |
| [`docs/PROGRESS.md`](docs/PROGRESS.md) | Status real por feature neste repo (feito vs pendente) |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Setup, dependências, build, troubleshooting |
| `docs/F0*-*/{spec,plan,ui,copy}.md` | Spec técnica, plano, UI e copy por feature |
| `CLAUDE.md` | Convenções e regras aprendidas para trabalhar neste repo com Claude Code |

## Testes e smoke

- Unit/integração: `pnpm test` (Vitest).
- Smoke visual (Electron + Playwright): ambiente isolado via `ENGRENACODE_USER_DATA` apontando para um diretório temporário — nunca toca o vault real do usuário. Resultados documentados em `docs/F0*-*/smoke-results.md`.

---
name: coding-electron
description: >-
  Applies portable Electron coding patterns for main, preload, IPC and PTY:
  secure BrowserWindow flags, named contextBridge methods, CommonJS preload,
  native-only IPC, PTY env allowlists, and correct Vite/Electron packaging.
  Use when writing or editing Electron main/preload, IPC channels, or PTY hosts.
  Read rules/*.md for the matched concern; read project.md for this repository's
  path and audit bindings.
---

# Coding — Electron

Guia proativo para **escrever** código Electron. Não é review: aplique antes de o código existir.

**Camadas:** `SKILL.md` · `rules/*.md` · `project.md`.

## When to Apply

- Main process, preload, IPC channels, PTY host
- Mudança em `BrowserWindow` / `webPreferences` / packaging Vite+Electron

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Isolation | CRITICAL | `isolation-` |
| 2 | Preload | CRITICAL | `preload-` |
| 3 | IPC | HIGH | `ipc-` |
| 4 | Process | HIGH | `process-` |
| 5 | Build | HIGH | `build-` |

## Quick Reference

### Isolation
- `isolation-secure-window` — nodeIntegration off, contextIsolation on
- `isolation-no-dead-scaffold` — delete or wire dead scaffolds

### Preload
- `preload-named-methods-only` — named methods only, no passthrough
- `preload-commonjs-only` — preload stays CommonJS
- `preload-serializable-only` — serializable payloads only

### IPC
- `ipc-pair-preload-main` — pair every preload method with main
- `ipc-native-capabilities-only` — IPC native-only; domain on HTTP
- `ipc-numeric-bounds` — finite bounds for numeric IPC args

### Process
- `process-pty-env-allowlist` — PTY env allowlist
- `process-electron-run-as-node` — ELECTRON_RUN_AS_NODE for script spawn

### Build
- `build-dev-url-from-env` — Vite URL from env
- `build-production-loadfile` — loadFile in production
- `build-preload-cjs-entry` — distinct CJS preload entry
- `build-esm-dirname` — __dirname via fileURLToPath in ESM main

## How to Use

Leia `rules/<slug>.md`. Bindings deste repo → `project.md`. Achados de audit → `project.md`, não `rules/`.

## New rule

Copy `rules/_template.md`. Sections: `rules/_sections.md`.

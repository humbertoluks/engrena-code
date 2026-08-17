# CLAUDE.md — regras arquivadas

Regras que saíram do `CLAUDE.md` ativo por já estarem **materializadas no repositório**: descrevem
configuração one-time que hoje vive commitada em `package.json`, `vite.config.ts`, `tsconfig`,
`src/main/index.ts` e no CSS do Design Lock. Continuam verdadeiras — só não guiam mais decisão nova,
porque quebrar qualquer uma delas exigiria desfazer config existente, não escrever código novo.

Arquivadas em 2026-08-17, quando o `CLAUDE.md` bateu o limite de consolidação.
Se alguma voltar a ser decisão viva (migração de build, troca de bundler, novo app no monorepo),
traga a linha de volta para o arquivo ativo.

## Setup e build (F01/F01.1)

- `Setup · TypeScript ESM · Sempre adicionar __dirname via fileURLToPath em src/main/index.ts porque ES modules não exportam __dirname nativo`
- `Setup · Electron · Sempre manter preload em CommonJS (require) nunca ESM (import) porque contextBridge não é exportado em ESM`
- `Setup · Build · Sempre adicionar "main": "dist-electron/index.js" e "description"/"author" em package.json porque electron-builder falha sem`
- `Setup · Dependencies · Nunca adicionar electron/electron-builder em dependencies, apenas devDependencies porque o builder recusa`
- `Dev · Vite · Nunca configure orquestração extra no script "dev", vite-plugin-electron gerencia main+renderer automaticamente`
- `Design · Tema · Sempre persistir tema em localStorage chave engrenacode:theme (light|dark|system) e hexes só em :root/.dark; Tailwind 4 via @theme inline, nunca tailwind.config.ts clássico`
- `Setup · Electron · Nunca declarar main e preload só com entry no vite-plugin-electron porque ambos são index.ts e colidem em dist-electron/index.js; preload usa build.lib com formats ['cjs'] e fileName preload.cjs`
- `Setup · Electron · Em produção sempre loadFile(path.join(__dirname, '../dist/index.html')); nunca file:// + ../../../dist porque files do builder empacota dist ao lado de dist-electron e file:// quebra path no Windows`
- `Design · Tailwind 4 · Nunca usar max-w-/w-/h- com sufixo xs|sm|md|lg|xl porque --spacing-* do Design Lock alimenta sizing e vence --container-* (max-w-sm vira 8px e colapsa o card); usar valor explícito max-w-[24rem]`
- `Design · Tailwind 4 · Sempre envolver CSS de elemento em @layer base porque @import 'tailwindcss' põe utilitários em @layer utilities e regra sem layer vence layer, anulando p-*/m-*; nunca repetir reset margin/padding/box-sizing, o preflight já faz`

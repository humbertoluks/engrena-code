# CLAUDE.md

Orientações para Claude Code ao trabalhar neste repositório.

## Meta-instruções

Leia este arquivo antes de qualquer tarefa. Aplique todas as regras em "REGRAS APRENDIDAS".
Ao final de cada tarefa: se o usuário corrigiu algo ou você descobriu padrão não-óbvio, adicione regra.
Regra: `Origem · Categoria · [Sempre/Nunca] X porque Y`.
Limite deste arquivo: 120 linhas. Ao atingir 110, consolide regras antigas em `docs/archived/CLAUDE_ARCHIVE.md`.

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

**EngrenaCode** — IDE desktop Electron local-first para orquestração de agentes de IA (Claude, Codex, Kimi) com vault cifrado, workspace com diffs, skills/rules/subagents reutilizáveis e auditoria. MVP: F01–F07.

---

## Docs de Referência

Leia apenas os arquivos relevantes para a tarefa em andamento:

| Arquivo | Quando ler |
|---------|------------|
| `docs/PROGRESS.md` | Status real F01–F11 neste repo (feito vs pendente); não usar `_reversa_forward` actions como progresso |
| `docs/PRD.md` | Visão completa, features F01–F11, critérios de aceitação |
| `docs/DEVELOPMENT.md` | Setup inicial, deps, vite/biome/tsconfig, correções aplicadas, dev/build |
| `docs/F01-vault-e-sessao-local/spec.md` | Spec de Vault: encryption, unlock gate, IPC, erro handling |
| `docs/F01-vault-e-sessao-local/plan.md` | Plano de implementação, arquivos, integração |
| `docs/F01.1-design-system/spec.md` | Tokens, tema tri-modo, Shiki/xterm, superfícies |
| `docs/design-system/` | Design Lock: hexes, spacing, tipografia |

---

## Definition of Done

Tarefa concluída quando:
- Código implementado segue padrões em REGRAS APRENDIDAS
- TypeScript type-safe, zero `any` sem justificativa
- Compilação sucede (`pnpm build`)
- Testes passam se há spec
- Performance review completa (React patterns via /vercel-react-best-practices)
- CLAUDE.md atualizado se padrão novo descoberto

---

## DESENVOLVIMENTO
- Sempre carregar a skill /vercel-react-best-practices no início de qualquer sessão que envolva código (TS/TSX, rotas, server actions, Prisma) porque performance e padrões React devem orientar geração e review desde o começo


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
- `Marca · Naming · Nunca usar LionCode/lioncode como marca em UI, copy, smoke ou docs de produto; só EngrenaCode/engrenacode. Em `_reversa_*`, marca = "sistema legado". Em smoke, assertar EngrenaCode presente — nunca wait por LionCode`

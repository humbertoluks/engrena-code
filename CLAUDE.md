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
| `prd-engrenacode.md` | Visão completa, features F01–F11, critérios de aceitação |
| `docs/DEVELOPMENT.md` | Setup inicial, deps, vite/biome/tsconfig, correções aplicadas, dev/build |
| `docs/F01-vault-e-sessao-local/spec.md` | Spec de Vault: encryption, unlock gate, IPC, erro handling |
| `docs/F01-vault-e-sessao-local/plan.md` | Plano de implementação, arquivos, integração |

---

## REGRAS APRENDIDAS

- `Setup · TypeScript ESM · Sempre adicionar __dirname via fileURLToPath em src/main/index.ts porque ES modules não exportam __dirname nativo`
- `Setup · Electron · Sempre manter preload em CommonJS (require) nunca ESM (import) porque contextBridge não é exportado em ESM`
- `Setup · Build · Sempre adicionar "main": "dist-electron/index.js" e "description"/"author" em package.json porque electron-builder falha sem`
- `Setup · Dependencies · Nunca adicionar electron/electron-builder em dependencies, apenas devDependencies porque o builder recusa`
- `Dev · Vite · Nunca configure orquestração extra no script "dev", vite-plugin-electron gerencia main+renderer automaticamente`

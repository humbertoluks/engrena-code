---
name: audit-full-base
description: Orquestra auditoria full-base do EngrenaCode — dispara review-architecture, review-robustness e review-delivery em sequência com subagentes de contexto limpo, consolida achados em docs/AUDIT-CODE-REVIEW.md (Stack tech, regras deduplicadas, problemas corrigidos). Use ao pedir reauditoria, “rodar as 3 reviews”, auditoria da base completa, ou quando o diff default das skills individuais estiver vazio e o escopo for src/.
---

# Audit — Full base

Coordenação **somente leitura** das três frentes de revisão. Escreve/atualiza o artefato de auditoria; **não** edita `src/` salvo pedido explícito de correção depois do relatório.

**Idioma:** artefato e relatos em português do Brasil. Paths, símbolos, códigos de erro e commits permanecem em inglês.

## Quando usar

- Pedido explícito de reauditoria / “rodar as 3 reviews” / auditoria da base.
- Escopo é a base atual em `src/` (não só `git diff` do branch).
- Precisa de artefato persistente para agentes especializados por **Stack** (ex.: Electron, React, Node.js).

Para revisar **só um diff/PR/feature**, use diretamente `review-architecture`, `review-robustness` ou `review-delivery` — não esta skill.

## Orquestração

```
coordenador (esta skill)
  → subagente 1: review-architecture   (contexto limpo, leitura absoluta)
  → subagente 2: review-robustness     (contexto limpo; pode receber resumo curto dos bloqueadores da frente 1)
  → subagente 3: review-delivery       (contexto limpo; recebe lista dos achados das frentes 1–2 para fatiamento/cobertura)
  → coordenador: revisa auditorias passadas + consolida → docs/AUDIT-CODE-REVIEW.md
```

Regras do coordenador:

1. **Um subagente por vez** — nunca paralelo.
2. Cada subagente lê integralmente a `SKILL.md` da frente e executa a checklist com escopo `src/` (substitui o default “diff do branch”).
3. Subagentes em **modo leitura absoluto**: não editam, não commitam, não rodam `biome --write` / `tsc -b` / `pnpm build`. Delivery pode rodar `pnpm test` (não altera o repo).
4. Se duas frentes divergirem em fato (ex.: quem responde 423), o coordenador **rele o código** e decide antes de gravar o artefato.
5. **Não abre lote de fix** nesta skill — só registra achados abertos. Correção é trabalho posterior, por Stack.

Skills delegadas (não duplicar checklists aqui):

- `.claude/skills/review-architecture/SKILL.md`
- `.claude/skills/review-robustness/SKILL.md`
- `.claude/skills/review-delivery/SKILL.md`

## Artefato

**Caminho:** `docs/AUDIT-CODE-REVIEW.md` (arquivo vivo; cada passagem atualiza o conteúdo e registra data no cabeçalho / histórico).

### Estrutura obrigatória

1. **Cabeçalho** — data da passagem, escopo, método (`audit-full-base` + 3 reviews), contagem abertos vs corrigidos.
2. **Resumo executivo** — contagem por **Stack** e por severidade.
3. **Achados abertos** — tabela:  
   `ID | Stack | Severidade | Frente (arch/rob/del) | Local | Problema | Regra`  
   A coluna Regra aponta para a âncora da seção 4 (mesmo tipo de problema compartilha a mesma regra).
4. **Regras por Stack** — uma regra por **tipo** de problema por Stack (dedupe). Ocorrências extras só na tabela de achados.
5. **Problemas corrigidos** — mesma lógica das seções 3–4 (Stack + regra dedupe), alimentada por auditorias/commits anteriores + confirmação de que o fix ainda está no código.
6. **Fora de escopo / dívida consciente** — itens confirmados mas adiados de propósito.

### Taxonomia de Stack

Stack = tecnologia/plataforma do código tocado (serve para agentes especializados de desenvolvimento). Exemplos de naming: `Electron`, `React`, `Node.js` (não use slugs de domínio tipo `http-loopback`).

| Stack | Paths / escopo típicos neste repo |
|-------|-------------------------------------|
| `Electron` | `src/main/`, `src/preload/`, IPC, PTY host |
| `React` | `src/renderer/` (screens, components, hooks, services do renderer) |
| `Node.js` | `src/services/http/`, `vault/`, `runner/`, `git/`, `mcps/`, `codegraph/` (exceto DB puro) |
| `SQLite` | `src/services/db/` (client, migrations, repositories) |
| `TypeScript` | Achados só de tipagem/estreitamento de tipos quando não forem de uma Stack acima (raro; prefira a Stack do arquivo) |
| `Vitest` | `*.test.ts`, evidência de smoke, gates de entrega, fatiamento de commits |

Severidade: 🔴 bloqueador · 🟡 aviso · 🟢 ok (só no resumo se útil).

### Template de regra (obrigatório)

Cada tipo de problema (aberto ou corrigido) usa **exatamente** este formato. Só uma vez por tipo por Stack.

```markdown
### [Titulo]
Esforço: [estimativa de esforço]
Classificação: [Alto | Médio | Baixo]  (use Crítico quando for bloqueador de segurança/contrato)
Stack: [Electron | React | Node.js | SQLite | TypeScript | Vitest]

#### Por que isso é um problema?
[Descrição]

[Exemplo de código genérico do problema]
```
…exemplo não conforme…
```

[Descrição da correção]

[Exemplo genérico do problema corrigido]
```
…exemplo conforme…
```

#### Exceções
[Descrição da exceção, ou “Nenhuma.”]
```

### Problemas corrigidos — fontes

Ao montar a seção 5, o coordenador:

1. Lê a passagem anterior de `docs/AUDIT-CODE-REVIEW.md` (se existir).
2. Cruza remediações documentadas (commits de lotes de review, `docs/PROGRESS.md`, `docs/F*/smoke-results.md`) com o código atual.
3. Extrai de `docs/AUDIT-PRD-S9-MIGRATION.md` **apenas** lições técnicas reutilizáveis (ex.: spawn Electron sem `ELECTRON_RUN_AS_NODE`) — não importa a matriz de checkboxes de produto §9 como regra de Stack.
4. Deduplica: 1 regra por tipo por Stack; lista de evidência (commit / smoke) na tabela de corrigidos.

## Saída

- Atualiza `docs/AUDIT-CODE-REVIEW.md`.
- Relata ao usuário: contagem abertos/corrigidos, top bloqueadores, caminho do artefato.
- Não edita `src/`, não atualiza `PROGRESS.md`/`PRD.md`, não committa — a menos que o usuário peça explicitamente na mesma sessão.

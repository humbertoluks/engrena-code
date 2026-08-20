# EngrenaCode — Índice de Documentação

Bem-vindo. Este diretório contém toda a documentação de produto, desenvolvimento e auditoria do EngrenaCode.

**Atualizado:** 2026-08-19

---

## 🎯 Comece por aqui

| Você é... | Comece em | Depois leia |
|-----------|-----------|-----------|
| **Novo desenvolvedor** | [`DEVELOPMENT.md`](./DEVELOPMENT.md) | [`GLOSSARY.md`](./GLOSSARY.md) |
| **Fazendo release** | [`RUNBOOK-HOMOLOGACAO.md`](./RUNBOOK-HOMOLOGACAO.md) | [`RUNBOOK-BUILD.md`](./RUNBOOK-BUILD.md) |
| **Entendendo o produto** | [`PRD.md`](./PRD.md) | [`PROGRESS.md`](./PROGRESS.md) |
| **Revisor de features** | [`PROGRESS.md`](./PROGRESS.md) | [`PRD.md`](./PRD.md) |

---

## 📖 Documentos principais

### Produto e Strategy

- **[`PRD.md`](./PRD.md)** — Documento de Requisitos de Produto. Visão, personas, objetivos, funcionalidades (F01–F31), versões 1.0–1.4, roadmap. Fonte de verdade de produto.

- **[`PROGRESS.md`](./PROGRESS.md)** — Progresso real do MVP. Tabela de todas as features (feito vs. pendente), ondas de entrega, evidência de testes e smoke. **Leia quando:** precisa saber o estado exato de uma feature ou release.

### Desenvolvimento

- **[`DEVELOPMENT.md`](./DEVELOPMENT.md)** — Quick Start. Pré-requisitos, instalação, como rodar `pnpm dev`, troubleshooting básico. **Leia primeiro** se está clonando o repo.

- **[`RUNBOOK-BUILD.md`](./RUNBOOK-BUILD.md)** — Build, empacotamento e artefatos. Passo a passo de `pnpm build`, electron-builder, geração de `.exe`, validação. **Leia se:** está preparando um release.

### Validação

- **[`RUNBOOK-HOMOLOGACAO.md`](./RUNBOOK-HOMOLOGACAO.md)** — Checklist manual de validação. Roteiros A–D (fumaça, turno real, Git, voz), critério de aprovação, troubleshooting. Cobre F01–F30. **Leia se:** está fazendo homologação antes de liberar.

### Histórico e Arquivos

- **[`AUDIT-CODE-REVIEW.md`](./AUDIT-CODE-REVIEW.md)** — Registro de auditoria de código. Passagem 2026-08-12 + remediação 2026-08-13. **Status:** Encerrado em 2026-08-17 (zero achados abertos). Não editar.

- **[`AUDIT-PRD-S9-MIGRATION.md`](./AUDIT-PRD-S9-MIGRATION.md)** — Matriz checkbox dos critérios de aceitação PRD §9. 103 `[x]` / 0 `[ ]`. **Status:** Auditoria encerrada 2026-08-07. Não reabre.

---

## 📚 Referência

- **[`GLOSSARY.md`](./GLOSSARY.md)** — Glossário de termos técnicos (worktree, lease, dispatch, MCP, supervisado vs auto-accept, smoke, feature, onda, etc.). Leia quando encontrar jargão.

---

## 🗂️ Subpastas de features

Documentação por feature (F01–F31):

```
F01-vault-e-sessao-local/        F02-configuracao-mvp/
F03-workspace/                   F04-dashboard/
F05-skills/                      F06-rules/
...
F28-chat-parity/                 F29-monitor-de-execucao/
F30-avisos-de-runtime-e-permissao/   F31-shell-de-edicao-em-auto-accept/
```

Cada pasta contém:
- `spec.md` — Especificação técnica de implementação
- `plan.md` — Plano de execução
- `ui.md` — Anatomia de UI e tokens
- `copy.md` — Textos de UI (labels, mensagens, hints)
- `smoke-results.md` — Evidência de validação manual/E2E (quando aplicável)

---

## 🔗 Links úteis

- **PRD estendido** — `/prd-writer` pode estender PRD com novas features (ver CLAUDE.md)
- **Spec + Plan** — `/spec-writer` gera spec e plano para uma feature
- **Implementação** — `/implement-feature` roda a feature com phase tracking (EngrenaCode-adapted)
- **Auditoria** — `/code-review` e `/audit-full-base` para revisão de qualidade

---

## 📋 Estrutura rápida

```
docs/
├── README.md                         (este arquivo — índice)
├── PRD.md                           (produto completo)
├── PROGRESS.md                      (estado real por feature)
├── DEVELOPMENT.md                   (Quick Start)
├── RUNBOOK-HOMOLOGACAO.md           (checklist de validação)
├── RUNBOOK-BUILD.md                 (build/release)
├── GLOSSARY.md                      (termos técnicos)
├── AUDIT-CODE-REVIEW.md             (auditoria de código, histórico)
├── AUDIT-PRD-S9-MIGRATION.md        (auditoria de produto, histórico)
├── F01-vault-e-sessao-local/        (specs de features)
├── F02-configuracao-mvp/
├── ... (F03–F30)
└── F31-shell-de-edicao-em-auto-accept/
```

---

## ❓ Perguntas frequentes

**P: Por onde começar?**  
R: Leia [DEVELOPMENT.md](./DEVELOPMENT.md) (instalação) → [GLOSSARY.md](./GLOSSARY.md) (termos) → [PRD.md](./PRD.md) (o que é).

**P: Como vejo o progresso real?**  
R: [PROGRESS.md](./PROGRESS.md) — tabela com status, evidência e próximos passos de cada feature.

**P: Como faço release?**  
R: [RUNBOOK-BUILD.md](./RUNBOOK-BUILD.md) (build) → [RUNBOOK-HOMOLOGACAO.md](./RUNBOOK-HOMOLOGACAO.md) (validação).

**P: Qual é o status de F30?**  
R: [PROGRESS.md](./PROGRESS.md) linha "F30" — completo em 2026-08-19.

**P: F31 está pronto?**  
R: Especificado em 2026-08-18, implementação pendente. Ver [PROGRESS.md](./PROGRESS.md) linha "F31".

---

## 🗑️ Documentos históricos (não editar)

- `AUDIT-CODE-REVIEW.md` — Zero achados abertos desde 2026-08-17. Registro de processo.
- `AUDIT-PRD-S9-MIGRATION.md` — Auditoria completa em 2026-08-07. Snapshot do estado de migração.

Ambos continuam no repo como registro, mas não se abrem para nova auditoria a menos que instruções de `docs/PROGRESS.md` indicarem gap novo.

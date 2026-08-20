# EngrenaCode — Índice de Documentação

Bem-vindo. Este diretório contém toda a documentação de produto, desenvolvimento e auditoria do EngrenaCode.

**Atualizado:** 2026-08-20

---

## 🎯 Comece por aqui

| Você é... | Comece em | Depois leia |
|-----------|-----------|-----------|
| **Novo desenvolvedor** | [`DEVELOPMENT.md`](./DEVELOPMENT.md) | [`GLOSSARY.md`](./GLOSSARY.md) |
| **Fazendo release** | [`RUNBOOK-BUILD.md`](./RUNBOOK-BUILD.md) | [`RUNBOOK-HOMOLOGACAO.md`](./RUNBOOK-HOMOLOGACAO.md) |
| **Entendendo o produto** | [`PRD.md`](./PRD.md) | [`PROGRESS.md`](./PROGRESS.md) |
| **Revisor de features** | [`PROGRESS.md`](./PROGRESS.md) | [`PRD.md`](./PRD.md) |

---

## 📖 Documentos principais

### Produto e Strategy

- **[`PRD.md`](./PRD.md)** — Documento de Requisitos de Produto. Visão, personas, objetivos, funcionalidades (F01–F35), versões 1.0–1.5, roadmap. Fonte de verdade de produto.

- **[`PROGRESS.md`](./PROGRESS.md)** — Progresso real do MVP. Tabela de todas as features (feito vs. pendente), ondas de entrega, evidência de testes e smoke. **Leia quando:** precisa saber o estado exato de uma feature ou release.

### Desenvolvimento

- **[`DEVELOPMENT.md`](./DEVELOPMENT.md)** — Quick Start. Pré-requisitos, instalação, como rodar `pnpm dev`, troubleshooting básico. **Leia primeiro** se está clonando o repo.

- **[`RUNBOOK-BUILD.md`](./RUNBOOK-BUILD.md)** — Build, empacotamento e artefatos. Passo a passo de `pnpm build`, electron-builder, geração de `.exe`. **Leia se:** está preparando um release.

### Validação

- **[`RUNBOOK-HOMOLOGACAO.md`](./RUNBOOK-HOMOLOGACAO.md)** — Checklist manual de validação. Roteiros A–E (fumaça, turno real, Git, voz, F30–F35), critério de aprovação, troubleshooting. Cobre F01–F35. **Leia se:** está fazendo homologação antes de liberar.

### Histórico e Arquivos

- **[`AUDIT-CODE-REVIEW.md`](./AUDIT-CODE-REVIEW.md)** — Registro de auditoria de código. **Status:** Encerrado em 2026-08-17 (zero achados abertos). Não editar.

- **[`AUDIT-PRD-S9-MIGRATION.md`](./AUDIT-PRD-S9-MIGRATION.md)** — Matriz checkbox dos critérios de aceitação PRD §9. **Status:** Auditoria encerrada 2026-08-07. Não reabre.

Detalhe do que cada auditoria fechou: seção [Documentos históricos](#documentos-históricos-não-editar) abaixo.

---

## 📚 Referência

- **[`GLOSSARY.md`](./GLOSSARY.md)** — Glossário de termos técnicos (worktree, lease, dispatch, MCP, supervisado vs auto-accept, smoke, feature, onda, etc.). Leia quando encontrar jargão.
- **[`workspace-glossary.png`](./workspace-glossary.png)** — Glossário visual do workspace (contrato de permissão).

---

## 🗂️ Subpastas de features

Documentação por feature (F01–F35). Pastas no disco:

```
F01-vault-e-sessao-local/        F01.1-design-system/
F02-configuracao-mvp/            F03-workspace/
…
F30-avisos-de-runtime-e-permissao/   F31-shell-de-edicao-em-auto-accept/
F32-prazo-do-pedido-de-permissao/    F33-historico-de-chat-paginado/
F34-rascunho-persistente-do-composer/ F35-estado-honesto-de-thread-interrompida/
```

O que cada pasta **pode** conter (nem toda feature tem os cinco):

- `spec.md` — Especificação técnica de implementação
- `plan.md` — Plano de execução
- `ui.md` — Anatomia de UI e tokens (quando há superfície)
- `copy.md` — Textos de UI (quando há superfície)
- `smoke-results.md` — Evidência de validação manual/E2E (quando aplicável)

Smoke agregado F30–F35: [`F30-F35-smoke-results.md`](./F30-F35-smoke-results.md).

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
├── workspace-glossary.png           (glossário visual do workspace)
├── AUDIT-CODE-REVIEW.md             (auditoria de código, histórico)
├── AUDIT-PRD-S9-MIGRATION.md        (auditoria de produto, histórico)
├── F30-F35-smoke-results.md         (smoke agregado da 1.4/1.5)
├── _shared/                         (padrões de codebase)
├── archived/                        (regras/docs fora do ciclo vivo)
├── F01-vault-e-sessao-local/        (specs de features)
├── … (F01.1–F34)
└── F35-estado-honesto-de-thread-interrompida/
```

---

## ❓ Perguntas frequentes

**P: Por onde começar?**  
R: Leia [DEVELOPMENT.md](./DEVELOPMENT.md) (instalação) → [GLOSSARY.md](./GLOSSARY.md) (termos) → [PRD.md](./PRD.md) (o que é).

**P: Como vejo o progresso real?**  
R: [PROGRESS.md](./PROGRESS.md) — tabela com status, evidência e próximos passos de cada feature.

**P: Como faço release?**  
R: [RUNBOOK-BUILD.md](./RUNBOOK-BUILD.md) (build) → [RUNBOOK-HOMOLOGACAO.md](./RUNBOOK-HOMOLOGACAO.md) (validação).

**P: Qual é o status de F30? E F31?**  
R: Ambos completos em 2026-08-19. Ver [PROGRESS.md](./PROGRESS.md) nas linhas "F30" e "F31". F32–F35 (versão 1.5) também: mesma tabela, smoke em [F30-F35-smoke-results.md](./F30-F35-smoke-results.md).

---

## 🗑️ Documentos históricos (não editar)

- `AUDIT-CODE-REVIEW.md` — Encerrado em 2026-08-17, zero achados abertos. Registro de processo.
- `AUDIT-PRD-S9-MIGRATION.md` — Encerrado em 2026-08-07. Snapshot da migração de critérios §9.

Não reabrem a menos que [`PROGRESS.md`](./PROGRESS.md) indique gap novo.

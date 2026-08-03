# Roadmap: 001-mvp-nucleo-operacional

> Selo 🟡 PLANEJADO. Delta greenfield a partir de `_reversa_sdd/prd.md` + `sdd/*`.

## Resumo da abordagem

Implementar o MVP EngrenaCode em ondas de fundação serializadas: (1) Vault + Design System, (2) Config + Skills/Rules/SubAgents, (3) Workspace, (4) Dashboard. Âncora: `_reversa_sdd/prd.md` e specs em `_reversa_sdd/sdd/`.

**Premissa crítica do ambiente:** o repositório `sistema legado` já contém pacotes de aplicação (`packages/*`). No modo expresso, o coding **não pode modificar arquivos pré-existentes**. Se a base já existir, as ações de código que tocariam esses arquivos entram em **parada legítima non-destructive** e devem ser reexecutadas num repo greenfield vazio ou via `/reversa-forward` em modo de evolução controlada.

## Princípios aplicados

n/a (`.reversa/principles.md` ausente). Premissas de produto local-first e non-destructive do Reversa prevalecem.

## Decisões técnicas

| Decisão | Confiança | Nota |
|---------|-----------|------|
| Electron + server loopback + vault cifrado | 🟡 | prd + vault SDD |
| Renderer React + Tailwind 3 + CSS variables | 🟡 | design-system SDD |
| Providers MVP via assinatura/CLI (sem API keys) | 🟡 | premissa expresso |
| Hard caps de catálogo = soft warnings | 🟡 | premissa expresso |
| Fundação F01 → F01.1 → F02 serializada | 🟡 | prd ondas |

## Delta arquitetural

Greenfield lógico: shell Electron, server-core loopback, vault, renderer (gate + dashboard + workspace + catálogo + config), integrações CLI providers e GitHub PAT. Fora: registros/MCP/API keys/consumo.

## Delta de dados

Ver `data-delta.md` (projetos, threads, diffs, skills, rules, subagents, config flags; segredos só no vault).

## Delta de contratos

HTTP/IPC internos loopback (unlock, config, projects/threads, catalog). Sem API SaaS pública.

## Plano de migração

Sem legado de dados obrigatório. Se houver instalação sistema legado prévia no mesmo perfil de usuário, não migrar automaticamente neste MVP (premissa 🟡).

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Coding bloqueado por arquivos pré-existentes no repo | Parar; retomar em repo vazio ou forward evolutivo |
| Detecção frágil de CLIs | Status + testar conexões |
| Adoção vs terminal solto | Onboarding ≤ 15 min + dashboard |

## Critério de pronto

Todos os RF Must do `requirements.md` verificáveis; critérios Gherkin passam; actions `[X]`; sem regressão de regra non-destructive.

## Premissas a partir de lacunas

1. 🟡 Auth assinatura/CLI basta no MVP
2. 🟡 Path manual de binário fora do Must
3. 🟡 Caps de catálogo são soft warnings

---
Gerado por reversa-plan (expresso) em 2026-07-31T10:55:00Z

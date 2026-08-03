# Requirements: MVP Núcleo Operacional EngrenaCode

> Identificador: `001-mvp-nucleo-operacional`
> Data: `2026-07-31`
> Pasta da extração / greenfield: `_reversa_sdd/`
> Confidência: 🟢 CONFIRMADO, 🟡 INFERIDO, 🔴 LACUNA / DÚVIDA
> Origem: `/reversa-new` modo expresso (greenfield a partir de PRD EngrenaCode)

## 1. Resumo executivo

Entregar o MVP do EngrenaCode: cofre e sessão local, design system, configuração de providers/CLI/GitHub, catálogo (skills, rules, subagents), workspace com threads/diffs/GitHub e dashboard operacional. Público single-user local (Rafa, Marina, Leo). Problema: trabalho com agentes de IA espalhado entre terminal, editor e Git.

## 2. Contexto a partir do legado

Contexto greenfield: fontes do time Code New Project (não discovery legado).

| Fonte | Trecho relevante | Confidência |
|-------|------------------|-------------|
| `_reversa_sdd/prd.md#4. Escopo (in)` | MVP = F01, F01.1, F02–F07 + F04 | 🟡 |
| `_reversa_sdd/ideation.md#Problema` | Trabalho espalhado; setup repetitivo; falta de visão | 🟡 |
| `_reversa_sdd/personas.md` | Rafa, Marina, Leo e jornadas | 🟡 |
| `_reversa_sdd/sdd/vault-sessao-local.md` | Cofre, unlock, backoff, sessão | 🟡 |
| `_reversa_sdd/sdd/design-system.md` | Tokens, tema, anti-flash | 🟡 |
| `_reversa_sdd/sdd/configuracao-mvp.md` | Claude/CLIs/prompt/GitHub | 🟡 |
| `_reversa_sdd/sdd/skills.md` | Catálogo load_skill | 🟡 |
| `_reversa_sdd/sdd/rules.md` | Injeção e precedência | 🟡 |
| `_reversa_sdd/sdd/subagents.md` | call_subagent e diffs no pai | 🟡 |
| `_reversa_sdd/sdd/workspace.md` | Threads, diffs, lease, GitHub | 🟡 |
| `_reversa_sdd/sdd/dashboard.md` | Inbox e saúde de config | 🟡 |

## 3. Personas e cenários de uso

| Persona | Objetivo | Cenário-chave |
|---------|----------|---------------|
| Rafa | Entregar com velocidade sem refazer login | Unlock → projeto → thread → diff → PR |
| Marina | Velocidade com supervisão | Dashboard inbox → Diff → accept/reject → push |
| Leo | Padronizar harness da casa | CRUD skills/rules/subagents → validar no turno |

## 4. Regras de negócio novas ou alteradas

1. **RN-01:** Credenciais nunca em claro no SQLite; só no cofre. 🟡
   - Origem: `_reversa_sdd/sdd/vault-sessao-local.md#RF-06`
   - Tipo: nova
2. **RN-02:** Máximo 1 execução longa running por projeto; conflito `thread_busy`. 🟡
   - Origem: `_reversa_sdd/sdd/workspace.md#RF-06`
   - Tipo: nova
3. **RN-03:** Diffs revisáveis por arquivo (`pending|accepted|rejected`) antes do disco conforme access level. 🟡
   - Origem: `_reversa_sdd/sdd/workspace.md#RF-05`
   - Tipo: nova
4. **RN-04:** Precedência de rules: projeto > global > CLAUDE.md/AGENTS.md do repo. 🟡
   - Origem: `_reversa_sdd/sdd/rules.md#RF-03`
   - Tipo: nova
5. **RN-05:** Codex pai só delega subagent com `full-access`. 🟡
   - Origem: `_reversa_sdd/sdd/subagents.md#RF-05`
   - Tipo: nova
6. **RN-06:** Git mutável bloqueado com thread running. 🟡
   - Origem: `_reversa_sdd/sdd/workspace.md#RF-07`
   - Tipo: nova
7. **RN-07:** Dashboard não dispara turno, não aceita diff e não faz commit/PR. 🟡
   - Origem: `_reversa_sdd/sdd/dashboard.md#RF-08`
   - Tipo: nova

## 5. Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de aceite | Confidência |
|----|-----------|------------|--------------------|-------------|
| RF-01 | Criar/desbloquear cofre com workspace+senha; backoff após 5 falhas; rotas protegidas exigem unlock | Must | Gate `#login`; 401/423 com cofre travado | 🟡 |
| RF-02 | Design system: tokens light/dark, tema light\|dark\|system, `engrenacode:theme`, anti-flash, splash `#0a0a0b` | Must | Preferência persiste; fail-soft `system` | 🟡 |
| RF-03 | Config: Claude assinatura + teste; CLIs Claude/Codex/Kimi; prompt global; PAT GitHub com validação de formato | Must | Cards em `#configuracao`; sem API keys (F10) | 🟡 |
| RF-04 | CRUD skills + vínculo projeto + `load_skill` sob demanda | Must | Catálogo no turno; skill não executa código | 🟡 |
| RF-05 | CRUD rules globais/projeto com override e injeção por turno | Must | Precedência RN-04 | 🟡 |
| RF-06 | CRUD subagents `kind=dev`, `call_subagent`, diffs do filho na revisão do pai | Must | Codex exige full-access; idle timeout 20 | 🟡 |
| RF-07 | Workspace: projetos, threads, streaming, diffs, lease, commit/push/PR GitHub | Must | `thread_busy`; mode trava no 1º envio | 🟡 |
| RF-08 | Dashboard pós-unlock com saúde, 4 cards, inbox ≤20, atalhos | Must | Clique diff → aba Diff; sem mutações | 🟡 |

## 6. Requisitos Não Funcionais

| Tipo | Requisito | Evidência ou justificativa | Confidência |
|------|-----------|----------------------------|-------------|
| Segurança | Segredos só no vault; server em loopback | prd.md restrições + vault SDD | 🟡 |
| Privacidade | Código do usuário não passa por servidor Lukse | ideation.md / prd.md | 🟡 |
| UX | Onboarding unlock → provider+GitHub ≤ 15 min (meta de produto) | prd.md métricas | 🟡 |
| Consistência visual | Sem MUI/Chakra; Tailwind 3 + CSS vars | design-system SDD | 🟡 |
| Concorrência | Lease 1 execução/projeto | workspace SDD | 🟡 |

## 7. Critérios de Aceitação

```gherkin
Cenário: Unlock e sessão
  Dado primeiro uso com workspace e senha válidos
  Quando o usuário cria o cofre e nas aberturas seguintes desbloqueia
  Então rotas protegidas liberam e falhas de senha são genéricas

Cenário: Setup MVP
  Dado cofre aberto
  Quando o usuário conecta ≥ 1 provider CLI e salva PAT GitHub válido
  Então `#configuracao` reflete status e o workspace habilita composer conforme login

Cenário: Thread com diff e PR
  Dado projeto e thread com provider logado
  Quando envia mensagem, revisa diffs e a thread não está running
  Então pode commit/push/abrir PR; segunda execução no mesmo projeto retorna thread_busy

Cenário: Dashboard operacional
  Dado threads com diff pendente ou erro
  Quando abre `#dashboard`
  Então vê inbox acionável e navega ao workspace na aba correta sem mutar estado
```

## 8. Fora de escopo desta feature

- F08 Registros, F09 MCPs, F10 API Keys, F11 Consumo (releases 1.0/1.1)
- Pipelines, memory, codegraph, PTY, voz, multi-tenant/RBAC, GitLab/Bitbucket

## 9. Premissas e dúvidas

Premissas 🟡 (modo expresso; clarify pulado):
1. Auth por assinatura/CLI basta no MVP (API keys só na 1.0).
2. Caminho manual de binário CLI fica fora do Must desta feature (Should/escopo completo).
3. Hard caps de catálogo (30 skills / 15 rules / 10 subagents) são recomendações de UI, não hard fail, salvo onde a SDD exija rejeição explícita (names duplicados, etc.).

Marcadores `[DÚVIDA]` restantes: **0** (lacunas respondidas via SDD/PRD ou convertidas em premissa).

## Pendências de Qualidade

n/a

---
Gerado por reversa-requirements (greenfield expresso) em 2026-07-31T10:50:00Z

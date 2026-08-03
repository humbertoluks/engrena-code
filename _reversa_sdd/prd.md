# PRD: EngrenaCode

> Selo 🟡 PLANEJADO. Documento gerado a partir de ideation + personas.

**Versão:** 1.0
**Data:** 2026-07-31T10:40:00Z
**Autor:** reversa-drafter
**Status:** rascunho

---

## 1. Problema

🟡 Desenvolvedores que já usam agentes de IA em repos reais fragmentam o trabalho entre terminal, editor e Git: conversa, diff e commit em lugares distintos; reexplicam o contexto a cada sessão; reconfiguram providers; perdem visibilidade do que está running ou com diff pendente; reinventam skills, rules e subagents. O resultado é tempo perdido, maior risco de aceitar mudança sem revisão estruturada e onboarding lento antes do primeiro turno útil.

### Quem sente
🟡 **Rafa** (solo/freelancer): ao alternar projetos/clientes e providers na mesma semana
🟡 **Marina** (plena em startup): no fluxo diário de feature com IA, quando precisa de inbox e supervisão antes do push
🟡 **Leo** (tech lead): ao tentar padronizar o harness da casa sem um catálogo local estável

---

## 2. Personas-alvo

🟡 Referência completa em [`personas.md`](./personas.md). Resumo:

- **Rafa**: 🟡 Solo/freelancer; dor = setup repetitivo e troca de contexto multi-projeto
- **Marina**: 🟡 Plena em startup; dor = falta de visibilidade operacional e necessidade de supervisão
- **Leo**: 🟡 Tech lead (secundário); dor = ausência de catálogo local para padronizar skills/rules/subagents

---

## 3. Métricas de sucesso

🟡 Derivadas de ideation.md / PRD fonte EngrenaCode.

| Métrica | Unidade | Alvo | Prazo |
|---|---|---|---|
| 🟡 Sessões com thread concluída | % sessões ativas | ≥ 70% | 30 dias de uso ativo |
| 🟡 Unlock → provider + GitHub | % no funil | ≥ 80% em ≤ 15 min | 7 dias pós-instalação |
| 🟡 Uso de catálogo em threads | % threads | ≥ 50% (usuários com ≥ 3 skills/rules) | Dias 15–45 |
| 🟡 MCP + registros (1.0) | % ativos semanais | ≥ 40% | Semanas 4–8 pós-1.0 |
| 🟡 Abertura de Consumo (1.1) | % que gastam tokens | ≥ 60% ≥ 1×/semana | 30 dias pós-1.1 |

---

## 4. Escopo (in)

🟡 **MVP (primeira feature forward):** núcleo operacional local-first

- 🟡 F01 Vault e Sessão Local (cofre cifrado, unlock, sessão loopback)
- 🟡 F01.1 Design System (tokens light/dark/system, superfícies, anti-flash)
- 🟡 F02 Configuração MVP (Claude assinatura, CLIs Claude/Codex/Kimi, prompt global, GitHub PAT)
- 🟡 F05 Skills (CRUD global, vínculo por projeto, load_skill)
- 🟡 F06 Rules (globais/projeto, override, injeção por turno)
- 🟡 F07 SubAgents (CRUD, vínculo kind=dev, call_subagent, diffs no pai)
- 🟡 F03 Workspace (projetos, threads, streaming, diffs accept/reject, GitHub commit/push/PR, lease)
- 🟡 F04 Dashboard (saúde config, inbox, atalhos, contadores de catálogo)

🟡 **Versão 1.0:** F08 Registros, F09 MCPs, F10 API Keys (Claude/Codex/Minimax)

🟡 **Versão 1.1:** F11 Consumo (tokens/custo estimado, preços editáveis, drill-down)

---

## 5. Não-objetivos (out)

🟡 Pipelines/feature-build, memory/dreaming, CodeGraph
🟡 Terminal PTY, voz STT/TTS
🟡 Grok/GLM como produto até 1.1; multi-provider na mesma thread
🟡 GitLab/Bitbucket/Azure DevOps como fluxo de PR de produto
🟡 Multi-tenant, RBAC, sync nuvem, conta Lukse remota, API SaaS pública, colaboração em tempo real
🟡 Marketplace de skills/MCPs de terceiros sem curadoria
🟡 Fatura real, budget/alertas, export CSV/PDF de consumo; export/purge de audit log
🟡 File explorer rico tipo IDE, command palette avançada, clientes mobile/web, instaladores store como entrega comercial

---

## 6. Restrições

| Tipo | Descrição |
|---|---|
| 🟡 Técnica | 🟡 Desktop Electron local-first; server em loopback; vault cifrado (credenciais nunca em claro no SQLite); renderer React + Tailwind 3 + CSS variables; tema `light` \| `dark` \| `system`; sem MUI/Chakra/Emotion/Storybook obrigatório; providers MVP via assinatura/CLI |
| 🟡 Prazo | 🟡 Roadmap por release: MVP → 1.0 → 1.1; fundação F01/F01.1/F02 serializada em greenfield |
| 🟡 Compliance | 🟡 Dados e código do usuário permanecem locais; sem servidor Lukse no caminho do código; LGPD alinhada a processamento local [detalhe jurídico formal INDEFINIDO] |
| 🟡 Orçamento | 🟡 [INDEFINIDO, validar com usuário] |

---

## 7. Dependências externas

🟡 CLIs / runtimes: Claude Code (assinatura), Codex, Kimi
🟡 GitHub API via Personal Access Token (commit, push, PR)
🟡 Na 1.0: API keys Claude/Codex/Minimax; servers MCP (stdio/http/sse) e OAuth PKCE quando aplicável
🟡 Nenhuma dependência de backend SaaS Lukse para o núcleo local-first

---

## 8. Riscos

| Risco | Impacto | Probabilidade | Mitigação proposta |
|---|---|---|---|
| 🟡 Usuário não migra do terminal solto | 🟡 Alto | 🟡 Média | 🟡 Dashboard + inbox + onboarding ≤ 15 min; valor imediato no primeiro diff |
| 🟡 Auth só por assinatura/CLI insuficiente no MVP | 🟡 Alto | 🟡 Média | 🟡 Roadmap explícito F10 API keys na 1.0; mensagens claras de “CLI não logada” |
| 🟡 Gate de diff + corte de pipeline/memory até 1.1 rejeitados | 🟡 Alto | 🟡 Baixa–média | 🟡 Comunicar diferencial (controle) e manter escopo MVP focado no núcleo operacional |
| 🟡 Detecção de CLIs frágil entre máquinas | 🟡 Médio | 🟡 Alta | 🟡 Status instalado/logado + testar conexões; caminho manual no escopo completo |

---

## 9. Critérios de aceite (alto nível)

🟡 **Dado** Rafa com cofre criado, **Quando** desbloqueia e conecta ≥ 1 provider + GitHub em ≤ 15 min, **Então** consegue abrir projeto, enviar turno e revisar diff no workspace.
🟡 **Dado** Marina com threads running/diff pendente, **Quando** abre o dashboard, **Então** vê inbox acionável e cai no workspace na aba correta sem aceitar diff às cegas.
🟡 **Dado** Leo com skills/rules/subagents cadastrados, **Quando** vincula a um projeto e roda um turno, **Então** o harness usa catálogo (load_skill / rules / call_subagent) conforme configuração.
🟡 **Dado** cofre travado, **Quando** qualquer rota protegida é chamada, **Então** o sistema bloqueia (401/423) e devolve ao gate de unlock.
🟡 **Dado** thread running no projeto, **Quando** outra execução longa é pedida, **Então** retorna `thread_busy` e bloqueia git mutável.

---

## Pendências de cobertura

🟡 Orçamento formal do projeto
🟡 Detalhamento jurídico LGPD além da premissa local-first
🟡 Caminho de distribuição comercial (stores) permanece fora; confirmar se instalador interno entra em escopo de eng. aparte

---

Gerado por reversa-drafter em 2026-07-31T10:40:00Z
Fontes: ideation.md, personas.md, PRD EngrenaCode (entrevista)

# Ideation, EngrenaCode

> Selo 🟡 PLANEJADO em todos os itens, sujeito a validação.

## Brief original
O EngrenaCode é uma IDE desktop local-first (Electron) da Lukse para desenvolvedores que já usam agentes de IA: configurar providers e credenciais uma vez, abrir o repositório local e orquestrar agentes (Claude, Codex, Kimi no MVP; Minimax na 1.0) com histórico, revisão de diffs arquivo a arquivo e fluxo GitHub (commit, push, PR) na mesma tela. Single-user local, cofre cifrado, sem servidor da Lukse no caminho do código do usuário. Fonte: `C:\Users\Me\Code\repos\github\engrena-code\docs\PRD.md`.

## Problema
🟡 Trabalho espalhado entre terminal, editor e Git: conversa num lugar, diff noutro, commit noutro; contexto do repo reexplicado a cada sessão; setup repetitivo de providers/credenciais; falta de visão agregada do que está running ou com diff pendente; skills/rules/subagents reinventados a cada conversa. Quem sente: desenvolvedor solo/freelancer e pleno em time pequeno, no momento em que orquestra agentes de IA em repositórios reais e precisa entregar com revisão antes do push.

## Valor entregue
🟡 Sair de “perguntei e copiei/colei” para “pedi, revisei o diff, aceitei ou rejeitei e segui no mesmo fluxo”, com catálogo reutilizável, dashboard multi-projeto e cofre local, sem o código do usuário passar por servidor da Lukse.

## Alternativas existentes
🟡 CLIs e assinaturas isoladas (Claude Code, Codex, Kimi) sem workspace unificado de diffs/GitHub; combinação terminal + editor + Git com copy/paste; outras AI IDEs com modelo mais SaaS ou menos local-first; não fazer nada e continuar improvisando. Não bastam porque fragmentam revisão, setup e histórico, e não oferecem gate de diff + catálogo + dashboard operacional no mesmo app local.

## Público-alvo (bruto)
🟡 Desenvolvedor que já usa agente de IA em repos reais, prefere app local com cofre, aceita configurar CLI/assinatura, quer ver e decidir diffs antes de commit/PR; single-user (sem RBAC/multi-tenant nesta fase). Primários: solo/freelancer e pleno em startup pequena; secundário: tech lead curador de skills/rules/subagents.

## Métricas de sucesso
🟡 ≥ 70% das sessões ativas com ≥ 1 thread concluída (mensagem + diff revisado ou turno finalizado) nos primeiros 30 dias de uso ativo
🟡 ≥ 80% dos que desbloqueiam o cofre conectam ≥ 1 provider (Claude, Codex ou Kimi) + token GitHub em ≤ 15 minutos (funil 7 dias)
🟡 Usuários com ≥ 3 skills ou rules usam catálogo em ≥ 50% das threads (dias 15–45)
🟡 Pós-1.0: ≥ 40% ativos semanais com ≥ 1 MCP vinculado e ≥ 1 registro consultado/gerado por semana
🟡 Pós-1.1: ≥ 60% dos que gastam tokens abrem Consumo ≥ 1×/semana; ≥ 30% ajustam provider/modelo ou pausam após ver custo

## Premissas a validar
🟡 Usuários migram o fluxo diário do terminal solto para o workspace EngrenaCode
🟡 Auth por assinatura/CLI (sem API keys no MVP) basta para o primeiro valor
🟡 Gate obrigatório de revisão de diffs e corte de pipeline/memory/codegraph até 1.1 não matam a adoção

## Notas
🟡 Releases: MVP = F01, F01.1, F02–F07 + F04; Versão 1.0 = F08–F10; Versão 1.1 = F11. Diferencial: local-first, multi-provider por assinatura/CLI no MVP, revisão de diffs como gate antes do disco. Fonte primaria da entrevista: PRD EngrenaCode externo.

---
Gerado por reversa-ideator em 2026-07-31T10:40:00Z
Fonte: newproject-brief.md

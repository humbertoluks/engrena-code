# Personas e Jornadas

> Selo 🟡 PLANEJADO em todos os itens.

## Persona 1: Rafa
- **Perfil:** 🟡 Desenvolvedor solo / freelancer que alterna 2–4 projetos por semana e providers conforme o cliente
- **Contexto:** 🟡 Em casa ou coworking, abre o repo do cliente, precisa login rápido e revisão de diff antes de entregar; usa o app como centro de comando, não como terminal solto
- **Nível técnico:** 🟡 Intermediário a avançado em desenvolvimento; familiarizado com GitHub, CLIs de agentes e fluxo commit/PR
- **Dor principal:** 🟡 Setup repetitivo de providers e troca constante de contexto entre projetos sem painel único
- **Objetivo final:** 🟡 Entregar trabalho cobrado com velocidade e controle, sem perder tempo com auth e copy/paste

### Jornada principal
1. 🟡 Desbloquear o cofre local e ver saúde da configuração no dashboard
2. 🟡 Abrir ou cadastrar o projeto do cliente certo
3. 🟡 Criar thread com provider/modelo adequados ao contrato
4. 🟡 Enviar pedido e acompanhar streaming / tool calls
5. 🟡 Revisar diffs arquivo a arquivo (aceitar ou rejeitar)
6. 🟡 Fazer commit, push e abrir PR no GitHub a partir do workspace
7. 🟡 Alternar para outro projeto sem refazer login de providers

---

## Persona 2: Marina
- **Perfil:** 🟡 Desenvolvedora plena em startup pequena que entrega features com IA diariamente, sozinha ou em par
- **Contexto:** 🟡 No horário de sprint, precisa de histórico, inbox de pendências e supervisão antes do push
- **Nível técnico:** 🟡 Avançado em produto/código; usa access levels `supervised` / `auto-accept-edits`, não autonomia cega
- **Dor principal:** 🟡 Falta de visibilidade do que está running, com diff pendente ou em erro entre threads e repos
- **Objetivo final:** 🟡 Velocidade com supervisão: fechar features confiáveis sem aceitar mudança cega

### Jornada principal
1. 🟡 Abrir o dashboard e ler a inbox (running, diff pendente, erro, setup incompleto)
2. 🟡 Entrar na thread com diff pendente já na aba Diff
3. 🟡 Aceitar/rejeitar arquivos e continuar o turno se necessário
4. 🟡 Usar skills/rules do projeto para manter padrão do time
5. 🟡 Delegar subtarefa a um subagent quando a tarefa estoura contexto
6. 🟡 Revisar diffs do filho na mesma revisão do pai
7. 🟡 Commit/push/PR só quando a thread não está running

---

## Persona 3: Leo
- **Perfil:** 🟡 Tech lead / sênior (persona secundária) que curadoria skills, rules e subagents como padrão da casa
- **Contexto:** 🟡 Mesmo produto single-user; investe no catálogo local e compartilha artefatos fora do app (repo/markdown); não administra time dentro do produto
- **Nível técnico:** 🟡 Avançado em arquitetura de harness, prompts e padrões de review/PR
- **Dor principal:** 🟡 Instruções e especialistas reinventados a cada conversa; sem catálogo local estável para padronizar
- **Objetivo final:** 🟡 Padronizar o harness da casa sem RBAC nem multi-tenant no app

### Jornada principal
1. 🟡 Desbloquear o cofre e ir às telas de catálogo
2. 🟡 Criar/editar skills globais em markdown
3. 🟡 Criar rules globais e por projeto com precedência clara
4. 🟡 Cadastrar subagents (prompt, provider, tools) e vincular aos projetos
5. 🟡 Verificar contadores de catálogo no dashboard
6. 🟡 Validar em uma thread que load_skill / rules / call_subagent se comportam como esperado
7. 🟡 Exportar/compartilhar artefatos via repo fora do app

---
Gerado por reversa-researcher em 2026-07-31T10:40:00Z
Fonte: ideation.md

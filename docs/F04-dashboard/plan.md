# Plano de Implementação: F04. Dashboard

**Modo:** as-built / retrospectivo — fases espelham o que já está no código. Não propor redesenho.

**Pré-requisitos:**
- F01.1 (tokens/tema), F02 (config status), F03 (projetos/threads/diffs), F05–F07 (contagens) implementados
- Stack HTTP loopback + SQLite + Vitest já no repo
- `docs/F04-dashboard/ui.md` e `copy.md` como fonte de anatomia/copy (screenshots em `ui/` capturadas 2026-08-08)

### Fase 1: Agregação de dados (já entregue)

**1. Repositório de dashboard** - Expor métricas, inbox classificada/ordenada e atividade recente sobre as tabelas existentes de projetos/threads/diffs, sem migração nova.

**2. Extração reutilizável de status de config** - Tornar a derivação de status de F02 reutilizável pelo handler do dashboard (mesma fonte da tela de configuração).

### Fase 2: Endpoint HTTP (já entregue)

**3. Health puro + handler agregado** - Derivar a strip de saúde e a flag de setup incompleto a partir do status de config; montar `GET /api/dashboard` com guard 423/401, inbox com item sintético de setup quando necessário, grade de projetos, contagens globais de catálogo e recent.

**4. Wiring no server loopback** - Registrar o handler no server único do app junto dos demais endpoints autenticados.

### Fase 3: UI e deep-link (já entregue)

**5. Cliente e tela `#dashboard`** - Service HTTP tipado + tela com load inicial, botão Atualizar, poll quando a página está visível, empty/error states e navegação por hash para config, workspace e catálogo, usando ids de `copy.md`.

**6. Deep-link no workspace** - Fazer o workspace consumir `project`/`thread`/`tab` da query na hash na primeira carga, para os cliques da inbox abrirem a aba certa.

**7. Rota pós-unlock** - Garantir que unlock e shell default apontem para `#dashboard` em vez do workspace.

### Fase 4: Validação e fechamento

**8. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração + smoke). Confirmar os critérios de aceitação de F04 e os cross-feature de §9 que a referenciam. Conferir light/dark e anatomia vs `ui.md`, strings vs `copy.md`. PNGs de referência já em `docs/F04-dashboard/ui/` (dark/light + alias canônico). Gate: suite/build verdes e ausência de mutações (turno/diff/git) a partir do Dashboard.

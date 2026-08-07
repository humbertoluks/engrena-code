# Plano de Implementação: F14. Fluxo Git Completo

**Pré-requisitos:**
- Herdar stack/tooling de `docs/_shared/codebase-patterns.md` (wave 4)
- Dependências de produto já no repo: F01.1, F02 (`github:token`), F03 (workspace/git stubs/lease), F08 (`log_entries`), F11 (`usage_events` + providers)
- Delta desta feature: migração `006_usage_source_textgen`; IPC `engrenacode:shell:open-external`; módulo `git-textgen`
- **UI:** `docs/F14-fluxo-git-completo/ui.md` e `copy.md` ainda não existem — implementação visual completa só após o processo de design; fases abaixo podem entregar contratos HTTP/estado e wiring mínimo nos stubs F03
- Variáveis: nenhuma nova obrigatória (reusa session + vault + userData)
- Referência técnica: `docs/F14-fluxo-git-completo/spec.md`

---

### Fase 1: Schema e resolução de cwd

**1. Migração usage source textgen** - Ampliar o CHECK de `usage_events.source` para incluir `textgen` via migração numerada e registrar no client SQLite. Atualizar o tipo `UsageSource` no repositório para aceitar o novo valor.

**2. Helper de cwd da thread** - Centralizar a regra “worktreePath quando executionMode=worktree, senão project.path” e passar a usá-la em commit, push, PR e textgen no handler git (alinhado ao dispatch).

---

### Fase 2: Contratos HTTP git

**3. Gates de busy e token** - Rejeitar mutações git (e textgen) quando a thread está `running`/`stopping`; exigir `github:token` também no push com o mesmo código acionável do PR.

**4. PR com title/body editáveis** - Aceitar title/body no body do endpoint de PR, aplicar fallback `EngrenaCode: {thread.title|id}`, e manter audit de sucesso e falha em `log_entries`.

**5. Erros de push/PR acionáveis** - Propagar stderr resumido nas falhas remotas sem reverter commit local já criado; alinhar mensagens ao contrato da spec.

---

### Fase 3: Textgen e usage

**6. Serviço git-textgen** - Implementar geração one-shot (modes `commit` e `pr`) com provider/model da thread, parse para subject/title/body, e falha tipada que não muta o repositório.

**7. Rota git-textgen + usage_event** - Expor `POST /api/threads/:id/git-textgen`, gravar `usage_events` com `source=textgen` quando o provider reportar usage, e garantir que falha de textgen deixa o caminho de commit manual intacto.

---

### Fase 4: Renderer, IPC e orquestração

**8. IPC open-external** - Expor no preload/main a abertura segura de URLs `https:` no browser do SO para o CTA “Ver PR”.

**9. Cliente e hook do workspace** - Estender `threads-service` e `usePrincipalWorkspace` com textgen, PR tipado, sequência Commit→push→PR, refresh de vcs-status e open da URL.

**10. Superfície GitActions (contrato de estado)** - Evoluir o stub F03 para as três ações do PRD, estágios de busy, campos editáveis pré-confirmação e estados de erro/sucesso PR conforme o contrato de estado da spec — **sem inventar copy/anatomia finais** até existir `ui.md`/`copy.md`.

---

### Fase 5: Validação e fechamento

**11. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração HTTP + smoke). Confirmar critérios de aceitação do PRD §9 para F14 e o critério cross-feature GitActions↔F02/F03. Gate: suite e build verdes. Quando `ui.md`/`copy.md` existirem, verificar light/dark, anatomia e strings literais antes de dar a feature como visualmente fechada.

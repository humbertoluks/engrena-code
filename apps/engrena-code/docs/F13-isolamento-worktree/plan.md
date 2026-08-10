# Plano de Implementação: Isolamento Worktree

**Feature:** F13  
**Complexidade:** médio  
**Fases:** 4  
**Status:** Pronto para dev  
**Spec:** `docs/F13-isolamento-worktree/spec.md`

---

## Pré-requisitos

- Herdar stack/tooling de `docs/_shared/codebase-patterns.md`
- ✓ F01.1 Design System (tokens/erros de superfície)
- ✓ F03 Workspace (threads, dispatch, diffs, lease, git HTTP)
- Binário `git` disponível no PATH do processo Electron (já usado por `git-client`)
- Variáveis: `ENGRENACODE_USER_DATA` / `ENGRENACODE_DB_PATH` para testes isolados (padrão existente)
- **UI:** `ui.md`/`copy.md` presentes (`docs/F13-isolamento-worktree/ui.md`, `copy.md`, `ui/*.png`) — fonte de verdade de anatomia/copy para badge e mensagens de erro

---

### Fase 1: Ciclo de vida do worktree

**1. Primitivos git worktree** - Estender o client git com operações de add/remove de worktree e remoção segura da branch associada, reutilizando o padrão `execFile` e erros tipados existentes. Detalhes na spec §4–§5.

**2. Módulo de ciclo de vida** - Criar o serviço de worktree que resolve o path sob userData, valida repo/HEAD no projeto, cria a árvore na branch estável e expõe remoção condicional quando a working tree está limpa. Referenciar spec §3.2 e §6 para layout em disco.

**3. Testes do módulo** - Cobrir create feliz, rejeição sem git/HEAD, falha de path ocupado, remove limpo e retenção suja conforme a estratégia de testes da spec.

---

### Fase 2: Dispatch e cwd unificado

**4. Wiring no primeiro envio** - Em dispatch de thread nova com mode worktree, criar e persistir o path antes de iniciar o turno; em falha, marcar erro, liberar lease e nunca spawnar no path do projeto. Mode main permanece sem criação.

**5. Helper de cwd** - Centralizar a resolução de cwd da thread para dispatch, delegate e handlers git, fechando o gap em que git HTTP ainda usa só o path do projeto.

**6. Git HTTP** - Passar o cwd resolvido para commit, push e PR da thread.

**7. Testes de dispatch e git** - Validar persistência de path, falha sem uso do path principal, main sem worktree, e commit no cwd isolado.

---

### Fase 3: Delete, cleanup e contrato de UI

**8. Repositório delete** - Adicionar remoção de thread com limpeza das rows filhas sem cascade e retorno dos dados necessários ao cleanup de disco.

**9. API DELETE** - Expor exclusão de thread no handler HTTP com resposta de cleanup (`removed` / `retained` / `none`) e aviso quando o worktree for retido. Detalhes na spec §5.

**10. Client renderer e badge** - Adicionar chamada de remoção no service de threads; renderizar badge “Worktree” no `ProjectTree` (linha da thread) e exibir mensagens de erro de worktree no composer, usando ids/textos de `copy.md` e anatomia de `ui.md`.

**11. Testes HTTP/repo de delete** - Cobrir remoção com worktree limpo e retenção com worktree sujo.

---

### Fase 4: Validação e fechamento

**12. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração + smoke manual dos fluxos feliz e de erro, incluindo badge light/dark e copy vs `ui.md`/`copy.md`). Confirmar critérios de aceitação F13 e o critério cross-feature F03↔F13 no PRD §9. Gate: suite e typecheck/build verdes.

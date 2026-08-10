# Plano de Implementação: F24. Multi-VCS (GitLab/Bitbucket/Azure)

**Pré-requisitos:**
- Herdar stack de `docs/_shared/codebase-patterns.md` (Camada 1) e padrões F02/F09/F14 (config PAT, MCP OAuth PKCE, git-handler/git-client)
- F01, F01.1, F02, F09 e F14 implementados (deps PRD)
- `ui.md` / `copy.md` de F24 existem — UI consome anatomia e ids `vcs.*`; strings TODO usam provisório da spec §3.3 até o design fechar
- Registrar apps OAuth (client IDs) para GitLab/Bitbucket na implementação; Azure pode exigir client_id manual
- Sem migração SQLite; sem dependência npm nova além do que F14 já usa (axios)

---

### Fase 1: Remote e cofre VCS

**1. Parse de remote multi-host** - Extrair kind e identidade do `origin` para GitHub/GitLab/Bitbucket/Azure clouds conforme a spec. Manter o path GitHub atual como caso especial compatível.

**2. Vault e status VCS** - Definir keys OAuth por provider e o endpoint de status em Configuração (PAT GitHub + OAuth dos três). Desconectar limpa o vault sem deixar token parcial.

### Fase 2: OAuth PKCE

**3. Motor OAuth VCS** - Replicar o fluxo PKCE/loopback/open-external do F09 num módulo VCS dedicado, com start, callback, disconnect e `needs-client-id` onde a spec exigir.

**4. Rotas HTTP de conexão** - Expor start/disconnect/client sob `/api/config/vcs/…` com o mesmo guard 423/401 das demais rotas de config.

### Fase 3: Push e change request

**5. Client git multi-provider** - Estender inject de token no push e a criação de PR/MR por kind, reusando o path GitHub de F14 sem regressão.

**6. Handler git** - Resolver kind+token antes de push/PR; mapear `vcs_token_missing` / `vcs_token_expired` / remote não suportado; preservar `github_token_missing` no path GitHub.

### Fase 4: UI Configuração e Workspace

**7. Cards em `#configuracao`** - Montar cards OAuth (GitLab/Bitbucket/Azure) no padrão do `ui.md`, mantendo o card PAT GitHub. Consumir ids `vcs.*`.

**8. Badge e labels no Repositório** - Mostrar provider do projeto e trocar CTAs/feedback PR↔MR via helper de labels; status do projeto conforme contrato da spec.

### Fase 5: Validação e fechamento

**9. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração + smoke OAuth cancelado e MR/PR num provider cloud de teste). Confirmar os 4 ACs de F24 e o AC cross-feature com F14. UI: light/dark, anatomia vs `ui.md`, copy vs `copy.md` (ou provisório §3.3). Gate: suite e build verdes; regressão GitHub PAT verde.

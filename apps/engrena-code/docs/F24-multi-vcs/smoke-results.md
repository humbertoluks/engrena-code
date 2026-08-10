# Smoke: F24. Multi-VCS (GitLab/Bitbucket/Azure)

**Data:** 2026-08-08
**Método:** app em dev (`pnpm dev`, Electron real) + `playwright-cli`, `ENGRENACODE_USER_DATA` isolado sob `C:\f24rt` (dois perfis de browser, dois projetos fixture, vault/db isolados). Vault e `userData` reais do usuário intocados.

## Setup

- `C:\f24rt\project-github` — repo git real, `origin` `https://github.com/acme/app.git` (regressão do path F14).
- `C:\f24rt\project-gitlab` — repo git real, `origin` `https://gitlab.com/acme/app.git`.
- Suite completa: **925 testes verdes** (98 arquivos), incluindo os novos de F24 (`remote.test.ts`, `oauth.test.ts`, extensões em `git-client.test.ts`/`git-handler.test.ts`/`changeRequestLabels.test.ts`); `tsc -b` limpo.

## Confirmado ao vivo

1. **Cards em `#configuracao`**: GitLab, Bitbucket e Azure DevOps abaixo do card PAT do GitHub, mesmo padrão visual; os três nascem no estado `needs-client-id` ("Registre um app OAuth PKCE público e cole o client_id.") — nenhum app OAuth builtin registrado, conforme spec §3.2.
2. **Salvar client_id (GitLab)**: campo `client_id` some e o card passa a mostrar botão "Conectar" — confirma a transição `needs-client-id` → `disconnected`.
3. **Clicar "Conectar"**: card entra em estado pendente real (loopback PKCE), "Aguardando autorização no browser…" com CTAs "abrir manualmente" e "Cancelar" — mesmo padrão OAuth do F09.
4. **Badge + terminologia MR no Workspace** (`project-gitlab`, thread real): painel Repositório mostra badge `GitLab`; label "Detalhes da MR" (não "Detalhes do PR"); CTA "Commit, push & MR" (não "& PR") — confirma que `GitActions` troca a terminologia PR↔MR a partir do provider detectado no remote real do projeto, sem qualquer configuração manual.
5. **Light/dark**: cards de Configuração conferidos nos dois temas — tokens do Design Lock, sem hex solto, sem Lion*.

## Não exercitado ao vivo

- Conclusão real do OAuth contra uma conta GitLab/Bitbucket/Azure de teste (pill "Conectado") e criação real de Merge Request via API — sem app OAuth público registrado para uso neste smoke. Cobertos por teste de integração/unitário: `oauth.test.ts` (`starts a pending flow once a client id exists`, `oauth_cancel_leaves_no_vault`, `throws vault_locked when the vault is locked`), `git-client.test.ts` (`push_inject_gitlab_oauth2`, `injectTokenIntoHttpsUrlByKind` para os 4 kinds).
- Push/PR com token expirado (`vcs_token_expired`) e remote sem token conectado (`vcs_token_missing`) — cobertos por `git-handler.test.ts` (`git_handler_vcs_token_missing — gitlab remote without a connected token returns 400 vcs_token_missing`) e guard `423 vault_locked` na mesma cadeia de rotas de config.
- Regressão visual do card GitHub PAT com projeto GitHub real — path de código inalterado (mesmo `injectTokenIntoHttpsUrl` original), coberto por `parses an https URL`/`x-access-token` em `git-client.test.ts`; não recapturado em screenshot nesta rodada.

## Screenshots

- `smoke/f24_vcs_cards_dark.png` — cards GitLab/Bitbucket/Azure, estado `needs-client-id`, dark.
- `smoke/f24_vcs_cards_light3.png` — mesmos cards, tema claro (scroll até GitLab/Bitbucket/Azure).
- `smoke/f24_vcs_cards_light.png`, `smoke/f24_vcs_cards_light2.png` — topo de `#configuracao` no claro (capturas duplicadas do mesmo estado, mantidas para registro).
- `smoke/f24_gitlab_saved_client.png` — GitLab após salvar `client_id`, botão "Conectar" disponível.
- `smoke/f24_gitlab_pending.png` — fluxo OAuth PKCE em andamento, "Aguardando autorização no browser…".
- `smoke/f24_gitlab_mr_label_dark.png` / `smoke/f24_workspace_gitlab_badge_dark.png` — Workspace com badge `GitLab`, "Detalhes da MR", "Commit, push & MR" (mesma captura, evidencia badge + label juntos).

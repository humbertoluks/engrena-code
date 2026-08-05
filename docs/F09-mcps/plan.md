# Plano de Implementação: F09. MCPs

**Pré-requisitos:**
- Stack herdada do codebase existente (Electron + Vite + React, `better-sqlite3` via `getDb()`, servidor HTTP único em `127.0.0.1:5174`, Vitest, padrão vault F01) — sem ferramentas novas
- F01 (vault + padrão de loopback PKCE), F01.1 (design system) e F03 (workspace/harness/dispatch) já implementados (ver `docs/PROGRESS.md`)
- Novo nesta feature: listener OAuth PKCE loopback dedicado (fluxo com provedor terceiro, distinto do unlock loopback de F01) e wrapper loopback de segredo para stdio — ver spec §2/§3.2
- Sem variáveis de ambiente novas; nome reservado do broker (`engrenacode`) e header `X-EngrenaCode-Session` seguem F01 (spec §1 Assumptions)

### Fase 1: Banco de dados

**1. Migração `mcps` / `project_mcps`** - Criar as tabelas globais e de vínculo por projeto (unique de nome, CASCADE no unlink) conforme spec §6, seguindo o padrão de migração numerada já usado em `src/services/db/migrations`.

**2. Colunas de catálogo e OAuth** - Estender a tabela `mcps` com `preset_id`, `auth_mode`, `oauth_status` e `oauth_client_json` (tokens fora dessas colunas, só no vault) conforme spec §6.

### Fase 2: Domínio — catálogo e OAuth

**3. Catálogo estático de presets** - Criar o módulo com os ~14 presets first-party (transporte, `secretKeys`, `remoteUrl` quando OAuth), aplicando o rename de marca/nome reservado (`legado → engrenacode`) descrito na spec §9.

**4. Fluxo OAuth PKCE loopback** - Criar o módulo de OAuth (start/status/disconnect/convert/client manual) com o guard de HTTPS obrigatório em metadata remota (HTTP só loopback), gravando tokens exclusivamente no vault F01 conforme spec §3.2/§5.5.

### Fase 3: Backend HTTP

**5. Repositório `mcps`** - Criar o repositório com CRUD global, validação de nome/transporte/env/headers e vínculo por projeto (upsert/reorder/unlink) conforme regras da spec §5.1/§5.2.

**6. Rotas CRUD, catálogo, secrets, OAuth e vínculo** - Criar os handlers HTTP para `/mcps`, `/mcp-catalog`, `/mcp-secrets`, `/mcps/:id/oauth/*` e `/projects/:id/mcps`, reaproveitando o padrão de guarda (cofre travado / sessão inválida) já usado nos demais handlers, conforme os contratos da spec §5.

**7. Registrar as rotas** - Ligar os novos handlers ao servidor HTTP único em `unlock-handler.ts`, ao lado das demais rotas por prefixo de URL.

### Fase 4: Runner — resolução no turno

**8. Registry de resolução por projeto** - Criar o módulo que cruza vínculos `linked + enabled + mcp.enabled` do projeto em `McpDefWithRefs`, seguindo o padrão dos registries existentes (`rule-registry.ts`, `skill-registry.ts`) conforme spec §2/§7.1.

**9. Resolução de segredo e wrapper stdio** - Criar o `SecretResolver` (secretRef/oauthRef → valor do vault ou motivo de omissão) e o wrapper loopback usado para injetar segredo em servers stdio sem expor no argv/env do processo spawnado, conforme spec §3.2 (decisão "Segredo stdio").

**10. Integração no dispatch** - Ligar `prepareMcpsForDispatch` ao `dispatch.ts` do runner: entregar `mcp__<server>__<tool>` ao driver quando resolvido, ou emitir `mcp.notice` (`omitted[]` + motivo) sem abortar o turno, incluindo o filtro de MCP HTTP sem OAuth no Codex, conforme spec §5.6/§7.2/§7.3.

### Fase 5: Frontend

**11. Client HTTP de MCPs** - Estender o client HTTP do renderer com as chamadas a CRUD, catálogo, secrets, OAuth e vínculo por projeto, seguindo o padrão dos demais serviços (`*-service.ts`, header de sessão).

**12. Tela `McpsScreen` (`#mcps`)** - Compor a anatomia A de `ui.md` (cabeçalho, busca, abas de categoria, grid de cards com ações) usando as strings `mcps.*` de `copy.md` e os primitives já existentes (`Card`, `Badge`, `Tabs`, `EmptyState`).

**13. `McpFormModal`** - Compor a anatomia C de `ui.md` (campos, seção de segredos do cofre, aviso Codex) usando `mcpsForm.*`, incluindo `mcpForm.logic` para regex de nome, parse de env/headers e avisos.

**14. `McpCatalogModal`** - Compor a anatomia B de `ui.md` (grid de presets, badges, instalar) usando `mcpsCatalog.*`.

**15. `McpOauthControls`** - Compor os estados de OAuth no card (Conectar/pending/Conectado/Reconectar/needs-client-id, Converter opt-in) usando `mcpsOauth.*` conforme anatomia A/estados de `ui.md`.

**16. `ProjectMcpsModal` e harness F03** - Compor a anatomia D de `ui.md` (vínculo por projeto, badges de credencial, reordenar) usando `mcpsLink.*`, e a superfície mínima E (row "MCPs" na sidebar do harness com contagem/incompatível) na `WorkspaceSidebar`.

**17. Banner de turno em `ThreadDetail`** - Renderizar o banner âmbar dispensável a partir do evento `mcp.notice` (mensagem por MCP omitido), usando `mcpsTurn.*`, sem abortar a exibição do turno.

**18. Roteamento em `App.tsx`** - Ligar a rota `#mcps` à tela real.

### Fase 6: Validação e fechamento

**19. Validação e fechamento** - Executar a estratégia de testes da spec (unitário/integração de repositório, catálogo, OAuth, registry, secret resolver e handlers) e a suíte completa (`pnpm test`, `pnpm build`). Rodar o checklist de smoke/aceitação manual da spec §7.2/§8, cobrindo instalar do catálogo → segredo/OAuth → vínculo → turno, secret ausente/OAuth expirado (omit sem abortar) e Codex sem bypass. Conferir anatomia e tema (light/dark) contra `ui.md` e as strings renderizadas contra `copy.md`. Confirmar os critérios de aceitação de F09 na Seção 9 do PRD antes de fechar a feature.

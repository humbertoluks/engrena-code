# Spec de UI: #configuracao + #principal (Multi-VCS)

**Feature:** F24-multi-vcs  
**Destino:** EngrenaCode  
**Fonte de referência:** LionCodeLabs (`packages/renderer` — card GitHub em `ConfiguracaoScreen.tsx`; OAuth CTA em `McpOauthControls.tsx`; status em `VcsStatusBar.tsx` / `useVcsStatus.ts`; terminologia MR em `threadVisuals.tsx` `changeRequestLabels`; ações em `GitActions.tsx`)  
**Componente fonte:** `ConfiguracaoScreen.tsx` (só PAT GitHub) + `McpOauthControls.tsx` (padrão Conectar) + `VcsStatusBar.tsx` + `threadVisuals.tsx`  
**Componente destino (previsto):** cards VCS em `src/renderer/screens/ConfiguracaoScreen.tsx`; badge/provider em `WorkspaceSidebar` / `GitActions`; labels PR/MR via helper espelhando `changeRequestLabels`  
**Última atualização:** 2026-08-08

> **Gap fonte × PRD:** a fonte **não** tem cards OAuth GitLab/Bitbucket/Azure em `#configuracao` (só `KeysForm` “Token do GitHub”). Backend fonte já resolve `github|gitlab|bitbucket|azure` pela URL do remote. Destino F24 (PRD §6) exige card por VCS + OAuth PKCE + badge no painel Repositório + “PR”→“Merge Request” no GitLab. Anatomia OAuth abaixo = **síntese** PRD + padrão visual `McpOauthControls` (não inventar copy além do PRD + strings literais reaproveitadas).

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Card GitHub (fonte viva) | `docs/F24-multi-vcs/ui/config-github-token-referencia.png` |
| Fixture cards OAuth (síntese) | `docs/F24-multi-vcs/ui/vcs-oauth-cards-fixture.html` |
| Fixture dark | `docs/F24-multi-vcs/ui/vcs-oauth-cards-fixture-dark.png` |
| Light (opcional) | TODO |

> Capturado 2026-08-08 via `playwright-cli attach --cdp=http://127.0.0.1:9222` no Electron LionCodeLabs (`--remote-debugging-port=9222`, Vite `:5273`). Fixture servida em loopback e screenshot via `playwright-cli open`.

## Escopo

**Inclui (Engrena F24):**
- Cards de conexão VCS em `#configuracao` (GitHub + GitLab + Bitbucket + Azure DevOps)
- Estados OAuth: disconnected / pending / connected / needs-reauth (padrão F09 `McpOauthControls`)
- Badge do provider VCS conectado no painel Repositório do `#principal`
- Terminologia change-request: `PR` vs `MR` (GitLab) em CTAs/`GitActions` / feedback
- Copy literal reaproveitável da fonte (GitHub card, OAuth CTAs, labels MR) + slots PRD marcados

**Exclui:**
- Self-hosted GitLab/Bitbucket Server (PRD §7)
- Contratos vault/OAuth HTTP (`spec.md` futuro)
- Publish-to-GitHub mini-form (F14; só GitHub)
- Card “Limites” / Consumo / STT

## Anatomia (topo → base)

### A) `#configuracao` — cards VCS (depois do card GitHub atual / em substituição evolutiva)

Ordem sugerida na stack `grid gap-md` (mesma coluna `max-w-[760px]` de F02):

1. Card **GitHub** — título + subtítulo + CTA Conectar/Desconectar (destino OAuth) **ou** PAT legado até migrar
2. Card **GitLab**
3. Card **Bitbucket**
4. Card **Azure DevOps**

Cada card (padrão OAuth, espelhando `McpOauthControls`):

1. Título do provider (`h3` 15px semibold)
2. Subtítulo muted (escopo nuvem pública / um VCS por projeto)
3. Faixa de status (`border-t`):
   - `disconnected` → botão **Conectar** (busy → **Conectando…**)
   - `pending` → texto **Aguardando autorização no browser…** + link **abrir manualmente** + **Cancelar**
   - `connected` → pill **Conectado** + **Desconectar**
   - `needs-reauth` → pill **requer reconexão** + **Reconectar**

**Observado na fonte (GitHub PAT, não OAuth):** `KeysForm` com label “Personal access token”, placeholder `ghp_…`, helper “Escopos necessarios: repo, workflow.”, CTA **Salvar token** / **Salvando...**, success “Token salvo localmente (não validado com o GitHub).”

### B) `#principal` — painel Repositório

1. Badge/provider VCS conectado (PRD) — fonte tem `VcsStatusBar` (ahead/behind/dirty/PR) sem label de provider; destino acrescenta badge do kind (`GitHub`/`GitLab`/…)
2. `GitActions` — CTAs usam `changeRequestLabels(kind)`: GitLab → **Abrir MR** / **MR aberto…**; demais → **Abrir PR** / **PR aberto…**

**Alinhamento:** cards centrados na coluna Configuração; badges na sidebar direita.  
**Largura máx.:** `max-w-[760px]` (config); sidebar Workspace (repositório).

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página config | `mx-auto max-w-[760px] px-lg py-xl` | F02 |
| Card | `rounded-lg border border-border bg-surface p-lg` | |
| Título card | `text-[15px] font-semibold text-fg` | |
| Subtítulo | `mb-md mt-xs text-[12.5px] text-muted` | |
| Faixa OAuth | `mt-md flex flex-wrap items-center gap-sm border-t border-border/60 pt-sm` | fonte MCP |
| Botão pill | `rounded-sm border border-border bg-surface-2 px-md py-xs text-[12px] font-medium` | |
| Pill Conectado | `rounded-full border border-green/60 … text-green` | |
| Pill reauth | `rounded-full border border-amber/60 … text-amber` | |
| Badge VCS sidebar | mono `text-[10.5px]` + `rounded-sm border` | alinhar `VcsStatusBar` / F14 |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |
| Erro | `text-[11.5px] text-red` `role="alert"` | |

### Observado na fonte

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Marca | LionCode / LionCodeLabs | EngrenaCode |
| GitHub UI | PAT `KeysForm` | Evoluir para OAuth card (PRD); PAT pode coexistir até migrate |
| OAuth CTAs | `McpOauthControls` | Reusar strings Conectar/Desconectar/… |
| MR labels | `changeRequestLabels` | Portar helper; GitActions fonte ainda hardcoda “PR” em stages — destino deve unificar |
| Self-hosted allowlist | server env | Fora do UI F24 |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `LionCode → EngrenaCode`; `lioncode → engrenacode`. Ver `copy.md`.

| Slot | Texto |
|------|-------|
| `vcs.github.title` | Token do GitHub *(fonte PAT — evoluir título para **GitHub** no card OAuth)* |
| `vcs.github.subtitle.pat` | Personal access token usado pelo git flow ao abrir PRs (ou via CLI gh). |
| `vcs.github.label.token` | Personal access token |
| `vcs.github.placeholder.token` | ghp_… |
| `vcs.github.helper.scopes` | Escopos necessarios: repo, workflow. |
| `vcs.github.cta.save` | Salvar token |
| `vcs.github.cta.saving` | Salvando... |
| `vcs.github.success` | Token salvo localmente (não validado com o GitHub). |
| `vcs.oauth.cta.connect` | Conectar |
| `vcs.oauth.cta.connecting` | Conectando… |
| `vcs.oauth.cta.disconnect` | Desconectar |
| `vcs.oauth.cta.cancel` | Cancelar |
| `vcs.oauth.cta.reconnect` | Reconectar |
| `vcs.oauth.pending` | Aguardando autorização no browser… |
| `vcs.oauth.openManual` | abrir manualmente |
| `vcs.oauth.connected` | Conectado |
| `vcs.oauth.needsReauth` | requer reconexão |
| `vcs.cr.short.pr` | PR |
| `vcs.cr.short.mr` | MR |
| `vcs.cr.cta` | Abrir {short} |
| `vcs.cr.opened` | {short} aberto com sucesso: |
| `vcs.cr.reused` | {short} já existente reapresentado: |
| `vcs.gitlab.title` | GitLab |
| `vcs.bitbucket.title` | Bitbucket |
| `vcs.azure.title` | Azure DevOps |
| `vcs.error.oauthFailed` | TODO — OAuth falha/cancelado → estado desconectado (PRD) |
| `vcs.error.tokenExpired` | TODO — apontar reconectar em Configuração (PRD) |

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| Conectar | button | sim | POST oauth/start + polling; busy desabilita |
| Cancelar / Desconectar | button | sim | aborta pending / revoga vínculo; sem token parcial |
| Reconectar | button | condicional | `needs-reauth` |
| Badge provider | status | sim | visível no painel Repositório com projeto git |
| CTA Abrir PR/MR | button | condicional | label via `changeRequestLabels` |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` / `disconnected` | mount sem token | CTA Conectar |
| `connecting` | click Conectar | Conectando… disabled |
| `pending` | OAuth aberto | texto + Cancelar (+ link manual) |
| `connected` | callback OK | pill Conectado + Desconectar |
| `needs-reauth` | token expirado/revogado | pill + Reconectar |
| `error` | falha OAuth/API | alert vermelho; volta disconnected sem token parcial |
| `gitlab-labels` | remote/kind gitlab | CTAs usam MR |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Card` / superfície F02 | chrome dos cards VCS |
| `Button` / pill MCP | Conectar / Desconectar |
| `Badge` / StatusDot | Conectado / requer reconexão / provider no Repositório |
| `InlineFeedback` | erros OAuth / token expirado |
| Helper `changeRequestLabels` | PR vs MR |

## Aceite visual

- [ ] Cards VCS em `#configuracao` batem chrome F02 + faixa OAuth F09
- [ ] Anatomia Conectar → pending → Conectado verificável
- [ ] Badge provider no painel Repositório
- [ ] GitLab mostra MR (não PR) nos CTAs de change-request
- [ ] Sem marca Lion*; só EngrenaCode
- [ ] Tema light/dark/system via tokens

## Perguntas em aberto

- Migrar o card PAT GitHub para OAuth na mesma entrega F24, ou manter PAT + OAuth paralelo?
- Badge provider: dentro de `VcsStatusBar` ou linha própria acima de `GitActions`?
- Azure precisa de `needs-client-id` (como alguns MCPs) ou só PKCE público?

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/PRD.md` §5/§6/§9 F24 | Capacidades e ACs |
| `docs/F02-configuracao-mvp/ui.md` | Coluna Configuração |
| `docs/F09-mcps/ui.md` | Padrão OAuth Conectar |
| `docs/F14-fluxo-git-completo/ui.md` | GitActions / Repositório |
| `docs/F24-multi-vcs/copy.md` | Catálogo de strings |

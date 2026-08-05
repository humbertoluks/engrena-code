# Spec de UI: #mcps (MCPs)

**Feature:** F09-mcps  
**Destino:** EngrenaCode  
**Fonte de referência:** LionCodeLabs (`packages/renderer`)  
**Componente fonte:** `packages/renderer/src/screens/McpsScreen.tsx` (+ `McpFormModal.tsx`, `McpCatalogModal.tsx`, `McpOauthControls.tsx`, `ProjectMcpsModal.tsx`, `mcpForm.logic.ts`; harness em `WorkspaceSidebar.tsx`; avisos de turno em `ThreadDetail.tsx`)  
**Componente destino (previsto):** `packages/renderer/src/screens/McpsScreen.tsx` (+ satélites de form, catálogo, OAuth e vínculo)  
**Última atualização:** 2026-08-05

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F09-mcps/ui/mcps-referencia.png` |
| Light (opcional) | `TODO` |
| Dark (opcional) | `docs/F09-mcps/ui/mcps-referencia.png` (mesmo frame dark) |
| Overlay catálogo (opcional) | `TODO` — `docs/F09-mcps/ui/mcp-catalog-modal-referencia.png` |
| Overlay vínculo (opcional) | `TODO` — `docs/F09-mcps/ui/project-mcps-modal-referencia.png` |

> Mock dark canônico (sintético): `#mcps` com cards ao fundo + modal “Novo MCP” aberto. **Fonte de verdade de copy/anatomia = tabelas deste SDD**, não o PNG quando divergirem (sidebar/chrome e frases do mock podem diferir do `McpsScreen` real). Frames de catálogo / vínculo ainda pendentes.

## Escopo

**Inclui:**

1. Tela global `#mcps`: listagem/CRUD (criar, editar, excluir, habilitar/desabilitar), busca, abas por categoria, cards (nome, badge de transporte, categoria, endpoint truncado, description).
2. Modal “Adicionar do catálogo” (`McpCatalogModal`): ~14 presets first-party; instalar; badge instalado/OAuth/experimental.
3. Modal criar/editar MCP (`McpFormModal`): transports stdio | http | sse; env com `vault:<chave>`; seção Segredos do cofre; headers só literais; aviso Codex Full access.
4. Controles OAuth no card (`McpOauthControls`): Conectar / pending / Conectado / Reconectar / needs-client-id; “Converter para OAuth” opt-in no card quando aplicável.
5. Overlay de vínculo por projeto (`ProjectMcpsModal` / Repo Harness → MCPs): link, enabled no projeto, ordem; badges âmbar “requer credencial” / “cofre travado”; nota de snapshot + Codex.
6. Superfície mínima F03: pill/row “MCPs” no harness (contagem + incompatível âmbar); banner âmbar de `mcp.notice` na thread (omitidos, turno continua).
7. Copy literal (rename de marca e nome reservado), estados, tokens/padrões de superfície, aceite visual.

**Provê (contrato de produto, UI indireta):**

- Tools `mcp__<server>__<tool>` no ambiente do agente quando vinculado e resolvido (comportamento do turno em F03; nesta feature a UI cadastra, autentica e vincula).
- Status omitido/âmbar quando secret/OAuth falha (banner de turno + badges no overlay; F04 consome contagens/status sem layout neste SDD).

**Exclui:** contratos HTTP/SQLite/vault/OAuth PKCE/`prepareMcpsForDispatch` (ficam no `spec.md`); implementação de primitives; marketplace de terceiros; edição de MCP inline no composer.

### Observado na fonte × destino Central F09

| Capacidade PRD | UI fonte |
|----------------|----------|
| Catálogo first-party (~14) + CRUD custom | `McpCatalogModal` + `McpFormModal`; catalog.ts tem 14 presets |
| Nome `^[a-z0-9][a-z0-9_-]*$`; reservado | Fonte: `lioncode`; destino: `engrenacode` (rename) |
| Transports stdio / http / sse | Select no form; badge no card |
| Secrets: refs no vault; header secret rejeitado; GET só keys | Seção “Segredos do cofre”; erro inline em headers com `vault:` |
| OAuth PKCE; Connect / Converter opt-in | `McpOauthControls` + botão “Converter para OAuth” |
| ≤ 8 MCPs vinculados / projeto (recomendação) | **Ausente** na UI; só contagem “N vinculados” |
| Codex MCP exige full-access (aviso UI) | `CODEX_BYPASS_WARNING` no form + `MCP_SNAPSHOT_NOTE` no overlay |
| Falha de resolve → omitted[] + turno continua | Banner âmbar `mcp.notice` em `ThreadDetail` (não aborta) |
| Pills de status no workspace | Row harness + badges de credencial no overlay + banner de turno |

## Anatomia (topo → base)

### A) Tela `#mcps`

Ordem obrigatória no viewport (conteúdo dentro do `AppShell`):

1. Cabeçalho: `h1` “MCPs” + subtítulo + (opcional) `ProviderCapabilityBadges` + CTAs “Adicionar do catálogo” e “+ Novo MCP”.
2. Campo de busca (ícone + input).
3. Abas de categoria (condicionais: só se existir ≥1 categoria): “Todas {N}” + uma aba por categoria com contagem.
4. Slot de erro de carga/ação (condicional).
5. Grid de cards (1 col → 2 cols em `lg`) **ou** empty state.
6. Overlay `McpFormModal` quando `new` / `edit`.
7. Overlay `McpCatalogModal` quando catálogo aberto.

**Card (topo → base):** ícone de marca (ou plug genérico) → nome + badge transporte (mono) + badge categoria + badge “desativado” (se off) → endpoint mono truncado → ações (Ativar/Desativar, Editar, Excluir com confirmação) → description (até 3 linhas) → bloco OAuth (se `authMode === 'oauth'`) → botão “Converter para OAuth” (se elegível).

**Alinhamento:** coluna centrada no shell; conteúdo alinhado à esquerda  
**Largura máx.:** `max-w-[1180px]`

### B) Modal “Adicionar do catálogo”

1. Header: “Adicionar do catálogo” + subtítulo + fechar
2. Slot de erro (condicional)
3. Loading “Carregando catálogo…” **ou** grid de presets (1→2 cols)
4. Por preset: ícone → nome → badges (transporte, OAuth, experimental, categoria, instalado) → description → linha mono `segredos: …` se houver → CTA Instalar|Instalado|Instalando…

**Alinhamento:** centro do viewport  
**Largura máx.:** `max-w-[880px]`; `max-h-[86vh]`

### C) Modal criar/editar MCP

1. Header: “Novo MCP” | “Editar MCP”
2. Campo Nome + hint + erro inline (regex / reservado)
3. Campo Descrição (opcional)
4. Campo Categoria (opcional)
5. Select Transporte (stdio | http | sse)
6. **Se stdio:** Comando + Argumentos + Env (+ erros de parse) + seção “Segredos do cofre” quando há `vault:` refs
7. **Se http/sse:** URL + Headers (+ erros de parse; `vault:` em header rejeitado)
8. Checkbox “Habilitado (toggle global)”
9. Aviso permanente Codex Full access (surface-2)
10. Slot de erro de save
11. Footer: Cancelar + Criar|Salvar

**Alinhamento:** centro do viewport (`place-items-center`); form alinhado à esquerda  
**Largura máx.:** `max-w-[640px]`; `max-h-[88vh]` com scroll interno

### D) Overlay “MCPs deste projeto” (vínculo F03)

1. Header: “MCPs deste projeto” + pill `{N} vinculado(s)` + fechar
2. Busca + abas de categoria (`ProjectLinkingModal`)
3. Nota fixa de snapshot + Codex Full access
4. (Opcional) `ProviderCapabilityBadges`
5. Slot de erro
6. Grid de cards de vínculo **ou** empty (“Nenhum MCP global. Crie no menu MCPs.” / “Nada corresponde aos filtros.”)
7. Por card: nome + badges + meta `transport · endpoint` + warning âmbar se aplicável + switch “Ativo neste projeto” + pill on/off + setas ↑↓ se vinculado

**Alinhamento:** centro do viewport  
**Largura máx.:** `max-w-[880px]`; `max-h-[86vh]`

### E) Acionador harness + avisos de turno (F03, superfície mínima)

1. Row “MCPs” na seção Repo Harness da sidebar: abre `ProjectMcpsModal`. Meta: `{N} vinculado(s)` ou `{N} vinculados · incompatível` (`text-amber` se incompatível).
2. Banner âmbar no topo da thread (`role="status"`) listando `mcp.notice.message` por MCP omitido; dispensável (✕). Turno segue.

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página `#mcps` | `mx-auto w-full max-w-[1180px] px-lg py-lg` sobre `bg-bg text-fg` | |
| Título | `text-[26px] font-bold tracking-tight text-fg` | type-scale Adiada → px observado |
| Subtítulo | `mt-xs text-[13px] text-muted` | |
| CTA secundário (catálogo) | `rounded-sm border border-border bg-surface-2 … hover:border-accent` | |
| CTA primário | `ButtonPrimary` / `bg-accent` | “+ Novo MCP”, Criar/Salvar |
| Busca | `h-[42px] rounded-md border border-border bg-surface … focus:border-accent` | ícone muted à esquerda |
| Aba categoria ativa | `border-b-2 border-accent text-fg` + contagem `text-accent` | |
| Aba inativa | `border-transparent text-muted hover:text-fg` | |
| Card | `rounded-lg border border-border bg-surface p-lg` | `opacity-60` se desativado |
| Badge transporte | `rounded-md bg-accent … font-mono text-[11px] text-bg` | |
| Badge categoria / desativado | `rounded-full border border-border … text-muted` | |
| Endpoint | `font-mono text-[11.5px] text-muted truncate` | |
| Description | `text-[12.5px] text-muted line-clamp-3` | |
| Modal overlay | `fixed inset-0 z-50 … bg-black/50` + painel `rounded-lg border border-border bg-surface shadow-lg` | |
| Label de campo (form) | `text-[12px] font-semibold uppercase tracking-[0.04em] text-muted` | |
| Input / textarea / select | `border-border bg-surface-2 text-fg` + `focus:border-accent focus-visible:ring-2 focus-visible:ring-accent` | command/args/env/url/headers em `font-mono` |
| Hint | `text-[11.5px] text-muted` | |
| Seção vault | `rounded-sm border border-border bg-surface-2/40` | |
| Badge secret definido | `border-green/60 text-green` | |
| Badge secret vazio | `border-border text-muted` | |
| OAuth Conectado | `border-green/60 text-green` | |
| OAuth needs-reauth / warning | `border-amber/60 text-amber` | |
| Catalog instalado | `border-green/60 text-green`; card `border-accent` | |
| Catalog experimental | `border-amber/60 text-amber` | |
| Card vínculo ativo | `border-accent/50` | |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |
| Erro | `text-red` / `role="alert"` | |
| Aviso / omitido | `text-amber` / `bg-amber/[0.10]` (banner turno) | |
| Harness incompatível | meta `text-amber` | |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Marca no erro de rede / notes | LionCode | EngrenaCode |
| Nome reservado | `lioncode` | `engrenacode` |
| Tool names no turno | `mcp__<server>__<tool>` | mesmo padrão; broker interno `engrenacode` |
| Catálogo | 14 presets (comentário no arquivo ainda diz “10”) | manter lista viva do server |
| Soft cap vínculos | ≤ 8 (PRD) | **sem** warn na UI fonte |
| Type sizes | 26 / 17 / 16 / 15 / 13 / 12.5 / 11.5 px | papéis display/title/body/caption |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `LionCode → EngrenaCode`; `lioncode → engrenacode` (nome reservado). Células = texto final no destino.

### Tela `#mcps`

| Slot | Texto |
|------|-------|
| `title` | MCPs |
| `subtitle` | Servers MCP externos (stdio, http, sse) disponíveis aos agentes. Vincule-os a um projeto na tela principal para entrarem no turno. |
| `cta.catalog` | Adicionar do catálogo |
| `cta.new` | + Novo MCP |
| `search.placeholder` | Buscar por nome ou descrição… |
| `tab.all` | Todas |
| `empty.none` | Nenhum MCP ainda. Crie com “+ Novo MCP”. |
| `empty.filtered` | Nenhum MCP corresponde aos filtros. |
| `card.badge.disabled` | desativado |
| `card.action.enable` | Ativar |
| `card.action.disable` | Desativar |
| `card.action.edit` | Editar |
| `card.action.delete` | Excluir |
| `card.action.delete.confirm` | Excluir? |
| `card.action.delete.cancel` | Não |
| `card.cta.convertOauth` | Converter para OAuth |
| `card.cta.convertOauth.title` | Troca esta definição pela versão remota OAuth do catálogo (vínculos por projeto preservados) |
| `error.load` | Não foi possível carregar os MCPs. |
| `error.delete` | Não foi possível excluir o MCP. |
| `error.update` | Não foi possível atualizar o MCP. |
| `error.convert` | Não foi possível converter o MCP para OAuth. |

### Modal catálogo

| Slot | Texto |
|------|-------|
| `catalog.title` | Adicionar do catálogo |
| `catalog.subtitle` | Presets first-party prontos — instalar cria a definição global; os segredos você preenche no cofre em seguida. |
| `catalog.loading` | Carregando catálogo… |
| `catalog.badge.oauth` | OAuth |
| `catalog.badge.experimental` | experimental |
| `catalog.badge.installed` | instalado |
| `catalog.meta.secrets` | segredos: {keys} |
| `catalog.cta.install` | Instalar |
| `catalog.cta.installed` | Instalado |
| `catalog.cta.installing` | Instalando… |
| `catalog.error.load` | Não foi possível carregar o catálogo. |
| `catalog.error.vaultLocked` | Cofre travado — destrave o cofre para instalar do catálogo. |
| `catalog.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. |
| `catalog.error.install` | Não foi possível instalar o preset. Tente novamente. |
| `catalog.aria.close` | Fechar |

### Modal criar/editar

| Slot | Texto |
|------|-------|
| `form.title.new` | Novo MCP |
| `form.title.edit` | Editar MCP |
| `form.label.name` | Nome |
| `form.hint.name` | Chave única global (vira a chave do mcpServers). |
| `form.placeholder.name` | ex.: github-mcp |
| `form.error.name.reserved` | O nome "engrenacode" é reservado (broker interno). |
| `form.error.name.pattern` | Use minúsculas, dígitos, "_" e "-" (começando por letra ou dígito). |
| `form.label.description` | Descrição |
| `form.hint.description` | Opcional. |
| `form.placeholder.description` | ex.: acesso à API do GitHub |
| `form.label.category` | Categoria |
| `form.hint.category` | Opcional — agrupa no menu. |
| `form.placeholder.category` | ex.: integrações |
| `form.label.transport` | Transporte |
| `form.transport.stdio` | stdio (comando local) |
| `form.transport.http` | http (url remota) |
| `form.transport.sse` | sse (url remota) |
| `form.label.command` | Comando |
| `form.hint.command` | Executável a spawnar (transporte stdio). |
| `form.placeholder.command` | ex.: npx |
| `form.label.args` | Argumentos |
| `form.hint.args` | Um argumento por linha. |
| `form.label.env` | Env |
| `form.hint.env` | Uma variável por linha, no formato KEY=VALUE — use vault:nome_da_chave para referenciar um segredo do cofre. Valores literais ficam em texto plano no banco local (SQLite) — valores sensíveis devem usar vault:<chave> (cifrado no cofre). |
| `form.placeholder.env` | GITHUB_TOKEN=vault:github_token |
| `form.secrets.title` | Segredos do cofre |
| `form.secrets.vaultLocked` | Cofre travado — destrave o cofre para consultar e gravar segredos. |
| `form.secrets.note` | O valor nunca é exibido — só o estado definido/vazio. |
| `form.secrets.badge.defined` | definido |
| `form.secrets.badge.empty` | vazio |
| `form.secrets.placeholder.replace` | substituir valor… |
| `form.secrets.placeholder.empty` | valor do segredo… |
| `form.secrets.cta.save` | Gravar |
| `form.secrets.cta.clear` | Limpar |
| `form.secrets.error` | Não foi possível gravar no cofre. Tente novamente. |
| `form.label.url` | URL |
| `form.hint.url` | Endpoint do server (transporte {transport}). |
| `form.placeholder.url` | https://mcp.exemplo.com/sse |
| `form.label.headers` | Headers |
| `form.hint.headers` | Um header por linha, no formato "Nome: valor". |
| `form.placeholder.headers` | Authorization: Bearer ... |
| `form.error.header.vault` | Header secreto não é suportado no v1 ({key}): vault:<chave> só vale em env. |
| `form.toggle.enabled` | Habilitado (toggle global) |
| `form.warn.codex` | No Codex, integrações MCP exigem Full access explícito; não há bypass ou desativação automática do sandbox. |
| `form.cta.cancel` | Cancelar |
| `form.cta.create` | Criar |
| `form.cta.save` | Salvar |
| `form.cta.loading` | Salvando... |
| `form.error.network` | Nao foi possivel contatar o servidor local. Verifique se o EngrenaCode esta em execucao. |
| `form.error.generic` | Nao foi possivel salvar o MCP. Tente novamente. |
| `form.error.nameConflict` | Ja existe um MCP com este nome. Escolha outro. |

### OAuth no card

| Slot | Texto |
|------|-------|
| `oauth.cta.connect` | Conectar |
| `oauth.cta.connecting` | Conectando… |
| `oauth.cta.disconnect` | Desconectar |
| `oauth.cta.cancel` | Cancelar |
| `oauth.cta.reconnect` | Reconectar |
| `oauth.badge.connected` | Conectado |
| `oauth.badge.needsReauth` | requer reconexão |
| `oauth.pending` | Aguardando autorização no browser… |
| `oauth.openManual` | abrir manualmente |
| `oauth.needsClientId.hint` | Este vendor exige registro manual: crie um OAuth App e cole o client_id. |
| `oauth.placeholder.clientId` | client_id |
| `oauth.cta.saveClientId` | Salvar |
| `oauth.error.vaultLocked` | Destranque o cofre para conectar. |
| `oauth.error.poll` | Sem resposta do servidor local — tente conectar de novo. |
| `oauth.error.start` | Falha ao iniciar a conexão. |
| `oauth.error.disconnect` | Falha ao desconectar. |
| `oauth.error.clientId` | Falha ao salvar o client_id. |
| `oauth.error.connectFailed` | Não foi possível conectar. Tente novamente. |

> `oauth.error.connectFailed` vem do PRD (tratamento de erros F09). Na fonte o card usa `error.message` da API ou `oauth.error.start`; alinhar destino ao PRD quando a API não trouxer mensagem.

### Overlay vínculo por projeto

| Slot | Texto |
|------|-------|
| `link.title` | MCPs deste projeto |
| `link.empty` | Nenhum MCP global. Crie no menu MCPs. |
| `link.empty.filtered` | Nada corresponde aos filtros. |
| `link.note` | As mudanças valem no próximo turno — um turno em andamento mantém o snapshot de MCPs de quando começou. No Codex, integrações MCP exigem Full access explícito; não há bypass ou desativação automática do sandbox. |
| `link.badge.needsCredential` | requer credencial |
| `link.badge.vaultLocked` | cofre travado |
| `link.toggle` | Ativo neste projeto |
| `link.aria.toggle` | Ativar {name} neste projeto |
| `link.pill.on` | on |
| `link.pill.off` | off |
| `link.pill.title.on` | Habilitada neste projeto |
| `link.pill.title.off` | Desabilitada neste projeto |
| `link.move.up` | Subir {name} |
| `link.move.down` | Descer {name} |
| `link.count.one` | {N} vinculado |
| `link.count.many` | {N} vinculados |
| `link.error.load` | Não foi possível carregar os MCPs do projeto. |
| `link.error.link` | Não foi possível atualizar o vínculo. |
| `link.error.enabled` | Não foi possível alterar o estado no projeto. |
| `link.error.reorder` | Não foi possível reordenar. |
| `harness.pill` | MCPs |
| `harness.meta.compatible` | {N} vinculado(s) |
| `harness.meta.incompatible` | {N} vinculado(s) · incompatível |

### Banner de turno (omitidos)

| Slot | Texto |
|------|-------|
| `turn.notice.template` | MCP '{name}' fora deste turno: {action}. |
| `turn.notice.action.vault_locked` | desbloqueie o cofre antes de iniciar outro turno |
| `turn.notice.action.missing_secret` | configure a credencial exigida na tela de MCPs |
| `turn.notice.action.header_secret_ref` | corrija a configuração de autenticação do MCP |
| `turn.notice.action.server_dist_missing` | recompile o servidor MCP instalado |
| `turn.notice.action.wrapper_unavailable` | recompile o wrapper seguro de MCPs |
| `turn.notice.action.oauth_unavailable` | reconecte via OAuth na tela de MCPs |
| `turn.notice.action.codex_auth_required` | configure OAuth para usar este MCP HTTP no Codex |
| `turn.notice.action.unsupported_transport` | use um transporte suportado pelo provider selecionado |
| `turn.notice.dismiss` | Dispensar avisos |

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `search` | search | não | filtra nome + description (client-side) |
| `categoryTab` | tabs | — | “Todas” ou categoria exata |
| `cta.catalog` | button | — | abre `McpCatalogModal` |
| `cta.new` | button | — | abre form `new` |
| `card.toggleEnabled` | icon button | — | update otimista `enabled`; reverte no erro |
| `card.edit` | icon button | — | abre form `edit` |
| `card.delete` | icon + confirm | — | “Excluir?” / “Não”; depois `deleteMcp` |
| `card.convertOauth` | button | — | só se preset irmão OAuth e `authMode !== 'oauth'` |
| `catalog.install` | button | — | `installMcpPreset`; 409 → marca instalado; key-mode abre form edit |
| `form.name` | text | sim | regex + reservado `engrenacode`; 409 → nameConflict |
| `form.description` | text | não | vazio → `null` |
| `form.category` | text | não | vazio → `null` |
| `form.transport` | select | sim | default `stdio` |
| `form.command` | text | se stdio | obrigatório quando stdio |
| `form.args` | textarea | não | um por linha |
| `form.env` | textarea | não | `KEY=VALUE`; `vault:` → secretRef |
| `form.secretValue` | password | — | por ref; Gravar/Limpar; nunca ecoa valor |
| `form.url` | text | se http/sse | HTTPS remoto / HTTP loopback (validação server) |
| `form.headers` | textarea | não | literais only; `vault:` rejeitado inline |
| `form.enabled` | checkbox | — | default `true` em create |
| `form.submit` | button | — | disabled se inválido ou `saving` |
| `oauth.connect` | button | — | start + poll 2s enquanto pending |
| `oauth.clientId` | text | se needs-client-id | PUT client; depois volta a disconnected |
| `link.linked` | checkbox switch | — | PUT link / DELETE unlink |
| `link.enabledInProject` | pill | — | só se `linked` |
| `link.reorder` | ↑↓ | — | `sortOrder` entre vinculados |
| `harness.mcps` | button row | — | abre overlay; disabled sem projeto |
| `turn.notice.dismiss` | button | — | limpa banners locais |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | mount com lista | grid ou empty; CTAs catálogo + Novo |
| `filling` | busca / form | filtra lista; parse env/headers ao digitar |
| `loading` | save form / install / oauth busy | “Salvando...” / “Instalando…” / “Conectando…”; controles travados |
| `disabled` | form inválido / busyId / vault locked em secrets | submit/secret inputs disabled |
| `error` | load/save/delete/link/oauth falha | `role="alert"` vermelho |
| `empty` | zero MCPs | copy `empty.none` |
| `emptyFiltered` | filtros sem match | `empty.filtered` / `link.empty.filtered` |
| `cardDisabled` | `enabled === false` | `opacity-60` + badge “desativado” |
| `pendingDelete` | clique Excluir | “Excluir?” / “Não” |
| `catalogLoading` | fetch presets | “Carregando catálogo…” |
| `catalogInstalled` | preset já instalado / 409 | badge + CTA “Instalado” disabled |
| `oauth.disconnected` | status | botão Conectar |
| `oauth.pending` | flow ativo | copy pending + abrir manualmente + Cancelar; poll |
| `oauth.connected` | status | badge Conectado + Desconectar |
| `oauth.needs-reauth` | status | badge âmbar + Reconectar |
| `oauth.needs-client-id` | status / API | input client_id + Salvar |
| `secrets.vaultLocked` | 423 | aviso âmbar; inputs desabilitados |
| `link.needsCredential` | secretRef ausente no vault | badge âmbar no card do overlay |
| `turn.omitted` | `mcp.notice` | banner âmbar; turno continua |
| `harness.incompatible` | capability efetiva off | meta âmbar “· incompatível” |
| `nameConflict` | API `mcp_name_conflict` | erro inline no form |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Card` | MCP card na grid; preset catalog; card de vínculo |
| `Field` | labels + input/textarea/select + hint/erro no form |
| `Input` / `Textarea` / `Select` | busca, nome, env, headers, url, transport |
| `Button` | Novo MCP, Criar/Salvar (primary), catálogo, OAuth, Cancelar |
| `Badge` | transporte, categoria, desativado, OAuth, instalado, warning |
| `Tabs` | categorias |
| `Modal` / `Dialog` | Form, Catalog, ProjectLinking |
| `IconButton` | ativar, editar, excluir, reordenar |
| `EmptyState` | lista e vínculo vazios |
| `ProviderCapabilityBadges` | slot de compatibilidade (tela + overlay) |
| `Switch` | “Ativo neste projeto” |
| `StatusBanner` | avisos `mcp.notice` na thread (âmbar) |

## Aceite visual

- [ ] Bate com a referência visual em dark (e light se aplicável) quando o PNG existir
- [ ] Anatomia `#mcps` na ordem documentada; subtítulo menciona vínculo na tela principal
- [ ] Tabela de copy aplicada (lista, catálogo, form, OAuth, vínculo, harness, banner) com rename EngrenaCode / `engrenacode`
- [ ] Card mostra nome + transporte + endpoint; toggle/editar/excluir com confirmação
- [ ] Catálogo: instalar cria def; key-mode abre form; OAuth-mode nasce com Conectar
- [ ] Form: regex de nome; reservado `engrenacode`; `vault:` em header rejeitado; aviso Codex presente
- [ ] Segredos: só estado definido/vazio; valor nunca ecoado
- [ ] Converter para OAuth **opt-in** (nunca silencioso)
- [ ] Overlay: badges “requer credencial” / “cofre travado”; nota de snapshot
- [ ] Soft cap ≤ 8 **não** bloqueia aceite (ausente na fonte; ver perguntas)
- [ ] Omit omitido: banner âmbar sem abortar o turno
- [ ] Contagens do dashboard **não** bloqueiam aceite desta tela (F04)
- [ ] Tema `light` \| `dark` \| `system` via tokens

## Perguntas em aberto

- Soft cap ≤ 8 MCPs vinculados por projeto: só orientação no PRD ou warning na UI do overlay?
- Ortografia das mensagens de rede/save sem acento na fonte (`Nao foi possivel…`): normalizar PT-BR no destino ou preservar byte-a-byte após rename de marca?
- `preset.notes` do catálogo (ex. Figma) não são renderizados no `McpCatalogModal` da fonte — exibir no destino?
- Frames de catálogo / vínculo (`mcp-catalog-modal-referencia.png`, `project-mcps-modal-referencia.png`) ainda `TODO`.
- Mensagem canônica de falha OAuth do PRD (“Não foi possível conectar. Tente novamente.”) vs `error.message` dinâmico da API: qual prevalece no card?

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F09-mcps/spec.md` | Contratos API/CRUD/OAuth/secrets/resolve |
| `docs/F09-mcps/copy.md` | Catálogo de microcopy (`mcps.*` / `mcpsForm.*` / `mcpsCatalog.*` / `mcpsLink.*` / `mcpsOauth.*` / `mcpsTurn.*`) |
| `docs/F01-vault-e-sessao-local/spec.md` | Vault para secrets e tokens OAuth |
| `docs/F03-workspace/ui.md` | Harness e thread onde pills/banner aparecem |
| `docs/F04-dashboard` (ui/spec) | Consumo de status omitido/âmbar — fora deste SDD |
| `_reversa_sdd/sdd/design-system.md` | Tokens e superfícies |

# Catálogo de copy: F09-mcps

**Produto:** EngrenaCode  
**Fonte:** sistema legado (`packages/renderer` — `McpsScreen`, `McpFormModal`, `McpCatalogModal`, `McpOauthControls`, `ProjectMcpsModal`; avisos em `ThreadDetail` / `dispatch.mcpOmissionMessage`)  
**Mapa de rename:** `legado → EngrenaCode`; `legado → engrenacode` (nome reservado)  
**Última atualização:** 2026-08-05

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`{tela}.{slot}`  
Telas neste catálogo: `mcps` (`#mcps`), `mcpsCatalog`, `mcpsForm`, `mcpsOauth`, `mcpsLink`, `mcpsTurn`.

## Telas

### mcps (`#mcps`)

| Id | Texto | Notas |
|----|-------|-------|
| `mcps.title` | MCPs | h1 |
| `mcps.subtitle` | Servers MCP externos (stdio, http, sse) disponíveis aos agentes. Vincule-os a um projeto na tela principal para entrarem no turno. | |
| `mcps.cta.catalog` | Adicionar do catálogo | secundário |
| `mcps.cta.new` | + Novo MCP | primary |
| `mcps.search.placeholder` | Buscar por nome ou descrição… | |
| `mcps.tab.all` | Todas | contagem dinâmica ao lado |
| `mcps.empty.none` | Nenhum MCP ainda. Crie com “+ Novo MCP”. | |
| `mcps.empty.filtered` | Nenhum MCP corresponde aos filtros. | |
| `mcps.card.badge.disabled` | desativado | |
| `mcps.card.action.enable` | Ativar | title / aria-label |
| `mcps.card.action.disable` | Desativar | |
| `mcps.card.action.edit` | Editar | |
| `mcps.card.action.delete` | Excluir | |
| `mcps.card.action.delete.confirm` | Excluir? | |
| `mcps.card.action.delete.cancel` | Não | |
| `mcps.card.cta.convertOauth` | Converter para OAuth | opt-in |
| `mcps.card.cta.convertOauth.title` | Troca esta definição pela versão remota OAuth do catálogo (vínculos por projeto preservados) | |
| `mcps.error.load` | Não foi possível carregar os MCPs. | |
| `mcps.error.delete` | Não foi possível excluir o MCP. | |
| `mcps.error.update` | Não foi possível atualizar o MCP. | |
| `mcps.error.convert` | Não foi possível converter o MCP para OAuth. | |

### mcpsCatalog (modal Adicionar do catálogo)

| Id | Texto | Notas |
|----|-------|-------|
| `mcpsCatalog.title` | Adicionar do catálogo | |
| `mcpsCatalog.subtitle` | Presets first-party prontos — instalar cria a definição global; os segredos você preenche no cofre em seguida. | |
| `mcpsCatalog.loading` | Carregando catálogo… | |
| `mcpsCatalog.badge.oauth` | OAuth | |
| `mcpsCatalog.badge.experimental` | experimental | |
| `mcpsCatalog.badge.installed` | instalado | |
| `mcpsCatalog.meta.secrets` | segredos: {keys} | keys = join `, ` |
| `mcpsCatalog.cta.install` | Instalar | |
| `mcpsCatalog.cta.installed` | Instalado | disabled |
| `mcpsCatalog.cta.installing` | Instalando… | |
| `mcpsCatalog.error.load` | Não foi possível carregar o catálogo. | |
| `mcpsCatalog.error.vaultLocked` | Cofre travado — destrave o cofre para instalar do catálogo. | |
| `mcpsCatalog.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. | rename |
| `mcpsCatalog.error.install` | Não foi possível instalar o preset. Tente novamente. | |
| `mcpsCatalog.aria.close` | Fechar | |

### mcpsForm (modal Novo / Editar MCP)

| Id | Texto | Notas |
|----|-------|-------|
| `mcpsForm.title.new` | Novo MCP | |
| `mcpsForm.title.edit` | Editar MCP | |
| `mcpsForm.label.name` | Nome | |
| `mcpsForm.hint.name` | Chave única global (vira a chave do mcpServers). | |
| `mcpsForm.placeholder.name` | ex.: github-mcp | |
| `mcpsForm.error.name.reserved` | O nome "engrenacode" é reservado (broker interno). | rename de `legado` |
| `mcpsForm.error.name.pattern` | Use minúsculas, dígitos, "_" e "-" (começando por letra ou dígito). | |
| `mcpsForm.label.description` | Descrição | |
| `mcpsForm.hint.description` | Opcional. | |
| `mcpsForm.placeholder.description` | ex.: acesso à API do GitHub | |
| `mcpsForm.label.category` | Categoria | |
| `mcpsForm.hint.category` | Opcional — agrupa no menu. | |
| `mcpsForm.placeholder.category` | ex.: integrações | |
| `mcpsForm.label.transport` | Transporte | |
| `mcpsForm.transport.stdio` | stdio (comando local) | |
| `mcpsForm.transport.http` | http (url remota) | |
| `mcpsForm.transport.sse` | sse (url remota) | |
| `mcpsForm.label.command` | Comando | |
| `mcpsForm.hint.command` | Executável a spawnar (transporte stdio). | |
| `mcpsForm.placeholder.command` | ex.: npx | |
| `mcpsForm.label.args` | Argumentos | |
| `mcpsForm.hint.args` | Um argumento por linha. | |
| `mcpsForm.label.env` | Env | |
| `mcpsForm.hint.env` | Uma variável por linha, no formato KEY=VALUE — use vault:nome_da_chave para referenciar um segredo do cofre. Valores literais ficam em texto plano no banco local (SQLite) — valores sensíveis devem usar vault:<chave> (cifrado no cofre). | inclui `ENV_LOCAL_WARNING` |
| `mcpsForm.placeholder.env` | GITHUB_TOKEN=vault:github_token | |
| `mcpsForm.secrets.title` | Segredos do cofre | |
| `mcpsForm.secrets.vaultLocked` | Cofre travado — destrave o cofre para consultar e gravar segredos. | |
| `mcpsForm.secrets.note` | O valor nunca é exibido — só o estado definido/vazio. | |
| `mcpsForm.secrets.badge.defined` | definido | |
| `mcpsForm.secrets.badge.empty` | vazio | |
| `mcpsForm.secrets.placeholder.replace` | substituir valor… | |
| `mcpsForm.secrets.placeholder.empty` | valor do segredo… | |
| `mcpsForm.secrets.cta.save` | Gravar | não colide com Salvar do form |
| `mcpsForm.secrets.cta.clear` | Limpar | |
| `mcpsForm.secrets.error` | Não foi possível gravar no cofre. Tente novamente. | |
| `mcpsForm.label.url` | URL | |
| `mcpsForm.hint.url` | Endpoint do server (transporte {transport}). | |
| `mcpsForm.placeholder.url` | https://mcp.exemplo.com/sse | |
| `mcpsForm.label.headers` | Headers | |
| `mcpsForm.hint.headers` | Um header por linha, no formato "Nome: valor". | |
| `mcpsForm.placeholder.headers` | Authorization: Bearer ... | |
| `mcpsForm.error.header.vault` | Header secreto não é suportado no v1 ({key}): vault:<chave> só vale em env. | |
| `mcpsForm.toggle.enabled` | Habilitado (toggle global) | |
| `mcpsForm.warn.codex` | No Codex, integrações MCP exigem Full access explícito; não há bypass ou desativação automática do sandbox. | |
| `mcpsForm.cta.cancel` | Cancelar | |
| `mcpsForm.cta.create` | Criar | |
| `mcpsForm.cta.save` | Salvar | |
| `mcpsForm.cta.loading` | Salvando... | |
| `mcpsForm.error.network` | Nao foi possivel contatar o servidor local. Verifique se o EngrenaCode esta em execucao. | rename; ortografia da fonte |
| `mcpsForm.error.generic` | Nao foi possivel salvar o MCP. Tente novamente. | |
| `mcpsForm.error.nameConflict` | Ja existe um MCP com este nome. Escolha outro. | API `mcp_name_conflict` |

### mcpsOauth (controles no card)

| Id | Texto | Notas |
|----|-------|-------|
| `mcpsOauth.cta.connect` | Conectar | |
| `mcpsOauth.cta.connecting` | Conectando… | |
| `mcpsOauth.cta.disconnect` | Desconectar | |
| `mcpsOauth.cta.cancel` | Cancelar | |
| `mcpsOauth.cta.reconnect` | Reconectar | |
| `mcpsOauth.badge.connected` | Conectado | |
| `mcpsOauth.badge.needsReauth` | requer reconexão | |
| `mcpsOauth.pending` | Aguardando autorização no browser… | |
| `mcpsOauth.openManual` | abrir manualmente | |
| `mcpsOauth.needsClientId.hint` | Este vendor exige registro manual: crie um OAuth App e cole o client_id. | |
| `mcpsOauth.placeholder.clientId` | client_id | |
| `mcpsOauth.cta.saveClientId` | Salvar | |
| `mcpsOauth.error.vaultLocked` | Destranque o cofre para conectar. | |
| `mcpsOauth.error.poll` | Sem resposta do servidor local — tente conectar de novo. | |
| `mcpsOauth.error.start` | Falha ao iniciar a conexão. | fallback genérico fonte |
| `mcpsOauth.error.disconnect` | Falha ao desconectar. | |
| `mcpsOauth.error.clientId` | Falha ao salvar o client_id. | |
| `mcpsOauth.error.connectFailed` | Não foi possível conectar. Tente novamente. | PRD F09; preferir se API sem message |

### mcpsLink (overlay “MCPs deste projeto”)

| Id | Texto | Notas |
|----|-------|-------|
| `mcpsLink.title` | MCPs deste projeto | |
| `mcpsLink.empty` | Nenhum MCP global. Crie no menu MCPs. | |
| `mcpsLink.empty.filtered` | Nada corresponde aos filtros. | |
| `mcpsLink.note` | As mudanças valem no próximo turno — um turno em andamento mantém o snapshot de MCPs de quando começou. No Codex, integrações MCP exigem Full access explícito; não há bypass ou desativação automática do sandbox. | `MCP_SNAPSHOT_NOTE` |
| `mcpsLink.badge.needsCredential` | requer credencial | âmbar |
| `mcpsLink.badge.vaultLocked` | cofre travado | âmbar |
| `mcpsLink.toggle` | Ativo neste projeto | |
| `mcpsLink.aria.toggle` | Ativar {name} neste projeto | |
| `mcpsLink.pill.on` | on | |
| `mcpsLink.pill.off` | off | |
| `mcpsLink.pill.title.on` | Habilitada neste projeto | |
| `mcpsLink.pill.title.off` | Desabilitada neste projeto | |
| `mcpsLink.move.up` | Subir {name} | |
| `mcpsLink.move.down` | Descer {name} | |
| `mcpsLink.count.one` | {N} vinculado | |
| `mcpsLink.count.many` | {N} vinculados | |
| `mcpsLink.error.load` | Não foi possível carregar os MCPs do projeto. | |
| `mcpsLink.error.link` | Não foi possível atualizar o vínculo. | |
| `mcpsLink.error.enabled` | Não foi possível alterar o estado no projeto. | |
| `mcpsLink.error.reorder` | Não foi possível reordenar. | |
| `mcpsLink.harness.pill` | MCPs | |
| `mcpsLink.harness.meta.compatible` | {N} vinculado(s) | |
| `mcpsLink.harness.meta.incompatible` | {N} vinculado(s) · incompatível | text-amber |

### mcpsTurn (banner de omissão no turno)

| Id | Texto | Notas |
|----|-------|-------|
| `mcpsTurn.notice.template` | MCP '{name}' fora deste turno: {action}. | server `mcpOmissionMessage` |
| `mcpsTurn.notice.action.vault_locked` | desbloqueie o cofre antes de iniciar outro turno | |
| `mcpsTurn.notice.action.missing_secret` | configure a credencial exigida na tela de MCPs | |
| `mcpsTurn.notice.action.header_secret_ref` | corrija a configuração de autenticação do MCP | |
| `mcpsTurn.notice.action.server_dist_missing` | recompile o servidor MCP instalado | |
| `mcpsTurn.notice.action.wrapper_unavailable` | recompile o wrapper seguro de MCPs | |
| `mcpsTurn.notice.action.oauth_unavailable` | reconecte via OAuth na tela de MCPs | |
| `mcpsTurn.notice.action.codex_auth_required` | configure OAuth para usar este MCP HTTP no Codex | |
| `mcpsTurn.notice.action.unsupported_transport` | use um transporte suportado pelo provider selecionado | |
| `mcpsTurn.notice.dismiss` | Dispensar avisos | aria-label |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{N}` | contagem (vinculados, abas) |
| `{name}` | nome do MCP |
| `{key}` | chave de header inválida |
| `{keys}` | lista de secretKeys do preset |
| `{transport}` | `http` ou `sse` no hint de URL |
| `{action}` | frase de ação do reason de omissão |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `mcpsLink.warn.softCap8` | PRD recomenda ≤ 8 vinculados; UI fonte não avisa | TODO |
| `mcpsCatalog.notes.*` | `preset.notes` existem no server mas não renderizam no modal | TODO |
| Frames catálogo / vínculo | `mcp-catalog-modal-referencia.png`, `project-mcps-modal-referencia.png` | TODO |

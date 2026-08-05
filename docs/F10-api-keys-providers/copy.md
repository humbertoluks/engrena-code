# Catálogo de copy: F10-api-keys-providers

**Produto:** EngrenaCode  
**Fonte:** sistema legado (`ConfiguracaoScreen` / `ClaudeAuthCard`, `KeysForm`)  
**Mapa de rename:** `legado → EngrenaCode`  
**Última atualização:** 2026-08-05

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`{tela}.{slot}`  
Telas: `claude` (card auth), `keys` (card API keys), `composer` (indireto F03).

## Telas

### claude (Autenticação do Claude)

| Id | Texto | Notas |
|----|-------|-------|
| `claude.title` | Autenticação do Claude | |
| `claude.subtitle` | Escolha como o Claude autentica. Na **assinatura**, sua key salva fica como fallback inerte e nunca cobra a API sozinha; em **API key**, a key do cofre passa a cobrar por uso. | |
| `claude.mode.subscription` | Assinatura | |
| `claude.mode.api-key` | API key | |
| `claude.mode.aria` | Modo de autenticação do Claude | |
| `claude.mode.api-key.disabledHint` | Salve uma key Claude abaixo para habilitar. | title do segment disabled |
| `claude.status.subscription.ok` | ✓ Usando a assinatura (Claude Code) — sem cobrança de API. | |
| `claude.status.subscription.missing` | Assinatura selecionada, mas não detectei login do Claude Code. Rode `claude` no terminal para autenticar. | |
| `claude.status.api-key.warn` | ⚠ Usando API key — isto **cobra por uso** da API Anthropic. | |
| `claude.status.api-key.noKey` | Nenhuma key salva: os turnos vão falhar. Volte para Assinatura ou salve a key abaixo. | inclui substring PRD |
| `claude.cta.test` | Testar conexão | |
| `claude.cta.test.loading` | Testando... | |
| `claude.error.switch` | Não foi possível alterar o modo. Tente novamente. | |
| `claude.error.test` | Não foi possível testar a conexão agora. | |
| `claude.verify.ok.subscription` | ✓ Assinatura (Claude Code) respondeu — conectado. | prefixo UI + detail server |
| `claude.verify.ok.api-key` | ✓ API key respondeu — conectado (cobrando a API). | |
| `claude.verify.fail.subscription` | ✗ Assinatura nao respondeu. | ortografia da fonte |
| `claude.verify.fail.api-key` | ✗ API key nao respondeu. | |
| `claude.verify.rateLimit` | Limite de uso da Anthropic (rate limit) — a credencial está válida, mas o limite impede o teste agora; tente de novo em alguns minutos. | |
| `claude.verify.timeout` | Tempo esgotado ao testar a conexao. | |
| `claude.dot.ok` | Autenticado | title |
| `claude.dot.ko` | Não autenticado | title |

### keys (API keys dos providers)

| Id | Texto | Notas |
|----|-------|-------|
| `keys.title` | API keys dos providers | |
| `keys.subtitle` | Claude, Codex e Minimax guardam a key no cofre local. Claude só cobra em modo API key (na assinatura a key fica inerte). Codex e Minimax usam a key quando configurada. | **destino** (PRD); não usar subtítulo da fonte |
| `keys.cta.save` | Salvar chaves | |
| `keys.cta.loading` | Salvando... | |
| `keys.success` | Chaves salvas localmente (não validadas com o provider). | |
| `keys.badge.configured` | configurada | |
| `keys.badge.missing` | não configurada | |
| `keys.label.claude` | Claude | |
| `keys.placeholder.claude` | sk-ant-… | |
| `keys.error.claude.format` | Formato inválido. Esperado: sk-ant-… | |
| `keys.label.codex` | Codex | |
| `keys.placeholder.codex` | sk-codex-… | |
| `keys.error.codex.format` | Formato inválido. Esperado: sk-… ou sk-codex-… | destino PRD |
| `keys.label.minimax` | Minimax | |
| `keys.placeholder.minimax` | mm-… | |
| `keys.error.spaces` | A chave não pode conter espaços. | |
| `keys.error.short` | Chave muito curta para ser válida. | ≥8 |
| `keys.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. | rename |
| `keys.error.write` | Não foi possível gravar localmente (sem permissão de escrita ou disco cheio). Nada foi salvo. | |
| `keys.error.invalid_request` | Algum campo tem formato inválido. Revise e tente novamente. | |
| `keys.error.generic` | Não foi possível salvar. Tente novamente. | |
| `keys.reveal` | Revelar {label} | |
| `keys.hide` | Ocultar {label} | |

### composer (indireto)

| Id | Texto | Notas |
|----|-------|-------|
| `composer.minimax.unavailable` | TODO | fixar motivo canônico Minimax sem key |
| `composer.claude.apiKey.unavailable` | TODO | alinhar a `claude.status.api-key.noKey` |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{label}` | nome do provider no reveal/hide |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `composer.minimax.unavailable` | reason vem de capabilities; string canônica EngrenaCode | TODO |
| `composer.claude.apiKey.unavailable` | gate F03 vs copy do card | TODO |
| Subtítulo fonte GLM/Codex | conflita PRD | resolvido no destino via `keys.subtitle` |

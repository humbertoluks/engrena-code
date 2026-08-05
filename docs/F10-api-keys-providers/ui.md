# Spec de UI: #configuracao — bloco API keys (F10)

**Feature:** F10-api-keys-providers  
**Destino:** EngrenaCode  
**Fonte de referência:** sistema legado (`packages/renderer`)  
**Componente fonte:** `packages/renderer/src/screens/ConfiguracaoScreen.tsx` (`ClaudeAuthCard`) + `packages/renderer/src/components/KeysForm.tsx` (`layout="keyrow"`, providers)  
**Componente destino (previsto):** mesmos caminhos na superfície `#configuracao`  
**Última atualização:** 2026-08-05

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F10-api-keys-providers/ui/api-keys-referencia.png` |
| Light (opcional) | `TODO` |
| Dark (opcional) | `docs/F10-api-keys-providers/ui/api-keys-referencia.png` (mesmo frame dark) |

> Mock dark: card Autenticação do Claude (modo Assinatura) + card “API keys dos providers” com Claude, Codex e Minimax (sem GLM).

## Escopo

**Inclui:**

1. Card **Autenticação do Claude**: toggle Assinatura ↔ API key; status; “Testar conexão”; aviso de modo API key sem key (histórias F10 + overlap com F02).
2. Card **API keys dos providers**: campos Claude, Codex e Minimax; save parcial; badges configurada/não; reveal; validação de formato.
3. Superfície indireta F03: Minimax como provider de thread quando key válida; composer indisponível com motivo se faltar key no modo certo.
4. Copy literal (rename EngrenaCode), estados, tokens, aceite visual.

**Exclui:** contratos vault/HTTP (ficam no `spec.md`); cards F02 Central (CLIs, prompt global, GitHub) salvo cross-ref; ditado/STT; campo **GLM** (fonte tem; PRD F10 não); path manual de CLI.

### Observado na fonte × destino Central F10

| Tópico | Fonte | Destino F10 |
|--------|-------|-------------|
| Providers no KeysForm | Codex, Claude, **GLM**, Minimax (4) | Claude, Codex, Minimax (**sem GLM**) |
| Subtítulo KeysForm | “Codex não usa key.” | Alinhar ao PRD: Codex key = alternativa ao login; ver copy |
| Prefixos | Claude `sk-ant-`; Codex `startsWith('sk')` + hint `sk-codex-…`; Minimax loose | PRD: Claude `sk-ant-`; Codex `sk-` / `sk-codex-`; Minimax loose |
| Save parcial vazio | preserva key anterior | manter |
| Toggle API key sem key | segment disabled + frase longa | manter comportamento; copy da fonte |
| Ordem na página | Claude auth → CLIs → Prompt → **Keys** → GitHub → Ditado | F10 exige Claude auth + Keys; demais = F02 / fora |

## Anatomia (topo → base)

Dentro de `#configuracao` (`max-w-[760px]`), regiões F10 (as demais cards existem na página mas fora do aceite F10):

1. **Card Autenticação do Claude**
   1. Título + status dot
   2. Subtítulo (assinatura vs API key / cobrança)
   3. Segmented control: Assinatura | API key
   4. Linha de status do modo (ok / missing / warn / noKey)
   5. CTA “Testar conexão” + feedback ✓/✗
2. **Card API keys dos providers**
   1. Título + subtítulo
   2. Rows (ordem destino): **Claude** → **Codex** → **Minimax**  
      Cada row: label → input password + reveal → badge configurada/não (+ erro de formato sob o campo)
   3. Footer: “Salvar chaves” + feedback success/error

**Alinhamento:** coluna centrada; cards full-width; conteúdo à esquerda  
**Largura máx.:** `max-w-[760px]`

> Ordem das rows na **fonte** é Codex → Claude → GLM → Minimax. Destino Central: Claude → Codex → Minimax (sem GLM). Registrar divergência no aceite.

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página (contexto) | `mx-auto max-w-[760px] px-lg py-xl` | shared com F02 |
| Card | `rounded-lg border border-border bg-surface p-lg` | |
| Título card | `text-[15px] font-semibold text-fg` | + dot 9×9 |
| Subtítulo card | `mb-md mt-xs text-[12.5px] text-muted` | |
| Segmented | `inline-flex rounded-sm border border-border bg-surface-2 p-[3px]` | active: `bg-surface text-fg shadow-sm` |
| Keyrow grid | `grid-cols-[140px_1fr_auto]` → 1 col `<720px` | |
| Input | `border-border bg-surface-2 text-fg font-mono` + reveal | inválido: `border-red` |
| Badge | `font-mono text-[11.5px]` `text-green` / `text-muted` | |
| CTA | `ButtonPrimary` / `bg-accent` | |
| Focus | `focus:border-accent` / `focus-visible:ring-2 focus-visible:ring-accent` | |
| Erro | `text-red` | |
| Sucesso | `text-green` | |
| Aviso | `text-amber` | billing warn |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Network error | legado | EngrenaCode |
| Dot Claude off | hex `#d97757` | token-gap (marca Anthropic) |
| Dot Codex / Minimax | `#10a37f` / `#ff5f8f` | token-gap |
| GLM field | presente | **omitir** no Central F10 |
| Banner principal | “Codex, Claude, GLM, Minimax” | alinhar a Claude/Codex/Minimax (+ CLIs F02) em F03/F10 follow-up |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `legado → EngrenaCode`. Células = texto final no destino.

### Card: Autenticação do Claude

| Slot | Texto |
|------|-------|
| `claude.title` | Autenticação do Claude |
| `claude.subtitle` | Escolha como o Claude autentica. Na **assinatura**, sua key salva fica como fallback inerte e nunca cobra a API sozinha; em **API key**, a key do cofre passa a cobrar por uso. |
| `claude.mode.subscription` | Assinatura |
| `claude.mode.api-key` | API key |
| `claude.mode.aria` | Modo de autenticação do Claude |
| `claude.mode.api-key.disabledHint` | Salve uma key Claude abaixo para habilitar. |
| `claude.status.subscription.ok` | ✓ Usando a assinatura (Claude Code) — sem cobrança de API. |
| `claude.status.subscription.missing` | Assinatura selecionada, mas não detectei login do Claude Code. Rode `claude` no terminal para autenticar. |
| `claude.status.api-key.warn` | ⚠ Usando API key — isto **cobra por uso** da API Anthropic. |
| `claude.status.api-key.noKey` | Nenhuma key salva: os turnos vão falhar. Volte para Assinatura ou salve a key abaixo. |
| `claude.cta.test` | Testar conexão |
| `claude.cta.test.loading` | Testando... |
| `claude.error.switch` | Não foi possível alterar o modo. Tente novamente. |
| `claude.error.test` | Não foi possível testar a conexão agora. |
| `claude.verify.ok.subscription` | ✓ Assinatura (Claude Code) respondeu — conectado. |
| `claude.verify.ok.api-key` | ✓ API key respondeu — conectado (cobrando a API). |
| `claude.verify.fail.subscription` | ✗ Assinatura nao respondeu. |
| `claude.verify.fail.api-key` | ✗ API key nao respondeu. |
| `claude.verify.rateLimit` | Limite de uso da Anthropic (rate limit) — a credencial está válida, mas o limite impede o teste agora; tente de novo em alguns minutos. |
| `claude.verify.timeout` | Tempo esgotado ao testar a conexao. |
| `claude.dot.ok` | Autenticado |
| `claude.dot.ko` | Não autenticado |

> PRD cita a forma curta “Nenhuma key salva: os turnos vão falhar”; a fonte (e este SDD) usa a frase completa com orientação. Aceite: substring PRD **deve** aparecer.

### Card: API keys dos providers

| Slot | Texto |
|------|-------|
| `keys.title` | API keys dos providers |
| `keys.subtitle` | Claude, Codex e Minimax guardam a key no cofre local. Claude só cobra em modo API key (na assinatura a key fica inerte). Codex e Minimax usam a key quando configurada. |
| `keys.cta.save` | Salvar chaves |
| `keys.cta.loading` | Salvando... |
| `keys.success` | Chaves salvas localmente (não validadas com o provider). |
| `keys.badge.configured` | configurada |
| `keys.badge.missing` | não configurada |
| `keys.label.claude` | Claude |
| `keys.placeholder.claude` | sk-ant-… |
| `keys.error.claude.format` | Formato inválido. Esperado: sk-ant-… |
| `keys.label.codex` | Codex |
| `keys.placeholder.codex` | sk-codex-… |
| `keys.error.codex.format` | Formato inválido. Esperado: sk-… ou sk-codex-… |
| `keys.label.minimax` | Minimax |
| `keys.placeholder.minimax` | mm-… |
| `keys.error.spaces` | A chave não pode conter espaços. |
| `keys.error.short` | Chave muito curta para ser válida. |
| `keys.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. |
| `keys.error.write` | Não foi possível gravar localmente (sem permissão de escrita ou disco cheio). Nada foi salvo. |
| `keys.error.invalid_request` | Algum campo tem formato inválido. Revise e tente novamente. |
| `keys.error.generic` | Não foi possível salvar. Tente novamente. |
| `keys.reveal` | Revelar {label} |
| `keys.hide` | Ocultar {label} |

> **`keys.subtitle`:** destino (PRD). Fonte diz “Codex não usa key” / inclui GLM — **não** usar no aceite F10.  
> **`keys.error.codex.format`:** destino alinha PRD (`sk-` / `sk-codex-`); fonte só menciona `sk-codex-…` no erro apesar do validator `sk-`.

### Fora do Central F10 (não exigir)

| Slot | Texto (fonte) |
|------|----------------|
| `keys.label.glm` | GLM |
| `keys.placeholder.glm` | glm-… |
| `keys.subtitle.fonte` | GLM e Minimax usam API key (token plan). Claude aceita key opcional (senão usa a assinatura); Codex não usa key. |

### Composer / Minimax (indireto)

| Slot | Texto |
|------|-------|
| `composer.minimax.unavailable` | TODO — motivo exato quando key Minimax ausente (fonte usa reason de capabilities; ex. teste: “MiniMax sem credencial no cofre.”) |
| `composer.claude.apiKey.unavailable` | Alinhar a `claude.status.api-key.noKey` / gate F03 |

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `claude.mode` | segmented | — | Assinatura \| API key; API key disabled se `!hasApiKey` |
| `claude.test` | button | — | verify subscription ou api-key; loading “Testando...” |
| `keys.claude` | password | não | vazio no save = preserva; senão `sk-ant-`, sem espaços, ≥8 |
| `keys.codex` | password | não | idem; prefixo `sk-` / `sk-codex-` |
| `keys.minimax` | password | não | idem; validator loose (≥8, sem espaços) |
| `keys.reveal` | icon button | — | por campo |
| `keys.submit` | button | — | disabled/loading enquanto salvando; só envia fields não-vazios |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | mount | modo + badges do vault; inputs vazios (não ecoam key) |
| `filling` | editar input | limpa erro de campo; feedback form idle |
| `loading` | save / switch / test | CTA loading; non-reentrant |
| `disabled` | API key mode sem key | segment API key disabled + title hint |
| `error` | rede / write / format / switch / test fail | `text-red` no form ou sob campo |
| `success` | save keys | “Chaves salvas localmente…”; badges merge dos fields enviados |
| `preserveEmpty` | save com campo vazio | server preserva key; badge “configurada” permanece |
| `apiKeyNoKey` | mode=api-key sem key | warn âmbar + frase noKey vermelha |
| `subscriptionOk` / `subscriptionMissing` | detect login | status lines documentadas |
| `testOk` / `testFail` / `rateLimit` | verify | ✓/✗ detail |
| `minimaxReady` | key Minimax válida | provider disponível no picker F03 |
| `composerBlocked` | falta key no modo certo | indisponível + motivo |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Card` | Claude auth; API keys |
| `Field` | label + input + hint/erro por key |
| `Input` (password) | keys |
| `Button` | Salvar chaves; Testar conexão |
| `SegmentedControl` | Assinatura \| API key |
| `Badge` | configurada / não configurada |
| `StatusDot` | autenticado |

## Aceite visual

- [ ] Bate com `api-keys-referencia.png` (dark)
- [ ] Cards Claude auth + API keys na anatomia; sem GLM no Central
- [ ] Toggle: key não habilita cobrança sozinha (assinatura = fallback inerte)
- [ ] Segment API key disabled até existir key Claude; noKey copy presente
- [ ] “Testar conexão” distingue sucesso, falha e rate limit quando possível
- [ ] Rows Claude / Codex / Minimax; placeholders e erros de formato documentados
- [ ] Save parcial vazio preserva (comportamento + badge)
- [ ] Success: “não validadas com o provider”
- [ ] Rename EngrenaCode nos erros de rede
- [ ] Tema `light` \| `dark` \| `system` via tokens
- [ ] Cards F02 (CLIs / prompt / GitHub) **não** bloqueiam aceite F10

## Perguntas em aberto

- Ordem das rows: manter fonte (Codex primeiro) ou destino (Claude → Codex → Minimax)?
- Unificar `keys.error.codex.format` com validator real (`sk-` genérico vs só `sk-codex-`)?
- Copy curta do PRD vs frase completa `noKey` da fonte: manter completa?
- Motivo exato no composer para Minimax sem key: fixar string canônica?
- Banner F03 “Nenhuma API key…”: atualizar lista de providers no escopo F10 ou F03?
- F02 `ui.md` ainda diz que modo API key “depende de F10” — marcar cross-ref resolvido?

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F10-api-keys-providers/spec.md` | Contratos vault/PUT keys/claude-auth — `TODO` se ausente |
| `docs/F10-api-keys-providers/copy.md` | Catálogo de microcopy |
| `docs/F02-configuracao-mvp/ui.md` | Página `#configuracao` Central (CLIs, prompt, GitHub); exclui KeysForm |
| `docs/F01-vault-e-sessao-local/spec.md` | Cofre |
| `docs/F03-workspace/ui.md` | Picker Minimax / gate composer |
| `docs/prd-engrenacode.md` § F10 | Produto |
| `_reversa_sdd/sdd/design-system.md` | Tokens |

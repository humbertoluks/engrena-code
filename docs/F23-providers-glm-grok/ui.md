# Spec de UI: #configuracao — cards GLM e Grok (F23)

**Feature:** F23-providers-glm-grok  
**Destino:** EngrenaCode  
**Fonte de referência:** EngrenaCode (implementação já presente) + precedente F10 (`ClaudeCard` / `KeysCard`)  
**Componente fonte:** `src/renderer/screens/ConfiguracaoScreen.tsx` (`ProviderKeyTestCard` ×2) + `glm-driver.ts` / `grok-driver.ts` (`testConnection` details)  
**Componente destino (previsto):** mesmo (`ProviderKeyTestCard` parametrizado; labels via `COPY.glm*` / `COPY.grok*`)  
**Última atualização:** 2026-08-09

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F23-providers-glm-grok/ui/glm-grok-cards-referencia.png` |
| Card GLM (isolado) | `docs/F23-providers-glm-grok/ui/glm-card-referencia.png` |
| Card Grok (isolado) | `docs/F23-providers-glm-grok/ui/grok-card-referencia.png` |
| Grok — erro de formato | `docs/F23-providers-glm-grok/ui/grok-card-error-formato.png` |
| Light (opcional) | `docs/F23-providers-glm-grok/ui/glm-grok-cards-light.png` |
| Dark (opcional) | mesmo canônico |

> Capturado 2026-08-09 via `playwright-cli` em `http://localhost:5173/#configuracao` (Vite + Electron `pnpm dev`, `ENGRENACODE_USER_DATA` isolado). Tema Escuro no canônico; light no artefato opcional. Estado default: badge **não configurada**, placeholders `<id>.<secret>` / `xai-…`.

## Escopo

**Inclui:**

1. Dois cards standalone em `#configuracao` (após `KeysCard` Claude/Codex/Minimax, antes do card GitHub): **GLM** e **Grok**.
2. Anatomia idêntica por card: título + subtítulo + campo key (reveal) + badge configurada/não + CTA **Salvar chave** + CTA **Testar conexão** + slots de feedback.
3. Copy literal (validação local + details do probe HTTP), estados, tokens, aceite visual.
4. Superfície indireta F03: labels `GLM` / `Grok` no picker; aviso `Provider indisponível` + `providers.glm.reason` / `providers.grok.reason` quando sem key.

**Exclui:** contratos vault/HTTP/drivers (`spec.md`); alteração do `KeysCard` em lote (Claude/Codex/Minimax); assinatura CLI; tool-use/MCP; multimodal/reasoning; cadastro de preço em Consumo (F11).

## Anatomia (topo → base)

Dentro de `#configuracao` (`max-w-[760px]`), regiões F23 (demais cards da página fora do aceite F23):

### Por card (`ProviderKeyTestCard` — GLM depois Grok)

1. **Header:** título (`h2`) + subtítulo (provider + “cofre local, sem CLI/assinatura”).
2. **Linha key:** `Field` password + reveal · badge `configurada` / `não configurada` (grid `1fr_auto` ≥720px).
3. **Slot erro de formato** (condicional, sob o input via `Field`).
4. **Linha save:** `ButtonPrimary` “Salvar chave” + `InlineFeedback` de save (success/error).
5. **Linha teste:** `ButtonSecondary` “Testar conexão” + `InlineFeedback` de teste (success/warn/error).

**Ordem na página (F23):** … → `KeysCard` → **GLM** → **Grok** → `GithubCard` → …

**Alinhamento do card / painel:** coluna centrada; cards full-width da coluna; conteúdo à esquerda  
**Largura máx.:** `max-w-[760px]` (página)

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página (contexto) | `mx-auto max-w-[760px] px-lg py-xl` | shared F02/F10 |
| Card | `rounded-lg border border-border bg-surface p-lg` | `Card` |
| Título card | `text-[15px] font-semibold text-fg` | `CardHeader` |
| Subtítulo card | `mt-xs text-[12.5px] text-muted` | |
| Gap interno | `flex flex-col gap-md` | |
| Keyrow | `grid … min-[720px]:grid-cols-[1fr_auto]` | badge à direita |
| Input | `Field` → mono, `border-border bg-surface-2`; inválido `border-red` | |
| Badge | `Badge` `positive` / `neutral` · mono ~11.5px | configurada / não |
| CTA save | `ButtonPrimary` `bg-accent` | loadingLabel “Salvando...” |
| CTA test | `ButtonSecondary` `border-border bg-surface-2` | loading: spinner; ver gap `loadingLabel` |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |
| Erro | `text-red` (+ borda input) | |
| Sucesso / warn teste | `InlineFeedback` success / warn | detail do server |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Composição | cards standalone (não row em `KeysCard`) | manter (spec §3.2) |
| Save vazio no card | draft `''` → no-op no client (não POST) | distinto de KeysCard “preserva no server”; badge só muda após save com valor |
| `COPY.providerCardTestLoading` | `"Testando..."` definido | **não** passado a `ButtonSecondary` hoje → spinner + texto “Testar conexão” |
| Precedente F10 GLM row | omitido no Central F10 | F23 reintroduz como card próprio |
| Placeholder GLM legado | `glm-…` (F10 ui fora do Central) | destino: `<id>.<secret>` (assumido na spec) |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: N/A (fonte = EngrenaCode). Células = texto final no destino. Ver também `copy.md`.

### Card GLM

| Slot | Texto |
|------|-------|
| `glm.title` | GLM |
| `glm.subtitle` | Zhipu AI / BigModel — key salva no cofre local, sem CLI/assinatura. |
| `glm.placeholder` | `<id>.<secret>` |
| `glm.badge.configured` | configurada |
| `glm.badge.missing` | não configurada |
| `glm.cta.save` | Salvar chave |
| `glm.cta.save.loading` | Salvando... |
| `glm.cta.test` | Testar conexão |
| `glm.cta.test.loading` | Testando... |
| `glm.success.save` | Chaves salvas localmente (não validadas com o provider). |
| `glm.error.spaces` | A chave não pode conter espaços. |
| `glm.error.short` | Chave muito curta para ser válida. |
| `glm.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. |
| `glm.error.save` | Não foi possível salvar. Tente novamente. |
| `glm.error.test` | Não foi possível testar a conexão agora. |
| `glm.verify.ok` | ✓ GLM respondeu — conectado (cobrando a API). |
| `glm.verify.missing` | Nenhuma key do GLM salva. Salve uma key abaixo antes de testar. |
| `glm.verify.auth` | Key do GLM inválida ou rejeitada pelo provider. |
| `glm.verify.network` | Falha de rede ao testar a conexão com o GLM. Verifique sua internet e tente novamente. |
| `glm.verify.generic` | Não foi possível testar a conexão com o GLM: {message} |
| `glm.reveal` | Revelar GLM |
| `glm.hide` | Ocultar GLM |
| `composer.glm.unavailable` | GLM sem key salva — configure em #configuracao. |

### Card Grok

| Slot | Texto |
|------|-------|
| `grok.title` | Grok |
| `grok.subtitle` | xAI — key salva no cofre local, sem CLI/assinatura. |
| `grok.placeholder` | xai-… |
| `grok.badge.configured` | configurada |
| `grok.badge.missing` | não configurada |
| `grok.cta.save` | Salvar chave |
| `grok.cta.save.loading` | Salvando... |
| `grok.cta.test` | Testar conexão |
| `grok.cta.test.loading` | Testando... |
| `grok.success.save` | Chaves salvas localmente (não validadas com o provider). |
| `grok.error.spaces` | A chave não pode conter espaços. |
| `grok.error.short` | Chave muito curta para ser válida. |
| `grok.error.format` | Formato inválido. Esperado: xai-… |
| `grok.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. |
| `grok.error.save` | Não foi possível salvar. Tente novamente. |
| `grok.error.test` | Não foi possível testar a conexão agora. |
| `grok.verify.ok` | ✓ Grok respondeu — conectado (cobrando a API). |
| `grok.verify.missing` | Nenhuma key do Grok salva. Salve uma key abaixo antes de testar. |
| `grok.verify.auth` | Key do Grok inválida ou rejeitada pelo provider. |
| `grok.verify.network` | Falha de rede ao testar a conexão com o Grok. Verifique sua internet e tente novamente. |
| `grok.verify.generic` | Não foi possível testar a conexão com o Grok: {message} |
| `grok.reveal` | Revelar Grok |
| `grok.hide` | Ocultar Grok |
| `composer.grok.unavailable` | Grok sem key salva — configure em #configuracao. |

### Composer (indireto F03)

| Slot | Texto |
|------|-------|
| `composer.picker.glm` | GLM |
| `composer.picker.grok` | Grok |
| `composer.providerUnavailable.title` | Provider indisponível |

> Mensagem de reason vem de `GET /api/config/status` (`composer.glm.unavailable` / `composer.grok.unavailable`).

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `glm.key` | password + reveal | não | vazio = no-op no save client; senão loose (≥8, sem espaços); não ecoa key do vault |
| `grok.key` | password + reveal | não | vazio = no-op; senão prefixo `xai-`, ≥8, sem espaços |
| `*.badge` | badge | — | hidratado de `status.keys.glm` / `.grok` |
| `*.save` | button primary | — | loading “Salvando...”; POST `keys/save` com um campo |
| `*.test` | button secondary | — | testa key **já salva** no vault (nunca o draft); feedback = `detail` do probe |
| `*.reveal` | icon button | — | Revelar/Ocultar {title} |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | mount | inputs vazios; badge do vault; CTAs idle |
| `filling` | editar input | limpa erro local do campo |
| `loading.save` | save em andamento | primary loading “Salvando...”; non-reentrant |
| `loading.test` | test em andamento | secondary `aria-busy` + spinner (+ children se sem `loadingLabel`) |
| `disabled` | N/A card-level | CTAs não desabilitam por badge missing (teste falha com `verify.missing`) |
| `error.format` | validação local / server | borda vermelha + mensagem sob o campo (Grok: `xai-…`) |
| `error.network` / `error.save` | falha HTTP save | `InlineFeedback` error na linha save |
| `error.test` | exception no client do teste | “Não foi possível testar a conexão agora.” |
| `success.save` | save 200 | success + badge “configurada” se keys merge |
| `testOk` | probe success | success + `verify.ok` |
| `testFail.auth` | 401/403 | warn + `verify.auth` (distinto de rede) |
| `testFail.network` | fetch throw | warn + `verify.network` |
| `testFail.missing` | sem key no vault | warn + `verify.missing` |
| `composerBlocked` | key ausente no picker | “Provider indisponível” + reason |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Card` / `CardHeader` | shell do card |
| `Field` | key + reveal + erro |
| `Badge` | configurada / não configurada |
| `ButtonPrimary` | Salvar chave |
| `ButtonSecondary` | Testar conexão |
| `InlineFeedback` | save + test |

## Aceite visual

- [x] Bate com `glm-grok-cards-referencia.png` (dark) — confirmado também ao vivo via `playwright-cli` CDP attach no app empacotado durante o smoke de F27 (mesma página `#configuracao`, cards GLM/Grok renderizando antes do `VoiceKeysCard` novo)
- [x] Dois cards após KeysCard, ordem GLM → Grok; sem row GLM dentro de KeysCard
- [x] Anatomia: título, subtítulo, field+badge, Salvar chave, Testar conexão
- [x] Placeholders `<id>.<secret>` e `xai-…`; badges “não configurada” no default
- [x] Erro de formato Grok: borda vermelha + “Formato inválido. Esperado: xai-…” (`grok-card-error-formato.png`)
- [x] “Testar conexão” distingue missing / auth / network nos `detail` documentados (`glm-driver.test.ts`/`grok-driver.test.ts`)
- [x] Picker lista GLM/Grok; sem key → indisponível + reason canônica (`ComposerModelControls`/`config-handler.test.ts`)
- [x] Tema `light` \| `dark` \| `system` via tokens (`glm-grok-cards-light.png` + canônico dark)
- [x] Sem marca legado (Lion*) na superfície

## Perguntas em aberto

- Passar `loadingLabel={COPY.providerCardTestLoading}` (“Testando...”) em `ButtonSecondary` para alinhar ao ClaudeCard?
- Save com draft vazio: manter no-op client ou espelhar KeysCard (POST vazio = preserva / clear explícito)?
- Unificar subtítulos com tom F10 KeysForm (listar cobrança API) ou manter frase curta atual?
- Placeholder GLM: manter `<id>.<secret>` vs legado `glm-…` se Zhipu documentar prefixo estável?

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F23-providers-glm-grok/spec.md` | Contratos vault/HTTP/drivers |
| `docs/F23-providers-glm-grok/plan.md` | Ordem de implementação |
| `docs/F23-providers-glm-grok/copy.md` | Catálogo de microcopy |
| `docs/F10-api-keys-providers/ui.md` | Precedente KeysCard / Claude test |
| `docs/F02-configuracao-mvp/ui.md` | Página `#configuracao` |
| `docs/design-system/` | Tokens e superfícies |
| `docs/PRD.md` § F23 | Produto |

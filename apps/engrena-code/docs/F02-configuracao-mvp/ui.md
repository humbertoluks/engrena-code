# Spec de UI: #configuracao (Configuração MVP)

**Feature:** F02-configuracao-mvp  
**Destino:** EngrenaCode  
**Fonte de referência:** EngrenaCode (`src/renderer`)  
**Componente:** `src/renderer/screens/ConfiguracaoScreen.tsx` (+ `ButtonPrimary.tsx`, `ButtonSecondary.tsx`, `SegmentedControl.tsx`, `StatusDot.tsx`, `InlineFeedback.tsx`)  
**Última atualização:** 2026-08-03

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `TODO` — capturar e versionar em `docs/F02-configuracao-mvp/ui/configuracao-referencia.png` |
| Light (opcional) | `TODO` |
| Dark (opcional) | `TODO` |

> PNG ainda não versionado. Preferir captura dark do legado pós-unlock em `#configuracao`.

## Escopo

**Inclui:** layout da tela `#configuracao`, anatomia dos cards do Escopo Central F02 (Claude auth, CLIs Claude/Codex/Kimi, prompt global, token GitHub), copy literal EngrenaCode, estados de UI, mapeamento de tokens/padrões de superfície, critérios de aceite visual.

**Exclui:** contratos de API/vault/IPC (ficam no `spec.md`); implementação de primitives; blocos da fonte fora do Escopo Central F02 (API keys de providers → F10; ditado/STT → fora do MVP; CLI Grok / CodeGraph → fora do MVP; caminho manual de binário → Escopo Completo / Adiado se não for Completo nesta entrega).

### Observado na fonte e fora deste SDD (F02 Central)

Ordem extra no legado, **não** exigir no aceite F02 Central:

1. `KeysForm` “API keys dos providers” (Codex, Claude, GLM, Minimax) — PRD: F10 / providers MVP sem GLM/Minimax nesta feature.
2. `KeysForm` “Ditado por voz (transcrição)” — PRD: fora (voz).
3. Linhas CLI **Grok** e **CodeGraph** + inputs de path manual — PRD Central: só Claude, Codex, Kimi; path manual = Adição Escopo Completo.

## Anatomia (topo → base)

Ordem obrigatória de renderização no viewport principal (conteúdo dentro do `AppShell`):

1. Cabeçalho da página: `h1` “Configuração” + subtítulo de privacidade local.
2. Card **Autenticação do Claude**: título com dot de status + copy + segmented Assinatura|API key + linha de status do modo + CTA “Testar conexão” + feedback.
3. Card **CLIs de assinatura**: título + CTA “Testar conexões” + copy + lista de 3 rows (Claude, Codex, Kimi) com dot/label/status instalado/logado + hints de login quando não logado.
4. Card **System prompt global do harness**: título com dot ativo/desligado + copy + textarea + “Salvar prompt global” + “Restaurar padrão” + badge padrão/customizado + feedback.
5. Card **Token do GitHub** (`KeysForm` layout `field`): título + subtítulo + label/input/helper + CTA “Salvar token” + feedback success/error.

**Alinhamento do card / painel:** coluna única centrada no conteúdo do shell (`mx-auto`); cards full-width da coluna; conteúdo alinhado à esquerda  
**Largura máx.:** `max-w-[760px]` (~760px)

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página | `mx-auto max-w-[760px] px-lg py-xl` sobre `bg-bg text-fg` do shell | sem `min-h-screen` próprio |
| Título página | `font-display text-[21px] font-semibold tracking-tight text-fg` | type-scale ainda Adiada → anotar px observado |
| Subtítulo página | `mt-xs text-[13.5px] text-muted` | |
| Stack de cards | `grid grid-cols-1 gap-md` | |
| Card / painel | `rounded-lg border border-border bg-surface p-lg` | padrão Design Lock |
| Título de card | `text-[15px] font-semibold text-fg` | + dot 9×9 `rounded-[3px]` quando status |
| Subtítulo de card | `mb-md mt-xs text-[12.5px] text-muted` | |
| Input / textarea | `border-border bg-surface-2 text-fg font-mono` | password nos KeysForm; reveal button |
| Hint / caption | `text-[11.5px] text-muted` | |
| CTA primário | `ButtonPrimary` / `bg-accent` | |
| CTA secundário | `border border-border bg-surface-2` | “Restaurar padrão”, “Salvar caminhos” (Completo) |
| Focus | `focus:border-accent focus:outline-none` / `focus-visible:ring-2 focus-visible:ring-accent` | |
| Erro | `text-red` + `border-red` no input inválido | |
| Sucesso / ok | `text-green` | |
| Aviso | `text-amber` | |

### Observado na fonte (opcional)

| Item | Valor |
|------|-------|
| Marca no prompt | EngrenaCode |
| Network error | “Verifique se o EngrenaCode está em execução.” |
| Dot Claude desconectado | hex `#d97757` (marca Anthropic) — manter como cor de marca do provider (token-gap) ou mapear a `--amber`/`accent` se Design Lock exigir zero hex |
| Dots CLI | hex por marca (claude/codex/kimi) — idem token-gap |
| Grid keyrow | `grid-cols-[140px_1fr_auto]` → 1 col `<720px` |
| Type sizes | `21px` / `15px` / `13.5px` / `12.5px` / `11.5px` — papel display/title/body/caption até type-scale existir |

## Copy (literal — fonte de verdade)

Células = texto final no produto. Marca: somente EngrenaCode.

### Página

| Slot | Texto |
|------|-------|
| `title` | Configuração |
| `subtitle` | Credenciais salvas localmente no userData do app (filesystem). Nenhuma chave sai deste dispositivo. |

### Card: Autenticação do Claude

| Slot | Texto |
|------|-------|
| `claude.title` | Autenticação do Claude |
| `claude.subtitle` | Escolha como o Claude autentica. Na **assinatura**, sua key salva fica como fallback inerte e nunca cobra a API sozinha; em **API key**, a key do cofre passa a cobrar por uso. |
| `claude.mode.subscription` | Assinatura |
| `claude.mode.api-key` | API key |
| `claude.mode.api-key.disabledHint` | Salve uma key Claude abaixo para habilitar. |
| `claude.status.subscription.ok` | ✓ Usando a assinatura (Claude Code) — sem cobrança de API. |
| `claude.status.subscription.missing` | Assinatura selecionada, mas não detectei login do Claude Code. Rode `claude` no terminal para autenticar. |
| `claude.status.api-key.warn` | ⚠ Usando API key — isto **cobra por uso** da API Anthropic. |
| `claude.status.api-key.noKey` | Nenhuma key salva: os turnos vão falhar. Volte para Assinatura ou salve a key abaixo. |
| `claude.cta.test` | Testar conexão |
| `claude.cta.test.loading` | Testando... |
| `claude.error.switch` | Não foi possível alterar o modo. Tente novamente. |
| `claude.error.test` | Não foi possível testar a conexão agora. |
| `claude.dot.ok` | Autenticado (title) |
| `claude.dot.ko` | Não autenticado (title) |

> Nota: no F02 Central não há card de API keys abaixo; o hint “salve a key abaixo” / modo API key depende de F10 ou de um caminho mínimo documentado em Perguntas em aberto.

### Card: CLIs de assinatura (destino = Claude, Codex, Kimi)

| Slot | Texto |
|------|-------|
| `cli.title` | CLIs de assinatura |
| `cli.subtitle` | Claude, Codex e Kimi usam a assinatura dos respectivos CLIs — sem API key. O app herda a sessão autenticada. |
| `cli.cta.test` | Testar conexões |
| `cli.cta.test.loading` | Testando… |
| `cli.feedback.ok` | Teste concluído: {okCount}/{total} CLIs logados. |
| `cli.feedback.fail` | Falha ao testar as conexões — o server local respondeu? |
| `cli.row.installed` | instalado |
| `cli.row.installedWithPath` | instalado · {path} |
| `cli.row.notInstalled` | não instalado |
| `cli.row.loggedIn` | logado (assinatura) |
| `cli.row.notLoggedIn` | não logado |
| `cli.hint.installedNotLogged.claude` | Rode `claude (login no primeiro uso)` no terminal para autenticar. |
| `cli.hint.installedNotLogged.codex` | Rode `codex login` no terminal para autenticar. |
| `cli.hint.installedNotLogged.kimi` | Rode `kimi login` no terminal para autenticar. |
| `cli.hint.notInstalled` | Instale o CLI e rode `{loginCmd}` — ou aponte o binário acima. |

> Fonte usa subtítulo com “Claude, Codex e Grok” e rows Grok/CodeGraph — no destino F02 Central: **Kimi** no lugar de Grok; sem CodeGraph; sem path manual (Completo). Ajustar subtítulo como acima (não copiar Grok).

### Card: System prompt global

| Slot | Texto |
|------|-------|
| `prompt.title` | System prompt global do harness |
| `prompt.subtitle` | Instruções do EngrenaCode injetadas **antes** do prompt da thread, em **todos os providers** (Claude preserva o preset do Claude Code; Codex/Grok recebem como prefixo). Ensina o agente a usar subagents, skills, MCPs e o fluxo de diff/review. Esvazie e salve para desligar; “Restaurar padrão” volta ao texto do EngrenaCode. |
| `prompt.placeholder.loading` | Carregando… |
| `prompt.cta.save` | Salvar prompt global |
| `prompt.cta.save.loading` | Salvando… |
| `prompt.cta.restore` | Restaurar padrão |
| `prompt.cta.restore.title.default` | Já está no padrão do EngrenaCode |
| `prompt.cta.restore.title.custom` | Descarta o texto customizado e volta ao padrão |
| `prompt.badge.default` | Usando o padrão do EngrenaCode. |
| `prompt.badge.custom` | Customizado. |
| `prompt.dot.active` | Ativo |
| `prompt.dot.off` | Desligado |
| `prompt.ok.save` | Prompt global salvo. Vale a partir do próximo turno de qualquer provider. |
| `prompt.ok.off` | Prompt global desligado — nada será injetado nos turnos. |
| `prompt.ok.restore` | Prompt global restaurado ao padrão do EngrenaCode. |
| `prompt.error.load` | Não foi possível carregar o prompt global. |
| `prompt.error.save` | Falha ao salvar o prompt global. |

> Fonte menciona “Codex/Grok” no subtítulo; PRD MVP é Claude/Codex/Kimi. TODO: alinhar frase de providers no subtítulo (ver Perguntas).

### Card: Token do GitHub (`KeysForm`)

| Slot | Texto |
|------|-------|
| `github.title` | Token do GitHub |
| `github.subtitle` | Personal access token usado pelo git flow ao abrir PRs (ou via CLI gh). |
| `github.label.token` | Personal access token |
| `github.placeholder.token` | ghp_… |
| `github.hint.token` | Escopos necessarios: `repo`, `workflow`. |
| `github.cta.save` | Salvar token |
| `github.cta.save.loading` | Salvando... |
| `github.success` | Token salvo localmente (não validado com o GitHub). |
| `github.reveal` | Revelar Personal access token |
| `github.hide` | Ocultar Personal access token |
| `github.error.format` | Formato inválido. Esperado: ghp_… ou github_pat_… |
| `github.error.spaces` | A chave não pode conter espaços. |
| `github.error.short` | Chave muito curta para ser válida. |
| `github.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. |
| `github.error.write` | Não foi possível gravar localmente (sem permissão de escrita ou disco cheio). Nada foi salvo. |
| `github.error.invalid_request` | Algum campo tem formato inválido. Revise e tente novamente. |
| `github.error.generic` | Não foi possível salvar. Tente novamente. |

> Tipografia do hint na fonte: “Escopos necessarios” (sem acento) — manter literal da fonte ou corrigir para “necessários”? Ver Perguntas.

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `claude.mode` | segmented (2 buttons) | — | `subscription` \| `api-key`; `api-key` disabled se `!hasApiKey`; `aria-pressed` |
| `claude.test` | button primary | — | loading “Testando...”; mostra `testResult.detail` |
| `cli.testAll` | button accent | — | paralela status+paths; feedback X/3 |
| `cli.row.*` | display | — | instalado/logado; hint se não logado |
| `prompt.textarea` | textarea | — | 14 rows; mono; disabled enquanto load/save; dirty gate no save |
| `prompt.save` | button primary | — | disabled se `!dirty` ou loading |
| `prompt.restore` | button secondary | — | disabled se `isDefault` ou saving; envia `prompt: null` |
| `github.token` | password + reveal | sim para “configurar”; vazio válido (limpeza) | validação prefixo local; badge N/A no layout `field` |
| `github.submit` | button primary | — | KeysForm idle/success/error |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | mount pós-unlock | fetch status Claude/CLI/prompt/GitHub; cards em surface |
| `filling` | edit prompt / token | limpa feedback success/error do card |
| `loading` | save/test em andamento | CTA loadingLabel; controles relevantes disabled |
| `disabled` | validação / precondição | ex.: save prompt sem dirty; API key mode sem key; restore no default |
| `error` | falha API/rede/formato | `role=alert` em `text-red` |
| `success` | save local ok | `role=status` em `text-green` (nunca implica validade remota) |
| `claude.subscription.missing` | modo assinatura sem login detectado | copy amber + hint `claude` |
| `claude.api-key.billing` | modo api-key | copy amber de cobrança; red se sem key |
| `cli.notLoggedIn` | row não logada | hint com comando de login |
| `prompt.off` | custom vazio salvo | dot amber “Desligado” |
| `keysForm.fieldInvalid` | formato inválido no submit | erro no campo; form permanece idle (sem banner error) |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Card` | wrapper de cada seção (`border-border bg-surface p-lg`) |
| `Field` | GitHub token (label + input + hint/erro) |
| `Input` | password + reveal; paths se Escopo Completo |
| `Textarea` | prompt global |
| `Button` | primary (save/test) + secondary (restore) |
| `SegmentedControl` | Assinatura \| API key |
| `KeysForm` | card GitHub (reuso); providers só em F10 |
| `StatusDot` | 9×9 rounded indicador conectado/ativo |
| `InlineFeedback` | success/error/status ao lado do CTA |

## Aceite visual

- [ ] Bate com a referência visual em dark (e light se aplicável) — após PNG versionado
- [ ] Anatomia na ordem documentada (header → Claude → CLIs → Prompt → GitHub); sem cards F10/STT/Grok/CodeGraph no Central
- [ ] Tabela de copy 100% aplicada (labels, hints, CTA, feedbacks) com EngrenaCode
- [ ] Nenhum tamanho de fonte arbitrário fora da type scale do Design System destino (enquanto Adiada: só os px listados em Observado)
- [ ] CTA e campos usam primitives (`Field` / `Input` / `Button` / `KeysForm`), não class soup local
- [ ] Estados `loading`, `disabled` e `error` verificáveis em cada card com ação
- [ ] Tema `light` \| `dark` \| `system` respeitado via tokens (hex de marca de provider tolerados como token-gap até decisão)

## Perguntas em aberto

- Modo **API key** no card Claude sem o card F10 na mesma tela: manter disabled + hint “salve a key em Configuração → API keys (F10)”, ou omitir o segmento até F10?
- Subtítulo do prompt: fonte diz “Codex/Grok”; PRD MVP é Claude/Codex/Kimi — reescrever providers na frase?
- Hint GitHub “Escopos necessarios”: corrigir acento para “necessários” no destino?
- Path manual de CLI + “Salvar caminhos”: incluir como Escopo Completo nesta UI ou Adiado?
- Dots com hex de marca (Anthropic/OpenAI/…): aceitar como exceção ou forçar tokens semânticos?
- Screenshot canônico ainda ausente — quem captura e em qual tema?

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F02-configuracao-mvp/spec.md` | Contratos técnicos (API, IPC, erros de domínio) — TODO se ainda não existir |
| `docs/F02-configuracao-mvp/plan.md` | Ordem de implementação — TODO |
| `docs/prd-engrenacode.md` § F02 | Escopo Central vs Completo |
| `_reversa_sdd/design-system/` | Tokens e padrões de superfície |
| `docs/F02-configuracao-mvp/copy.md` | Catálogo de microcopy (opcional; não gerado nesta passagem) |
| `docs/F10-*` (futuro) | Card API keys dos providers |

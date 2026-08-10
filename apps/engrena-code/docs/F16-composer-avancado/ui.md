# Spec de UI: #principal (Composer avançado)

**Feature:** F16-composer-avancado  
**Destino:** EngrenaCode  
**Fonte de referência:** sistema legado LionCodeLabs (`packages/renderer`)  
**Componente fonte:** `packages/renderer/src/components/TaskComposer.tsx` (+ `composer/ProviderModelPicker.tsx`, `ModelPickerContent.tsx`, `ModelPickerContentParts.tsx`, `ComposerControlsMenu.tsx` → `ReasoningContextPill`, `MentionMenu.tsx`, `ImageAttachments.tsx`, `MessageImageThumbs.tsx`, hooks `useFileMentions.ts` / `useComposerImages.ts`)  
**Componente destino (previsto):** `src/renderer/components/workspace/TaskComposer.tsx` (+ satélites sob `src/renderer/components/workspace/`: picker, reasoning pill, mention menu, image attachments / thumbs)  
**Última atualização:** 2026-08-06

> **Relação com F03:** este SDD **aprofunda** o composer do Workspace (`docs/F03-workspace/ui.md` § Thread/composer). Não reescreve o layout das 3 colunas, sidebars, diff, git gate base, access/execution pills nem fila. Onde F03 e F16 se tocam (placeholders, lock de provider, send), F16 herda copy/anatomia F03 e só documenta o delta.

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F16-composer-avancado/ui/composer-avancado-referencia.png` |
| Light (opcional) | N/A |
| Dark (opcional) | mesmo frame (tema Escuro) |

> Capturado 2026-08-06 no EngrenaCode (`#principal`, tema Escuro): composer follow-up com provider travado. Ainda sem picker de modelo/reasoning, `@` mention menu ou anexos de imagem (delta F16 pendente).

## Escopo

**Inclui:**

1. **Provider / model picker** — trigger compacto + popover (sidebar de providers, busca, favoritos, atalhos Ctrl/Cmd+1..9); após o 1º envio / thread existente: provider **locked** (sidebar oculta; só modelos do provider da thread); modelo editável no follow-up.
2. **Reasoning pill** (`ReasoningContextPill`) — label combinado `{Reasoning} · {Context|Mode}` (EN); popover com seção Reasoning + bloco secundário mutuamente exclusivo Context Window **ou** Fast Mode.
3. **`@file` mention menu** — abre ao digitar `@`; lista paths do projeto (fuzzy, limit 50); loading / empty / error+retry; inserção do path relativo + espaço.
4. **Anexos de imagem** — CTA clipe; tira de thumbnails acima do textarea; drag-drop overlay; paste de imagem; remover; erros de validação/upload; thumbs no histórico (`MessageImageThumbs`).
5. Gate multimodal no destino: CTA de imagem **visível e desabilitado com motivo** quando `multimodal=false` (delta Engrena × fonte — ver abaixo).

**Exclui:**

| Item | Motivo |
|------|--------|
| Contratos HTTP/IPC/DB (`/api/composer/catalog`, blocks, dispatch) | `spec.md` |
| Layout completo do Workspace / sidebars / Diff / GitActions | F03 / F14 |
| `ExecutionModePill` (Main/Worktree) | F13 |
| Access / Plan-Build pills (baseline) | F03 — herdados, sem reespecificar |
| Fila de follow-up, git-init banner, send/stop, voz/STT | F03 / fora F16 |
| **`CommandMenu` / slash `/comando` / command palette** | Presente na fonte; **fora do Engrena F16** (PRD + `spec.md`) — ver Exclui detalhado |
| Favoritos persistidos / Context Window meter anel | Fonte tem; F16 aceita picker+reasoning; meter/favorites = opcional legado (Perguntas) |

### Slash / CommandMenu — fora do Engrena F16

Observado na fonte: `CommandMenu` multiplexado com `@` (precedência `/` > `@`); chip `/{name}` no lugar do picker; empty `Buscando comandos…` / `Nenhum comando`. **Não entra no aceite visual F16.** Não copiar strings de comando para o catálogo F16. Se a UI legado ainda renderizar slash no smoke, tratar como ruído fora de escopo.

### Observado na fonte × destino F16

| Tópico | Fonte | Destino F16 |
|--------|-------|-------------|
| Gate imagem | `supportsImages` = modelo resolvido; CTA **oculto** se false | Flag `multimodal` do catálogo; CTA **sempre visível**; disabled + motivo se false |
| Limite imagens | default 8 / 16 MiB; MIME `image/*` genérico | ≤ **5** / ≤ **4 MiB**; allowlist png\|jpeg\|webp\|gif (`spec.md`) |
| Transporte | upload `imageId` + preview objectURL | JSON base64 no create/follow-up (`spec.md`) — só contrato; UI = thumbs |
| Reasoning levels | Low…Ultrathink (por modelo) | Catálogo Engrena: `low`\|`medium`\|`high`\|`extra-high`\|`max` (+ null); labels EN da fonte para os que existirem |
| Provider lock tooltip | `Modelos do provider da thread — o provider é imutável.` | Manter (já F03 `composer.lock.provider`) |
| `@` fora do projeto | Sem toast na fonte (só não lista) | PRD pede toast — copy `TODO` até existir string estável |
| Slash menu | Presente | Fora de escopo |

## Anatomia (topo → base)

Delta **dentro** do shell do composer F03 (`relative mx-auto w-full max-w-5xl rounded-xl border border-border bg-surface-2 …`):

1. **`ImageAttachments`** (condicional): tira `flex flex-wrap` de thumbs 64×64 **acima** do textarea; overlay drop `Solte as imagens para anexar` quando drag-over.
2. **`MentionMenu`** (condicional, `absolute bottom-[calc(100%+6px)]`): listbox de paths acima do composer.
3. *(Fora F16)* `CommandMenu` se ainda existir no legado — não aceitar.
4. Textarea (F03) — placeholders herdados; `@` dispara mention; paste de imagem quando multimodal.
5. **Barra de controles** (`flex flex-wrap … gap-xs`), ordem L→R relevante a F16:
   1. `ProviderModelPicker` (ícone provider + label modelo + chevron)
   2. Divisor vertical `h-4 w-0.5 bg-border`
   3. `ReasoningContextPill` (quando o modelo expõe reasoning / context / fast)
   4. Divisor + pills F03 (Plan/Build, Access, Execution) — fora do aceite F16
   5. Divisor
   6. CTA **Anexar imagens** (clipe) — Engrena: disabled+title quando não multimodal
   7. Send/Stop (F03)
6. Slot de erro de imagens (`text-xs text-amber`) sob o shell quando validação/upload falha.
7. No **histórico** (`ChatHistory`): `MessageImageThumbs` sob a bolha do user (`alt="Imagem anexada"`).

**Alinhamento do card / painel:** herda F03 — composer centrado `mx-auto max-w-5xl`  
**Largura máx.:** shell `max-w-5xl`; popover picker `w-[440px] h-[360px] max-w-[92vw]`; mention `w-[min(420px,92vw)]`; reasoning popover `w-[230px]`

### ProviderModelPicker (popover)

1. Sidebar (só se **não** searching e **não** `lockProvider`): aba Favoritos (se houver) + providers; badge `off` se unavailable.
2. Input busca: placeholder `Buscar modelos…`.
3. Listbox modelos: linha = label + check se selected + estrela favorito + kbd 1–9; empty `Nenhum modelo encontrado.`
4. Com `lockProvider`: sem sidebar; só modelos do provider da thread.

### ReasoningContextPill

1. Trigger: label EN combinado, ex. `High · 200k` ou `Medium · Fast` (ou só Reasoning / só Context / só Fast conforme capabilities).
2. Popover:
   - Título `Reasoning` + radios `Low` / `Medium` / `High` / `Extra High` / `Max` (…); sufixo ` (default)` no default do modelo.
   - **Ou** `Context Window` (ex. `200k (default)` / `1M`) **ou** `Fast Mode` (`On` / `Off`) — nunca os dois.

### MentionMenu

1. Itens: glyph arquivo + `dir` muted + `name` medium; highlight `bg-accent/15`.
2. Empty loading: `Buscando arquivos…`
3. Empty loaded: `Nenhum arquivo`
4. Error: `Falha ao buscar arquivos` + CTA `Tentar novamente`

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Shell composer | herda F03: `rounded-xl border border-border bg-surface-2` + `focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25` | |
| Picker / mention / reasoning popovers | `rounded-lg border border-border bg-surface shadow-lg` | âncora `bottom-[calc(100%+6px)]` |
| Pill trigger | `text-[12px] font-medium` + `hover:bg-surface` + `disabled:opacity-50` | mesmo idioma visual picker/reasoning |
| Mention row | `text-[12.5px]`; dir `text-muted` | |
| Image thumb composer | `h-16 w-16 rounded-md border border-border` | nome `text-[9px]` faixa inferior |
| Drop overlay | `border-2 border-dashed border-accent bg-accent/10` | |
| Image thumb histórico | `max-h-[120px] max-w-[200px] rounded-lg border border-border` | |
| Erro imagem | `mt-sm text-xs text-amber` | role alert |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | CTA clipe / favoritos |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Marca | LionCode / LionClaw tokens | EngrenaCode / tokens F01.1 |
| Limites imagem UI | 8 / 16 MB | 5 / 4 MiB (ajustar strings dinâmicas) |
| CTA não multimodal | oculto | disabled + `composer.image.disabled.multimodal` (TODO copy) |
| Dest path | `packages/renderer/src/components/composer/*` | `src/renderer/components/workspace/*` |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `LionCode → EngrenaCode`; `lioncode → engrenacode`; nunca `Lion*`. Células = texto final no destino. Placeholders F03 do composer **não repetidos** (ver `docs/F03-workspace/ui.md`).

| Slot | Texto |
|------|-------|
| `composer.lock.provider` | Modelos do provider da thread — o provider é imutável. |
| `composer.lock.queue` | Fila de mensagens pendente — esvazie a fila para alterar o runtime. |
| `composer.lock.running` | Agente executando — altere o runtime quando o turno terminar. |
| `composer.picker.aria` | Provider e modelo: {providerLabel} · {modelLabel} |
| `composer.picker.search.placeholder` | Buscar modelos… |
| `composer.picker.search.aria` | Buscar modelos |
| `composer.picker.providers.aria` | Providers |
| `composer.picker.models.aria` | Modelos |
| `composer.picker.favorites` | Favoritos |
| `composer.picker.off` | off |
| `composer.picker.empty` | Nenhum modelo encontrado. |
| `composer.picker.favorite.add` | Adicionar aos favoritos |
| `composer.picker.favorite.remove` | Remover dos favoritos |
| `composer.reasoning.group` | Reasoning |
| `composer.reasoning.contextWindow` | Context Window |
| `composer.reasoning.fastMode` | Fast Mode |
| `composer.reasoning.fast.on` | On |
| `composer.reasoning.fast.off` | Off |
| `composer.reasoning.fast.label.on` | Fast |
| `composer.reasoning.fast.label.off` | Normal |
| `composer.reasoning.level.low` | Low |
| `composer.reasoning.level.medium` | Medium |
| `composer.reasoning.level.high` | High |
| `composer.reasoning.level.extraHigh` | Extra High |
| `composer.reasoning.level.max` | Max |
| `composer.reasoning.defaultSuffix` | (default) |
| `composer.reasoning.aria` | Reasoning and {context window\|mode}: {combinedLabel} |
| `composer.reasoning.menu.aria` | Reasoning and mode |
| `composer.mention.aria` | Arquivos do projeto |
| `composer.mention.loading` | Buscando arquivos… |
| `composer.mention.empty` | Nenhum arquivo |
| `composer.mention.error` | Falha ao buscar arquivos |
| `composer.mention.retry` | Tentar novamente |
| `composer.mention.error.outsideProject` | TODO |
| `composer.image.aria` | Anexar imagens |
| `composer.image.title` | Anexar imagens (o provider recebe nativo ou descrito por visão) |
| `composer.image.attached.aria` | Imagens anexadas |
| `composer.image.drop` | Solte as imagens para anexar |
| `composer.image.remove` | Remover |
| `composer.image.remove.aria` | Remover {name} |
| `composer.image.history.alt` | Imagem anexada |
| `composer.image.disabled.multimodal` | TODO |
| `composer.image.error.type` | Tipo nao suportado em "{name}". Anexe apenas imagens. |
| `composer.image.error.tooLarge` | "{name}" excede o limite de {limit}. |
| `composer.image.error.maxCount` | Voce pode anexar ate {maxCount} imagens por mensagem. |
| `composer.image.error.network` | Nao foi possivel enviar a imagem ao servidor local. |
| `composer.image.error.upload` | Falha ao enviar a imagem. |

> Strings de erro de imagem na fonte sem acentos (`Nao` / `Voce`) — manter literais até revisão de copy. `{limit}` na fonte default = `16 MB`; destino Engrena = `4 MB` (ou `4 MiB` se unificar). `{maxCount}` destino = `5`.

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `composer.providerModel` | pill + popover listbox | sim (1º envio) | Nova conversa: todos providers disponíveis; follow-up: `lockProvider`; modelo trocável; disabled sob runtime lock / loading capabilities |
| `composer.reasoning` | pill + menu radio | não | Só se catálogo do modelo tiver levels / context / fast; disabled sob runtime lock |
| `composer.textarea` | textarea | sim p/ enviar | Herda F03; `@` abre mention; paste imagem se multimodal |
| `composer.mentionMenu` | listbox overlay | — | Arrow/Enter no textarea; blur fecha; mousedown no menu `preventDefault` (foco no textarea) |
| `composer.attachImages` | button + `input[type=file]` hidden | — | `accept=image/png,image/jpeg,image/webp,image/gif` multiple; Engrena: disabled se `!multimodal` com title=motivo |
| `composer.imageThumbs` | presentational | — | Remove no hover; spinner se uploading (fonte upload; destino pode omitir se base64 sync) |
| `composer.historyImageThumbs` | presentational | — | Render a partir de blocks/ids da mensagem user |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | projeto selecionado, composer pronto | picker + reasoning editáveis; attach conforme multimodal |
| `filling` | digitar / anexar | limpa erro local de imagem quando adição válida |
| `pickerOpen` | click trigger modelo | popover; Esc/fora fecha; Ctrl/Cmd+1..9 seleciona |
| `providerLocked` | thread existente | picker só modelos do provider; tooltip `composer.lock.provider` |
| `runtimeLocked` | running / stopping / fila | picker+reasoning disabled; titles F03 lock |
| `mentionOpen` | `@` + projeto | MentionMenu; loading/empty/error |
| `mentionError` | falha listagem files | `Falha ao buscar arquivos` + retry |
| `imagesAttached` | ≥1 imagem | tira de thumbs; drop overlay se drag |
| `imageUploading` | upload em voo (fonte) | spinner no thumb; send pode esperar ids |
| `multimodalDisabled` | provider `multimodal=false` | CTA attach disabled + motivo (TODO copy); sem drop/paste |
| `imageError` | tipo/tamanho/count/rede | alert amber sob composer |
| `loading` | send em andamento | textarea/pills disabled (F03) |
| `error` | falha send genérica | slot F03 `composer.error.*` |

## Componentes sugeridos

Compor só com primitives / padrões já usados no Workspace:

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Button` / pill trigger | picker, reasoning, attach, retry mention |
| `Input` | busca do model picker |
| Popover hand-rolled | picker / reasoning / mention (mesmo padrão F03 QuickActions) |
| `MenuRadioGroup` (ou equivalente) | opções Reasoning / Context / Fast |
| Thumbs locais | `ImageAttachments` + `MessageImageThumbs` |
| Tokens F01.1 | `bg-surface`, `border-border`, `text-muted`, `accent` |

## Aceite visual

- [ ] Bate com a referência visual em dark (e light se aplicável) quando o PNG existir
- [ ] Anatomia F16 na ordem documentada **dentro** do composer F03; sem reescrever workspace
- [ ] Tabela de copy F16 100% aplicada (picker, reasoning, mention, imagens) + rename EngrenaCode
- [ ] Provider locked após 1º envio; modelo/reasoning editáveis no follow-up
- [ ] `@` abre mention; path relativo inserido; estados loading/empty/error
- [ ] Multimodal on: attach + thumbs + drop; off: CTA disabled com motivo (não oculto)
- [ ] Limites Engrena 5×4 MiB refletidos nas mensagens dinâmicas
- [ ] Sem UI de slash/`CommandMenu` no aceite F16
- [ ] Sem `ExecutionMode` / GitActions neste SDD
- [ ] Tema `light` \| `dark` \| `system` via tokens (sem hex solto)
- [ ] Nenhum tamanho de fonte arbitrário fora da type scale destino (px observados da fonte só como referência)

## Perguntas em aberto

- Copy final de `composer.image.disabled.multimodal` (fonte não tem — CTA some).
- Copy final de `composer.mention.error.outsideProject` (PRD: “Arquivo fora do projeto.” — ausente na fonte).
- Normalizar acentos nas strings de erro de imagem (`Nao`/`Voce` → `Não`/`Você`)?
- Incluir Favoritos do model picker e Context Window / Fast Mode no MVP Engrena, ou só Reasoning levels do catálogo F16?
- PNG de referência ainda não versionado (`composer-avancado-referencia.png`).
- Thumbs no histórico: fonte usa `imageIds` + GET blob; destino usa `blocks` base64 — mesma anatomia visual?

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F16-composer-avancado/spec.md` | Contratos técnicos (catálogo, images, mention API) |
| `docs/F16-composer-avancado/plan.md` | Ordem de implementação |
| `docs/F16-composer-avancado/copy.md` | Catálogo de microcopy F16 |
| `docs/F03-workspace/ui.md` | Workspace base + composer mínimo |
| `docs/F13-isolamento-worktree/` | ExecutionMode / worktree |
| `docs/F14-fluxo-git-completo/` | GitActions |
| `docs/design-system/` | Tokens e padrões de superfície |

# Catálogo de copy: F16-composer-avancado

**Produto:** EngrenaCode  
**Fonte:** sistema legado LionCodeLabs (`packages/renderer` — TaskComposer + composer/*)  
**Mapa de rename:** `LionCode → EngrenaCode`; `lioncode → engrenacode`; nunca `Lion*`  
**Última atualização:** 2026-08-07 (Lacunas de imagem/menção fechadas — texto já shipado promovido a final, sem mudança de comportamento/layout)

Strings literais para UI do composer avançado. Specs (`ui.md`) e código devem importar estes ids — não reinventar texto. Placeholders/send/git/access/execution do composer base: `docs/F03-workspace/ui.md` / copy F03 — não duplicar aqui.

## Convenção de ids

`composer.{{slot}}` (tela `#principal`, superfície composer).  
Exemplos: `composer.picker.search.placeholder`, `composer.mention.empty`, `composer.image.error.tooLarge`.

## Telas

### #principal (composer avançado — F16)

| Id | Texto | Notas |
|----|-------|-------|
| `composer.lock.provider` | Modelos do provider da thread — o provider é imutável. | title do picker locked; também F03 |
| `composer.lock.queue` | Fila de mensagens pendente — esvazie a fila para alterar o runtime. | runtime lock |
| `composer.lock.running` | Agente executando — altere o runtime quando o turno terminar. | runtime lock |
| `composer.picker.aria` | Provider e modelo: {providerLabel} · {modelLabel} | aria-label do trigger |
| `composer.picker.search.placeholder` | Buscar modelos… | |
| `composer.picker.search.aria` | Buscar modelos | |
| `composer.picker.providers.aria` | Providers | nav sidebar |
| `composer.picker.models.aria` | Modelos | listbox |
| `composer.picker.favorites` | Favoritos | aba sidebar |
| `composer.picker.off` | off | badge provider unavailable |
| `composer.picker.empty` | Nenhum modelo encontrado. | |
| `composer.picker.favorite.add` | Adicionar aos favoritos | aria + title |
| `composer.picker.favorite.remove` | Remover dos favoritos | aria + title |
| `composer.reasoning.group` | Reasoning | título de seção (EN) |
| `composer.reasoning.contextWindow` | Context Window | seção secundária |
| `composer.reasoning.fastMode` | Fast Mode | seção secundária |
| `composer.reasoning.fast.on` | On | opção radio |
| `composer.reasoning.fast.off` | Off | opção radio |
| `composer.reasoning.fast.label.on` | Fast | parte do label do trigger |
| `composer.reasoning.fast.label.off` | Normal | parte do label do trigger |
| `composer.reasoning.level.low` | Low | |
| `composer.reasoning.level.medium` | Medium | |
| `composer.reasoning.level.high` | High | |
| `composer.reasoning.level.extraHigh` | Extra High | |
| `composer.reasoning.level.max` | Max | |
| `composer.reasoning.defaultSuffix` | (default) | sufixo no radio default; concatenar `" {label} (default)"` |
| `composer.reasoning.aria` | Reasoning and {contextWindowOrMode}: {combinedLabel} | `context window` ou `mode` |
| `composer.reasoning.menu.aria` | Reasoning and mode | |
| `composer.mention.aria` | Arquivos do projeto | |
| `composer.mention.loading` | Buscando arquivos… | |
| `composer.mention.empty` | Nenhum arquivo | |
| `composer.mention.error` | Falha ao buscar arquivos | |
| `composer.mention.retry` | Tentar novamente | |
| `composer.mention.error.outsideProject` | — | não implementado — ver Lacunas |
| `composer.image.aria` | Anexar imagens | |
| `composer.image.title` | Anexar imagens (o provider recebe nativo ou descrito por visão) | title quando habilitado |
| `composer.image.attached.aria` | Imagens anexadas | região thumbs |
| `composer.image.drop` | Solte as imagens para anexar | overlay drag |
| `composer.image.remove` | Remover | title do X |
| `composer.image.remove.aria` | Remover {name} | |
| `composer.image.history.alt` | Imagem anexada | MessageImageThumbs |
| `composer.image.disabled.multimodal` | Este provider não aceita anexos de imagem. | `title` do CTA clipe quando `!multimodal` |
| `composer.image.error.type` | Tipo não suportado em "{name}". Anexe apenas imagens. | acentuado (destino diverge da fonte, que não tinha acento) |
| `composer.image.error.tooLarge` | "{name}" excede o limite de {limit}. | fonte default `{limit}`=`16 MB`; Engrena=`4 MB` |
| `composer.image.error.maxCount` | Você pode anexar até {maxCount} imagens por mensagem. | acentuado; fonte default 8, Engrena `{maxCount}`=`5` |
| `composer.image.error.network` | — | N/A no destino — ver Lacunas |
| `composer.image.error.upload` | — | N/A no destino — ver Lacunas |

### Fora de escopo F16 (não catalogar)

Slash / `CommandMenu` (fonte: `Buscando comandos…`, `Nenhum comando`, chip `/{name}`): **excluído** do Engrena F16. ExecutionMode / GitActions: F13 / F14.

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{providerLabel}` | Label do provider ativo (ex. Claude) |
| `{modelLabel}` | Label do modelo ativo |
| `{combinedLabel}` | Label do pill reasoning (ex. `High · 200k`) |
| `{contextWindowOrMode}` | `context window` ou `mode` no aria |
| `{name}` | Nome do arquivo de imagem |
| `{limit}` | Limite formatado (Engrena: `4 MB`) |
| `{maxCount}` | Máx. imagens por mensagem (Engrena: `5`) |

## Lacunas — resolvidas

Nenhum `TODO` restante. Decisões:

| Id necessário | Motivo | Decisão |
|---------------|--------|---------|
| `composer.image.disabled.multimodal` | Fonte esconde CTA; PRD/spec exigem disabled + motivo | Implementado — ver tabela acima (`ComposerImageAttachments.tsx`) |
| `composer.mention.error.outsideProject` | PRD cita toast; não há string na fonte | **Não implementado — inalcançável por construção.** O menu `@` só lista arquivos que a própria API já escopa dentro de `project.path` (nunca sugere um path externo); o composer não faz parsing de menções `@` digitadas livremente no texto, só das que vêm da seleção do menu. Não existe caminho de código que dispare esse erro hoje. Adicionar parsing de texto livre para viabilizar esse erro seria mudança de comportamento, fora do escopo deste passe de copy. Id reservado |
| Acentos em `composer.image.error.*` | Fonte sem acento (`Nao`/`Voce`) | **Resolvido — decisão: acentuação padrão PT-BR.** Já implementado tanto no client (`composer.logic.ts`) quanto no server (`composer-images.ts`) |
| `composer.image.error.network` / `.upload` | Fonte tinha etapa de upload ao servidor | **N/A no destino.** Arquitetura Engrena lê a imagem inteiramente client-side (`FileReader` → base64) e anexa direto no payload do turno — não há passo de upload separado ao servidor local, então esses erros nunca podem ocorrer. Ids não usados |
| Labels Ultra / Ultracode / Ultrathink | Existem na fonte; catálogo Engrena F16 não lista | N/A no MVP Engrena |

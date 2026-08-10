# Spec de UI: #principal composer + #configuracao (Ditado por Voz)

**Feature:** F27-ditado-por-voz  
**Destino:** EngrenaCode  
**Fonte de referência:** LionCodeLabs (`TaskComposer.tsx` botão mic; `useVoiceInput.ts`; card STT em `ConfiguracaoScreen.tsx`)  
**Componente fonte:** `packages/renderer/src/components/TaskComposer.tsx` + `hooks/useVoiceInput.ts` + card “Ditado por voz (transcrição)” em `ConfiguracaoScreen.tsx`  
**Componente destino (previsto):** `src/renderer/components/workspace/TaskComposer.tsx` (+ hook voice) e card STT em `ConfiguracaoScreen.tsx`  
**Última atualização:** 2026-08-08

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Composer com mic (disabled, sem key) | `docs/F27-ditado-por-voz/ui/composer-mic-referencia.png` |
| Card STT em Configuração | `docs/F27-ditado-por-voz/ui/config-stt-keys-referencia.png` |
| Light (opcional) | TODO |

> Capturado 2026-08-08 via `playwright-cli attach --cdp` no Electron LionCodeLabs. Mic aparece à esquerda do clipe de anexos; `aria-label="Ditar por voz"`; disabled sem chave STT (`title` orienta Configuração).

## Escopo

**Inclui (Engrena F27 / paridade fonte):**
- Botão microfone no composer (toggle grava → para → transcreve → texto no textarea; **nunca** auto-envia)
- Estados visuais: idle / requesting-permission / recording (timer) / transcribing (spinner) / error
- Mensagens de erro/notice do hook
- Card **Ditado por voz (transcrição)** em `#configuracao` (keys OpenAI/Groq)
- Esc cancela gravação/transcrição

**Exclui:**
- TTS / providers de voz além de STT (PRD §7)
- autoSend (fonte já é “versão básica” sem auto-envio — alinhado ao PRD)
- Contratos HTTP de transcrição (`spec.md` futuro)

## Anatomia (topo → base)

### A) Composer (`TaskComposer`) — toolbar direita

Ordem no grupo à direita do divisor (fonte):

1. **Mic** (`aria-label="Ditar por voz"`) — **antes** do clipe de anexos (PRD: “ao lado do clipe”; fonte coloca mic à esquerda do clipe)
2. Clipe de imagens (F16)
3. Context meter / Enviar|Stop

Estados do mic:

| state | Conteúdo visual | title (prioridade: errorMessage se houver) |
|-------|-----------------|--------------------------------------------|
| idle + keyReady | ícone mic | Ditar (microfone) |
| configLoading | ícone mic disabled | Carregando configuração de ditado… |
| !keyReady | ícone mic disabled | Configure a chave de transcrição (OpenAI/Groq) na Configuração |
| recording | dot pulse vermelho + timer `MM:SS` | Parar e transcrever (Esc cancela) |
| requesting-permission / transcribing | spinner | Transcrevendo… (clique ou Esc para cancelar) *permission usa mesmo spinner* |
| error | ícone mic `text-red` | message do hook |

Abaixo do composer (condicionais):

- `voice.errorMessage` + `state===error` → `p` `text-xs text-red` `role="alert"`
- `voice.noticeMessage` → `p` `text-xs text-amber` `role="status"`

Texto transcrito: insert/append no textarea como rascunho editável; usuário revisa e clica Enviar.

### B) `#configuracao` — card STT

1. Título **Ditado por voz (transcrição)**
2. Subtítulo sobre OpenAI/Groq Whisper + áudio local
3. Keyrow: **OpenAI** (`sk-…`) · **Groq** (`gsk_…`) + badge configurada/não configurada
4. CTA **Salvar chaves** / **Salvando...**
5. Success: **Chaves de transcrição salvas no cofre.**

**Alinhamento:** mic na toolbar do composer; card na coluna Configuração.  
**Largura máx.:** composer full; config `max-w-[760px]`.

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Botão mic | `h-6 … rounded-full px-[6px]`; idle `text-muted hover:bg-surface-2`; recording `text-red`; error `text-red` | fonte |
| Dot recording | `h-[8px] w-[8px] animate-pulse rounded-full bg-red` | |
| Timer | `font-mono text-[10.5px] tabular-nums` | |
| Spinner | `h-[14px] w-[14px] animate-spin` | |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |
| Disabled | `disabled:opacity-40` | |
| Alert voice | `mt-sm text-xs text-red` | |
| Notice voice | `mt-sm text-xs text-amber` | |
| Card STT | mesmo KeysForm F02/F10 | |

## Copy (literal — fonte de verdade)

Aplicar `LionCode → EngrenaCode`. Ver `copy.md`. Células = destino.

| Slot | Texto |
|------|-------|
| `voice.aria.mic` | Ditar por voz |
| `voice.title.idle` | Ditar (microfone) |
| `voice.title.configLoading` | Carregando configuração de ditado… |
| `voice.title.noKey` | Configure a chave de transcrição (OpenAI/Groq) na Configuração |
| `voice.title.recording` | Parar e transcrever (Esc cancela) |
| `voice.title.transcribing` | Transcrevendo… (clique ou Esc para cancelar) |
| `voice.error.configLoad` | Não foi possível carregar a configuração de ditado. |
| `voice.error.configLoadRetry` | Não foi possível carregar a configuração de ditado — tente de novo. |
| `voice.error.noKey` | Configure a chave do provider de transcrição na Configuração. |
| `voice.error.permissionDenied` | Permissão de microfone negada. |
| `voice.error.noMic` | Nenhum microfone encontrado. |
| `voice.error.micAccess` | Falha ao acessar o microfone. |
| `voice.error.noAudioTrack` | O dispositivo não forneceu trilha de áudio. |
| `voice.error.recorderStart` | Falha ao iniciar o gravador de áudio. |
| `voice.error.mediaRecorderUnsupported` | Este ambiente não suporta gravação de áudio (MediaRecorder). |
| `voice.error.recording` | Erro na gravação de áudio. |
| `voice.error.micDisconnected` | O microfone foi desconectado durante a gravação. |
| `voice.error.network` | Não foi possível contatar o servidor local. |
| `voice.error.transcribe` | Falha ao transcrever o áudio. |
| `voice.notice.tooShort` | Gravação curta demais — tente de novo. |
| `voice.notice.emptyBlob` | Nenhum áudio capturado. |
| `voice.notice.emptyTranscript` | Nada transcrito — tente falar mais perto do microfone. |
| `voice.config.title` | Ditado por voz (transcrição) |
| `voice.config.subtitle` | Chave da OpenAI ou da Groq para o microfone do composer (Whisper). O áudio nunca sai desta máquina para outro destino. |
| `voice.config.label.openai` | OpenAI |
| `voice.config.label.groq` | Groq |
| `voice.config.placeholder.openai` | sk-… |
| `voice.config.placeholder.groq` | gsk_… |
| `voice.config.cta.save` | Salvar chaves |
| `voice.config.cta.saving` | Salvando... |
| `voice.config.success` | Chaves de transcrição salvas no cofre. |
| `voice.prd.error.transcribeRetry` | Não foi possível transcrever. Tente novamente. | PRD §6 — alinhar com `voice.error.transcribe` ou substituir |

> PRD: sem permissão → CTA disabled com `title` explicando; falha preserva áudio para nova tentativa (comportamento; copy de retry pode unificar com PRD).

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| Mic | button toggle | sim | start/stop/cancel; disabled se stopping/loading/configLoading/!keyReady |
| Esc | keyboard | sim | cancela recording/transcribing (listener global na fonte) |
| OpenAI/Groq keys | password KeysForm | não | salva no vault; auto-switch provider se só o outro tem key |
| Textarea composer | text | sim | recebe transcript; não envia sozinho |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` / idle | mount + keyReady | mic muted |
| `disabled-no-key` | !keyReady | disabled + title Configuração |
| `configLoading` | preflight | disabled |
| `requesting-permission` | getUserMedia | spinner; cancel no click |
| `recording` | stream ok | timer vermelho; click stop |
| `transcribing` | stop + blob ok | spinner |
| `filling` | transcript insert | texto no composer |
| `error` | falhas listadas | alert + mic vermelho |
| `notice` | curto/vazio | amber status |

## Componentes sugeridos

| Primitive | Uso |
|-----------|-----|
| Botão icon (composer) | mic / spinner / timer |
| `KeysForm` / `Field` | card STT Configuração |
| `InlineFeedback` | error/notice sob composer |

## Aceite visual

- [ ] Mic ao lado do clipe; estados recording/transcribing visíveis
- [ ] Sem auto-envio após transcrição
- [ ] Disabled + title sem permissão/sem key
- [ ] Card STT copy 100%
- [ ] Tema tokens; sem Lion*

## Perguntas em aberto

- Destino mantém OpenAI+Groq só, ou “local quando disponível no SO” (PRD) ganha UI própria?
- Unificar `voice.error.transcribe` com a frase literal do PRD?
- Mic à esquerda do clipe (fonte) vs “ao lado” sem ordem fixa no PRD — confirmar ordem Engrena (F16 clipe já existe).

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/PRD.md` §6/§9 F27 | ACs |
| `docs/F16-composer-avancado/ui.md` | Toolbar composer / anexos |
| `docs/F02-configuracao-mvp/ui.md` | Coluna config (STT fora do F02 Central) |
| `docs/F27-ditado-por-voz/copy.md` | Catálogo |

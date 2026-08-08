# Catálogo de copy: F27-ditado-por-voz

**Produto:** EngrenaCode  
**Fonte:** LionCodeLabs (`TaskComposer.tsx`, `useVoiceInput.ts`, `ConfiguracaoScreen` card STT)  
**Mapa de rename:** `LionCode → EngrenaCode` (nenhuma string deste catálogo usa o wordmark)  
**Última atualização:** 2026-08-08

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`voice.{{slot}}`

## Telas

### voice.composer (mic + feedback)

| Id | Texto | Notas |
|----|-------|-------|
| `voice.aria.mic` | Ditar por voz | `aria-label` |
| `voice.title.idle` | Ditar (microfone) | |
| `voice.title.configLoading` | Carregando configuração de ditado… | |
| `voice.title.noKey` | Configure a chave de transcrição (OpenAI/Groq) na Configuração | |
| `voice.title.recording` | Parar e transcrever (Esc cancela) | |
| `voice.title.transcribing` | Transcrevendo… (clique ou Esc para cancelar) | também em requesting-permission na prática visual |
| `voice.error.configLoad` | Não foi possível carregar a configuração de ditado. | mount |
| `voice.error.configLoadRetry` | Não foi possível carregar a configuração de ditado — tente de novo. | start sem cache |
| `voice.error.noKey` | Configure a chave do provider de transcrição na Configuração. | |
| `voice.error.permissionDenied` | Permissão de microfone negada. | NotAllowedError |
| `voice.error.noMic` | Nenhum microfone encontrado. | NotFoundError |
| `voice.error.micAccess` | Falha ao acessar o microfone. | outros getUserMedia |
| `voice.error.noAudioTrack` | O dispositivo não forneceu trilha de áudio. | |
| `voice.error.recorderStart` | Falha ao iniciar o gravador de áudio. | |
| `voice.error.mediaRecorderUnsupported` | Este ambiente não suporta gravação de áudio (MediaRecorder). | |
| `voice.error.recording` | Erro na gravação de áudio. | |
| `voice.error.micDisconnected` | O microfone foi desconectado durante a gravação. | |
| `voice.error.network` | Não foi possível contatar o servidor local. | |
| `voice.error.transcribe` | Falha ao transcrever o áudio. | genérico hook |
| `voice.error.transcribePrd` | Não foi possível transcrever. Tente novamente. | PRD §6 — candidata a unificar |
| `voice.notice.tooShort` | Gravação curta demais — tente de novo. | |
| `voice.notice.emptyBlob` | Nenhum áudio capturado. | |
| `voice.notice.emptyTranscript` | Nada transcrito — tente falar mais perto do microfone. | |

### voice.config (`#configuracao`)

| Id | Texto | Notas |
|----|-------|-------|
| `voice.config.title` | Ditado por voz (transcrição) | |
| `voice.config.subtitle` | Chave da OpenAI ou da Groq para o microfone do composer (Whisper). O áudio nunca sai desta máquina para outro destino. | |
| `voice.config.label.openai` | OpenAI | |
| `voice.config.label.groq` | Groq | |
| `voice.config.placeholder.openai` | sk-… | |
| `voice.config.placeholder.groq` | gsk_… | |
| `voice.config.cta.save` | Salvar chaves | |
| `voice.config.cta.saving` | Salvando... | |
| `voice.config.success` | Chaves de transcrição salvas no cofre. | |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{MM:SS}` | timer de gravação (derivado de `elapsedMs`, não string estática) |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| STT local (SO) copy | PRD menciona local quando disponível | TODO |
| Unificação `transcribe` vs `transcribePrd` | duas frases equivalentes | TODO design |

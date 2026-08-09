/** Copy literal de F27 (`docs/F27-ditado-por-voz/copy.md`) — ids `voice.*`. */
export const VOICE_COPY = {
  ariaMic: 'Ditar por voz',
  titleIdle: 'Ditar (microfone)',
  titleConfigLoading: 'Carregando configuração de ditado…',
  titleNoKey: 'Configure a chave de transcrição (OpenAI/Groq) na Configuração',
  titleRecording: 'Parar e transcrever (Esc cancela)',
  titleTranscribing: 'Transcrevendo… (clique ou Esc para cancelar)',
  errorConfigLoad: 'Não foi possível carregar a configuração de ditado.',
  errorNoKey: 'Configure a chave do provider de transcrição na Configuração.',
  errorPermissionDenied: 'Permissão de microfone negada.',
  errorNoMic: 'Nenhum microfone encontrado.',
  errorMicAccess: 'Falha ao acessar o microfone.',
  errorNoAudioTrack: 'O dispositivo não forneceu trilha de áudio.',
  errorRecorderStart: 'Falha ao iniciar o gravador de áudio.',
  errorMediaRecorderUnsupported: 'Este ambiente não suporta gravação de áudio (MediaRecorder).',
  errorRecording: 'Erro na gravação de áudio.',
  errorMicDisconnected: 'O microfone foi desconectado durante a gravação.',
  errorNetwork: 'Não foi possível contatar o servidor local.',
  /** Unificado no literal do PRD §6 (spec F27 §3.3 — descarta a variante do hook fonte). */
  errorTranscribe: 'Não foi possível transcrever. Tente novamente.',
  noticeTooShort: 'Gravação curta demais — tente de novo.',
  noticeEmptyBlob: 'Nenhum áudio capturado.',
  noticeEmptyTranscript: 'Nada transcrito — tente falar mais perto do microfone.',
} as const

export type VoiceMicState = 'idle' | 'configLoading' | 'requesting-permission' | 'recording' | 'transcribing' | 'error'

/** Título do mic por estado (`ui.md` §A) — `errorMessage` tem prioridade sobre qualquer estado quando presente. */
export function resolveMicTitle(state: VoiceMicState, keyReady: boolean, errorMessage: string | null): string {
  if (errorMessage !== null) return errorMessage

  switch (state) {
    case 'configLoading':
      return VOICE_COPY.titleConfigLoading
    case 'recording':
      return VOICE_COPY.titleRecording
    case 'requesting-permission':
    case 'transcribing':
      return VOICE_COPY.titleTranscribing
    case 'error':
      return VOICE_COPY.errorTranscribe
    case 'idle':
    default:
      return keyReady ? VOICE_COPY.titleIdle : VOICE_COPY.titleNoKey
  }
}

/** Mapeia erro/exceção da chamada de transcrição pra mensagem exibida (spec F27 §5 + Assumptions §3.3). */
export function mapTranscribeErrorCode(code: string | undefined): string {
  switch (code) {
    case 'voice_key_missing':
      return VOICE_COPY.errorNoKey
    case 'audio_empty':
      return VOICE_COPY.noticeEmptyBlob
    case 'voice_auth_error':
    case 'voice_upstream_error':
    case 'audio_type_invalid':
    case 'audio_too_large':
      return VOICE_COPY.errorTranscribe
    default:
      return VOICE_COPY.errorNetwork
  }
}

export interface CursorInsertResult {
  text: string
  cursor: number
}

/** Insere `insertText` na posição do cursor (entrevista F27 pergunta 10) preservando o texto ao redor. */
export function insertAtCursor(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  insertText: string
): CursorInsertResult {
  const before = current.slice(0, selectionStart)
  const after = current.slice(selectionEnd)
  return { text: `${before}${insertText}${after}`, cursor: before.length + insertText.length }
}

/** `{MM:SS}` do timer de gravação (`copy.md` placeholders dinâmicos) — derivado de `elapsedMs`. */
export function formatRecordingTimer(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** Limite de gravação (spec F27 §3.2) — auto-stop e transcreve ao atingir, sem descartar. */
export const MAX_RECORDING_MS = 120_000

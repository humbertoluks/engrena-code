/** Sem dependências Node — mesma forma de composer-images.ts (F16), estimativa sem decodificar o buffer inteiro. */

export const MAX_AUDIO_BYTES = 8 * 1024 * 1024
export const ALLOWED_AUDIO_MIME_TYPES = ['audio/webm', 'audio/webm;codecs=opus'] as const
export type AllowedAudioMimeType = (typeof ALLOWED_AUDIO_MIME_TYPES)[number]

export interface VoiceAudioInput {
  mimeType: string
  audioBase64: string
}

export type AudioValidationErrorCode = 'audio_type_invalid' | 'audio_too_large' | 'audio_empty' | 'validation_error'

export interface AudioValidationError {
  code: AudioValidationErrorCode
  message: string
}

/** Tamanho decodificado estimado a partir do comprimento base64 — mesmo cálculo de composer-images.ts. */
export function estimateBase64ByteLength(base64: string): number {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '')
  if (clean.length === 0) return 0
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding)
}

/** Regras: MIME na allowlist, base64 não vazio, ≤ 8 MiB decodificado (spec F27 §5). `null` = válido. */
export function validateVoiceAudio(input: unknown): AudioValidationError | null {
  if (typeof input !== 'object' || input === null) {
    return { code: 'validation_error', message: 'Corpo inválido.' }
  }
  const payload = input as Partial<VoiceAudioInput>

  if (typeof payload.mimeType !== 'string' || !(ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(payload.mimeType)) {
    return { code: 'audio_type_invalid', message: 'Formato de áudio não suportado.' }
  }
  if (typeof payload.audioBase64 !== 'string' || payload.audioBase64 === '') {
    return { code: 'audio_empty', message: 'Nenhum áudio capturado.' }
  }
  if (estimateBase64ByteLength(payload.audioBase64) > MAX_AUDIO_BYTES) {
    return { code: 'audio_too_large', message: 'Áudio excede o limite de 8 MB.' }
  }

  return null
}

import { apiRequest } from './api-client'

export interface TranscribeResult {
  text?: string
  provider?: 'openai' | 'groq'
  error?: { code: string; message: string }
}

export const voiceService = {
  transcribe: (audioBase64: string, mimeType: string): Promise<TranscribeResult> =>
    apiRequest('POST', '/api/voice/transcribe', { audioBase64, mimeType }),
}

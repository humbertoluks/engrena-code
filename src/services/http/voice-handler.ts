import type { IncomingMessage, ServerResponse } from 'http'
import { guard, parseBody, readBody, sendError, sendJson, sendTransportError } from './_transport.js'
import { vaultService } from '../vault/vault-service.js'
import { validateVoiceAudio, type VoiceAudioInput } from '../voice/voice-audio.js'
import { transcribeAudio, VoiceTranscribeError } from '../voice/transcribe.js'

async function handleTranscribe(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const data = parseBody<Partial<VoiceAudioInput>>(await readBody(req))
  if (data === null) {
    return sendJson(res, 400, { error: { code: 'invalid_request', message: 'Corpo inválido.' } })
  }

  const audioError = validateVoiceAudio(data)
  if (audioError !== null) {
    return sendJson(res, 400, { error: { code: audioError.code, message: audioError.message } })
  }

  const openaiKey = vaultService.getSecret('voice:openai')
  const groqKey = vaultService.getSecret('voice:groq')
  const audio = Buffer.from((data as VoiceAudioInput).audioBase64, 'base64')

  try {
    const result = await transcribeAudio({ openai: openaiKey, groq: groqKey }, audio, (data as VoiceAudioInput).mimeType)
    sendJson(res, 200, result)
  } catch (err) {
    if (err instanceof VoiceTranscribeError) {
      // 401/423 ficam reservados a sessão do vault (api-client.ts trata qualquer 401 como "sessão
      // inválida" e força relock) — key de provider rejeitada é 422, não 401, para não derrubar a
      // sessão do EngrenaCode por causa de uma credencial de terceiro inválida.
      const status = err.code === 'voice_key_missing' ? 400 : err.code === 'voice_auth_error' ? 422 : 502
      return sendJson(res, status, { error: { code: err.code, message: err.message } })
    }
    throw err
  }
}

// ── Router ──────────────────────────────────────────────────────────────────

export async function handleVoiceRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  if (url !== '/api/voice/transcribe') return false
  if (!guard(req, res)) return true

  try {
    if (method === 'POST') {
      await handleTranscribe(req, res)
      return true
    }
  } catch (err) {
    if (sendTransportError(res, err)) return true
    console.error('[voice-handler] Unhandled error:', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    return true
  }

  return false
}

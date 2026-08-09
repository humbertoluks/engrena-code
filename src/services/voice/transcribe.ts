/**
 * Cliente STT com fallback (spec F27 §3.2/§5): OpenAI Whisper primeiro; erro de rede/upstream
 * com key Groq presente tenta Groq; erro de auth (401/403) nunca faz fallback — é sinal de key
 * errada, não de instabilidade. Endpoints/modelos não confirmados contra conta real nesta
 * versão (mesma ressalva já registrada em glm-driver.ts/grok-driver.ts).
 */

const OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions'
const OPENAI_MODEL = 'whisper-1'
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_MODEL = 'whisper-large-v3-turbo'

export type VoiceTranscribeErrorCode = 'voice_key_missing' | 'voice_auth_error' | 'voice_upstream_error'

export class VoiceTranscribeError extends Error {
  code: VoiceTranscribeErrorCode
  constructor(code: VoiceTranscribeErrorCode, message: string) {
    super(message)
    this.name = 'VoiceTranscribeError'
    this.code = code
  }
}

export interface VoiceTranscribeKeys {
  openai?: string
  groq?: string
}

export interface VoiceTranscribeResult {
  text: string
  provider: 'openai' | 'groq'
}

export type FetchFn = typeof fetch
let fetchImpl: FetchFn = fetch
export function setFetchForTesting(fn: FetchFn): void {
  fetchImpl = fn
}
export function resetFetchForTesting(): void {
  fetchImpl = fetch
}

interface TranscriptionResponse {
  text?: string
}

type CallOutcome = { ok: true; text: string } | { ok: false; kind: 'auth' | 'upstream' }

async function callWhisperCompatible(
  url: string,
  model: string,
  apiKey: string,
  audio: Buffer,
  mimeType: string
): Promise<CallOutcome> {
  const form = new FormData()
  form.append('file', new Blob([audio], { type: mimeType }), 'audio.webm')
  form.append('model', model)

  let res: Response
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
  } catch {
    return { ok: false, kind: 'upstream' }
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, kind: 'auth' }
  }
  if (!res.ok) {
    return { ok: false, kind: 'upstream' }
  }

  let payload: TranscriptionResponse
  try {
    payload = (await res.json()) as TranscriptionResponse
  } catch {
    return { ok: false, kind: 'upstream' }
  }

  if (typeof payload.text !== 'string') {
    return { ok: false, kind: 'upstream' }
  }

  return { ok: true, text: payload.text }
}

/** Orquestra OpenAI→Groq (spec F27 §3.2). Lança `VoiceTranscribeError` tipado em toda falha. */
export async function transcribeAudio(
  keys: VoiceTranscribeKeys,
  audio: Buffer,
  mimeType: string
): Promise<VoiceTranscribeResult> {
  const hasOpenai = Boolean(keys.openai)
  const hasGroq = Boolean(keys.groq)

  if (!hasOpenai && !hasGroq) {
    throw new VoiceTranscribeError('voice_key_missing', 'Nenhuma key de transcrição salva no cofre.')
  }

  if (hasOpenai) {
    const result = await callWhisperCompatible(OPENAI_URL, OPENAI_MODEL, keys.openai as string, audio, mimeType)
    if (result.ok) return { text: result.text, provider: 'openai' }
    if (result.kind === 'auth') {
      throw new VoiceTranscribeError('voice_auth_error', 'OpenAI rejeitou a key de transcrição.')
    }
    if (!hasGroq) {
      throw new VoiceTranscribeError('voice_upstream_error', 'Falha ao contatar a OpenAI para transcrição.')
    }
  }

  const result = await callWhisperCompatible(GROQ_URL, GROQ_MODEL, keys.groq as string, audio, mimeType)
  if (result.ok) return { text: result.text, provider: 'groq' }
  if (result.kind === 'auth') {
    throw new VoiceTranscribeError('voice_auth_error', 'Groq rejeitou a key de transcrição.')
  }
  throw new VoiceTranscribeError('voice_upstream_error', 'Falha ao contatar o Groq para transcrição.')
}

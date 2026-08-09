import { useCallback, useEffect, useRef, useState } from 'react'
import { voiceService } from '../services/voice-service'
import {
  MAX_RECORDING_MS,
  VOICE_COPY,
  mapTranscribeErrorCode,
  type VoiceMicState,
} from '../components/workspace/voiceInput.logic'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function pickRecordingMimeType(): string {
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus'
  }
  return 'audio/webm'
}

function permissionErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError') return VOICE_COPY.errorPermissionDenied
  if (name === 'NotFoundError') return VOICE_COPY.errorNoMic
  return VOICE_COPY.errorMicAccess
}

export interface UseVoiceInputArgs {
  /** `null` = `ConfigStatus` do composer ainda carregando (ui.md estado `configLoading`). */
  keyReady: boolean | null
  /** Chamado com o texto transcrito — o hook nunca escreve direto no textarea (spec F27 §3.2). */
  onTranscript: (text: string) => void
}

export interface UseVoiceInputResult {
  state: VoiceMicState
  keyReady: boolean
  errorMessage: string | null
  noticeMessage: string | null
  elapsedMs: number
  toggle: () => void
}

/** State machine de F27 (spec §3.2, `ui.md` §A) — ciclo do `MediaRecorder`, timer, cancelamento por Esc. */
export function useVoiceInput({ keyReady, onTranscript }: UseVoiceInputArgs): UseVoiceInputResult {
  const [state, setState] = useState<VoiceMicState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const cancelledRef = useRef(false)

  const resolvedKeyReady = keyReady ?? false
  const effectiveState: VoiceMicState = keyReady === null && state === 'idle' ? 'configLoading' : state

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopStream = useCallback((): void => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const finishRecording = useCallback(
    async (mimeType: string): Promise<void> => {
      stopStream()
      const blob = new Blob(chunksRef.current, { type: mimeType })
      chunksRef.current = []

      if (blob.size === 0) {
        setNoticeMessage(VOICE_COPY.noticeEmptyBlob)
        setState('idle')
        return
      }

      setState('transcribing')
      try {
        const audioBase64 = await blobToBase64(blob)
        const res = await voiceService.transcribe(audioBase64, mimeType)
        if (res.error) {
          setErrorMessage(mapTranscribeErrorCode(res.error.code))
          setState('error')
          return
        }
        if (!res.text || res.text.trim() === '') {
          setNoticeMessage(VOICE_COPY.noticeEmptyTranscript)
          setState('idle')
          return
        }
        onTranscript(res.text)
        setState('idle')
      } catch {
        setErrorMessage(mapTranscribeErrorCode(undefined))
        setState('error')
      }
    },
    [onTranscript, stopStream]
  )

  const stopRecording = useCallback((): void => {
    clearTimer()
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [clearTimer])

  const cancelRecording = useCallback((): void => {
    cancelledRef.current = true
    clearTimer()
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state === 'recording') {
      recorder.onstop = null
      recorder.stop()
    }
    stopStream()
    setErrorMessage(null)
    setState('idle')
  }, [clearTimer, stopStream])

  const startRecording = useCallback(async (): Promise<void> => {
    if (!resolvedKeyReady || state !== 'idle') return

    setErrorMessage(null)
    setNoticeMessage(null)
    cancelledRef.current = false
    setState('requesting-permission')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      setErrorMessage(permissionErrorMessage(err))
      setState('error')
      return
    }

    if (cancelledRef.current) {
      stream.getTracks().forEach((track) => track.stop())
      setState('idle')
      return
    }
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((track) => track.stop())
      setErrorMessage(VOICE_COPY.errorNoAudioTrack)
      setState('error')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      stream.getTracks().forEach((track) => track.stop())
      setErrorMessage(VOICE_COPY.errorMediaRecorderUnsupported)
      setState('error')
      return
    }

    streamRef.current = stream
    const mimeType = pickRecordingMimeType()

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, { mimeType })
    } catch {
      stopStream()
      setErrorMessage(VOICE_COPY.errorRecorderStart)
      setState('error')
      return
    }

    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onerror = () => {
      stopStream()
      clearTimer()
      setErrorMessage(VOICE_COPY.errorRecording)
      setState('error')
    }
    recorder.onstop = () => {
      void finishRecording(mimeType)
    }
    stream.getAudioTracks()[0].onended = () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        setErrorMessage(VOICE_COPY.errorMicDisconnected)
        mediaRecorderRef.current.stop()
      }
    }

    mediaRecorderRef.current = recorder
    recorder.start()
    startedAtRef.current = Date.now()
    setElapsedMs(0)
    setState('recording')
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current
      setElapsedMs(elapsed)
      if (elapsed >= MAX_RECORDING_MS) stopRecording()
    }, 250)
  }, [clearTimer, finishRecording, resolvedKeyReady, state, stopRecording, stopStream])

  const retry = useCallback((): void => {
    setErrorMessage(null)
    setState('idle')
  }, [])

  const toggle = useCallback((): void => {
    if (state === 'idle') void startRecording()
    else if (state === 'recording') stopRecording()
    else if (state === 'error') retry()
  }, [retry, startRecording, state, stopRecording])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return
      if (state === 'recording' || state === 'requesting-permission') cancelRecording()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cancelRecording, state])

  useEffect(() => {
    return () => {
      clearTimer()
      stopStream()
    }
  }, [clearTimer, stopStream])

  return { state: effectiveState, keyReady: resolvedKeyReady, errorMessage, noticeMessage, elapsedMs, toggle }
}

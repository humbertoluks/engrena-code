import type { ReactElement } from 'react'
import { formatRecordingTimer, isMicDisabledIdle, resolveMicTitle, VOICE_COPY, type VoiceMicState } from './voiceInput.logic'

export interface VoiceMicButtonProps {
  state: VoiceMicState
  keyReady: boolean
  permissionDenied: boolean
  errorMessage: string | null
  elapsedMs: number
  disabled: boolean
  onClick: () => void
}

/** Botão mic da toolbar do composer — item 1 da anatomia (ui.md §A), antes do clipe de imagens. */
export function VoiceMicButton({
  state,
  keyReady,
  permissionDenied,
  errorMessage,
  elapsedMs,
  disabled,
  onClick,
}: Readonly<VoiceMicButtonProps>): ReactElement {
  const title = resolveMicTitle(state, keyReady, permissionDenied, errorMessage)
  const isRecording = state === 'recording'
  const isBusy = state === 'requesting-permission' || state === 'transcribing'
  const isError = state === 'error'
  const isDisabled = disabled || state === 'configLoading' || (state === 'idle' && isMicDisabledIdle(keyReady, permissionDenied))

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      aria-label={VOICE_COPY.ariaMic}
      className={`flex items-center gap-[4px] rounded-md border border-border bg-surface px-xs py-[3px] text-[12px] disabled:opacity-40 ${
        isRecording || isError ? 'text-red' : 'text-muted hover:bg-surface-2'
      }`}
    >
      {isRecording ? (
        <>
          <span className="h-[8px] w-[8px] animate-pulse rounded-full bg-red" aria-hidden="true" />
          <span className="font-mono text-[10.5px] tabular-nums">{formatRecordingTimer(elapsedMs)}</span>
        </>
      ) : isBusy ? (
        <span className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">🎙️</span>
      )}
    </button>
  )
}

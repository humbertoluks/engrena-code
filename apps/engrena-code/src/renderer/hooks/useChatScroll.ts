/**
 * useChatScroll — cola no fim do chat sem sequestrar a rolagem.
 *
 * O container só desce sozinho enquanto o usuário já estava perto do fim. Subiu para reler? O
 * auto-scroll pausa; quando o agente posta resposta nova, `showJump` acende e a UI oferece
 * "Ver mensagem" em vez de saltar por conta própria.
 *
 * Duas fontes de reajuste, porque o conteúdo cresce de dois jeitos:
 *  - `signal`: updates discretos (item novo, troca de thread) — cobre o "abrir já no fim".
 *  - `active`: durante o turno, observers de mutação/resize agendam no máximo um frame quando
 *    o conteúdo realmente muda.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import {
  isJumpShortcut,
  isNearBottom,
  NEAR_BOTTOM_THRESHOLD_PX,
  shouldPreventJumpDefault,
  shouldShowJump,
} from './chatScroll.logic'

export interface ChatScrollParams {
  /** Muda a cada update discreto do conteúdo (quantidade de itens, texto em streaming…). */
  signal: string
  /** Falso desliga o auto-scroll (ex.: aba Diff em foco). */
  enabled: boolean
  /** Turno em andamento — liga os observers de streaming. */
  active: boolean
  /** Identidade da última resposta do agente; mudar com o usuário longe do fim acende o CTA. */
  latestKey: string
  /** Troca de thread: volta a abrir presa no fim, sem herdar o scroll da conversa anterior. */
  resetKey: string
}

export interface ChatScrollHandle<T extends HTMLElement> {
  ref: RefObject<T | null>
  showJump: boolean
  jumpToLatest: () => void
}

export function useChatScroll<T extends HTMLElement>({
  signal,
  enabled,
  active,
  latestKey,
  resetKey,
}: ChatScrollParams): ChatScrollHandle<T> {
  const ref = useRef<T>(null)
  // Começa "preso": abrir uma thread deve mostrar a última mensagem.
  const pinnedRef = useRef(true)
  // `true` enquanto o usuário rola ativamente (debounce curto) — nesse intervalo nada toca
  // scrollTop, senão a rolagem manual trava.
  const userScrollingRef = useRef(false)
  const [showJump, setShowJump] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let releaseTimer = 0
    const onScroll = (): void => {
      const pinned = isNearBottom(el, NEAR_BOTTOM_THRESHOLD_PX)
      pinnedRef.current = pinned
      if (pinned) setShowJump(false)
    }
    const markUser = (): void => {
      userScrollingRef.current = true
      window.clearTimeout(releaseTimer)
      releaseTimer = window.setTimeout(() => {
        userScrollingRef.current = false
      }, 200)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('wheel', markUser, { passive: true })
    el.addEventListener('touchmove', markUser, { passive: true })
    el.addEventListener('keydown', markUser)
    return () => {
      window.clearTimeout(releaseTimer)
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', markUser)
      el.removeEventListener('touchmove', markUser)
      el.removeEventListener('keydown', markUser)
    }
  }, [])

  // Reset antes do efeito de rolagem (mesmo commit): a thread nova abre presa no fim em vez de
  // herdar o "solto" de quem estava relendo a anterior.
  const resetRef = useRef(resetKey)
  useLayoutEffect(() => {
    if (resetRef.current === resetKey) return
    resetRef.current = resetKey
    pinnedRef.current = true
    setShowJump(false)
  }, [resetKey])

  // Updates discretos: se preso (e o usuário não está rolando), desce antes do paint.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `signal` é o gatilho do reajuste, não um valor lido no efeito.
  useLayoutEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el || !pinnedRef.current || userScrollingRef.current) return
    el.scrollTop = el.scrollHeight
  }, [enabled, signal])

  // Streaming: reage só a mudança real de DOM/tamanho, coalescida em um RAF.
  useEffect(() => {
    if (!enabled || !active) return
    const el = ref.current
    if (!el) return
    let raf = 0
    const apply = (): void => {
      raf = 0
      if (pinnedRef.current && !userScrollingRef.current) el.scrollTop = el.scrollHeight
    }
    const schedule = (): void => {
      if (raf === 0) raf = requestAnimationFrame(apply)
    }
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    const observeChildren = (): void => {
      resize?.disconnect()
      resize?.observe(el)
      for (const child of el.children) resize?.observe(child)
    }
    const mutations = new MutationObserver(() => {
      observeChildren()
      schedule()
    })
    observeChildren()
    mutations.observe(el, { childList: true, subtree: true, characterData: true })
    el.addEventListener('load', schedule, true)
    schedule()
    return () => {
      if (raf !== 0) cancelAnimationFrame(raf)
      mutations.disconnect()
      resize?.disconnect()
      el.removeEventListener('load', schedule, true)
    }
  }, [enabled, active])

  // Resposta nova do agente: acende o CTA só se o usuário estiver longe do fim. O primeiro
  // valor (montagem/abertura da thread) não conta como "nova".
  const lastKeyRef = useRef(latestKey)
  useEffect(() => {
    const changed = lastKeyRef.current !== latestKey
    lastKeyRef.current = latestKey
    if (!changed) return
    setShowJump((current) => shouldShowJump({ latestChanged: true, pinned: pinnedRef.current, current }))
  }, [latestKey])

  const jumpToLatest = useCallback(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
    pinnedRef.current = true
    setShowJump(false)
  }, [])

  // Ctrl+End em qualquer lugar da tela leva ao fim da conversa (não só com o CTA aceso).
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isJumpShortcut(event)) return
      if (shouldPreventJumpDefault(event.target as HTMLElement | null)) event.preventDefault()
      jumpToLatest()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, jumpToLatest])

  return { ref, showJump, jumpToLatest }
}

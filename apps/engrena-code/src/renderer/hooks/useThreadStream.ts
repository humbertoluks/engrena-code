import { useEffect, useRef } from 'react'
import {
  connectThreadStream,
  type ConnectThreadStream,
  type StreamEvent,
} from '../services/ws-client'
import { isEventForThread, planReconnect } from './threadStream.logic'

export interface ThreadStreamResyncInfo {
  /** `false` no primeiro open da thread; `true` em todo open depois de uma queda. */
  reconnect: boolean
}

export interface UseThreadStreamInput {
  /** Thread selecionada; `null` desconecta e não reconecta. */
  threadId: string | null
  /** Já filtrado por thread — o hook descarta evento de outra thread antes de chamar. */
  onEvent: (event: StreamEvent) => void
  /**
   * Chamado em **todo** open, inclusive o primeiro. É onde o chamador relê o estado que o stream
   * não sabe recuperar sozinho (histórico + snapshot de gate) e zera o que é efêmero.
   */
  onResync: (threadId: string, info: ThreadStreamResyncInfo) => void
  /** Injeção para teste/smoke; produção usa `connectThreadStream`. */
  connect?: ConnectThreadStream
  /** Fonte de aleatoriedade do jitter do backoff. */
  random?: () => number
}

/**
 * Dono da conexão de stream da thread selecionada: conecta, filtra por thread, reconecta com
 * backoff e dispara o resync a cada open.
 *
 * Antes disto o client só ligava `onmessage`. Sem `onclose`/`onerror`, **socket morto era
 * indistinguível de socket ocioso**: a UI ficava parada achando que o turno não tinha produzido
 * nada, e só voltava a viver quando o usuário trocava de thread. Pior, o hub não bufferiza (o
 * `emit` é no-op sem subscriber), então nem quando o socket voltava o que passou era entregue.
 *
 * Por isso o par é indissociável: reconnect **e** resync. Reconectar sem reler estado só troca
 * "parado para sempre" por "parado até o próximo evento".
 *
 * O handler chega por ref (`onEvent`/`onResync`): o efeito depende só de `threadId`, então a
 * conexão não é derrubada e refeita a cada render do workspace, e ao mesmo tempo o closure nunca
 * fica velho — era exatamente o par de problemas que o `eslint-disable exhaustive-deps` do
 * `usePrincipalWorkspace` escondia.
 */
export function useThreadStream({
  threadId,
  onEvent,
  onResync,
  connect = connectThreadStream,
  random = Math.random,
}: UseThreadStreamInput): void {
  // Padrão useLatest: o efeito lê sempre a versão do render corrente sem listá-la nas deps.
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const onResyncRef = useRef(onResync)
  onResyncRef.current = onResync
  const connectRef = useRef(connect)
  connectRef.current = connect
  const randomRef = useRef(random)
  randomRef.current = random

  useEffect(() => {
    if (threadId === null) return

    /** Conexão descartada (unmount ou troca de thread): nada mais pode reconectar nem entregar. */
    let abandoned = false
    /** 0 = conexão inicial. Reseta a cada open bem-sucedido, senão uma queda tardia herdaria o teto. */
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    let disconnect: (() => void) | null = null

    const openConnection = (): void => {
      timer = null
      if (abandoned) return

      // Fim de vida desta conexão específica. O client já garante uma notificação por socket;
      // esta trava cobre também o caminho do `catch` abaixo.
      let closed = false
      const handleClosed = (): void => {
        if (closed || abandoned) return
        closed = true
        const plan = planReconnect({
          previousAttempt: attempt,
          abandoned,
          random: randomRef.current,
        })
        if (plan === null) return
        attempt = plan.attempt
        timer = setTimeout(openConnection, plan.delayMs)
      }

      disconnect = null
      try {
        disconnect = connectRef.current(threadId, {
          onOpen: () => {
            if (abandoned) return
            const reconnect = attempt > 0
            // Só o open bem-sucedido zera o backoff.
            attempt = 0
            onResyncRef.current(threadId, { reconnect })
          },
          onEvent: (event) => {
            if (abandoned || !isEventForThread(event, threadId)) return
            onEventRef.current(event)
          },
          onClose: handleClosed,
        })
      } catch (err) {
        // Construção do socket falhou de cara (URL/segurança). Conta como tentativa: cair no
        // backoff é o que impede o loop apertado quando o servidor recusa a sessão.
        console.error('[ws] connect:', err)
        handleClosed()
      }
    }

    openConnection()

    return () => {
      abandoned = true
      if (timer !== null) clearTimeout(timer)
      timer = null
      disconnect?.()
      disconnect = null
    }
  }, [threadId])
}

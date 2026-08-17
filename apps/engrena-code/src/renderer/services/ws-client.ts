/**
 * O union do wire pertence ao emissor (`services/runner/ws-hub.ts`) e é re-exportado aqui, não
 * copiado: o mirror manual que existia neste arquivo já tinha drifado do original (nunca ganhou
 * `gate.opened`/`gate.resolved`, e `pipeline.stage.phase` tinha virado `string` em vez do union).
 * Drift num tipo de wire não falha a compilação — some em runtime, no `if` que nunca casa.
 *
 * O import é **type-only**: some no bundle, então nada do main entra no renderer (`ws-hub.ts` não
 * tem import de valor — só `import type { WebSocket } from 'ws'`).
 */
export type { StreamEvent } from '../../services/runner/ws-hub.js'
import type { StreamEvent } from '../../services/runner/ws-hub.js'

const WS_BASE_URL = 'ws://127.0.0.1:5174'

export interface ThreadStreamHandlers {
  onEvent: (event: StreamEvent) => void
  /** Handshake aceito — é o gancho do resync (`useThreadStream`). */
  onOpen?: () => void
  /**
   * Fim de vida da conexão, por `close` **ou** por `error`.
   *
   * Chamado no máximo uma vez por socket, e nunca depois do dispose. O browser emite `error`
   * seguido de `close` na mesma queda, e o dispose fecha o socket de propósito: sem a trava,
   * uma queda agendaria dois reconnects e trocar de thread agendaria um terceiro.
   */
  onClose?: () => void
}

export type ConnectThreadStream = typeof connectThreadStream

/**
 * Assina eventos de uma thread; devolve uma função de unsubscribe/close.
 *
 * O client é fino de propósito: ele só traduz o ciclo de vida do `WebSocket` em callbacks. A
 * **política** de reconnect (backoff, quando desistir, o que reler ao voltar) é do hook
 * `useThreadStream`, que é quem tem contexto de thread selecionada e de unmount.
 */
export function connectThreadStream(threadId: string, handlers: ThreadStreamHandlers): () => void {
  const token = localStorage.getItem('sessionToken') ?? ''
  let ws: WebSocket | null = new WebSocket(`${WS_BASE_URL}/?threadId=${encodeURIComponent(threadId)}`, [
    `engrenacode-session.${token}`,
  ])
  // Cobre as três formas de "não notifique mais": close, error e dispose do chamador.
  let done = false

  const notifyClosed = (): void => {
    if (done) return
    done = true
    handlers.onClose?.()
  }

  ws.onopen = () => {
    if (done) return
    handlers.onOpen?.()
  }

  ws.onmessage = (event) => {
    if (done) return
    try {
      handlers.onEvent(JSON.parse(event.data as string) as StreamEvent)
    } catch {
      // ignora frames não-JSON
    }
  }

  // Handshake recusado (sessão inválida / cofre trancado) chega aqui, não em `onopen`: quem
  // decide o intervalo da próxima tentativa é o backoff do hook.
  ws.onclose = notifyClosed
  ws.onerror = notifyClosed

  return () => {
    // Fechar de propósito não é queda — marca antes do `close()` para o `onclose` não virar
    // reconnect da thread que acabou de sair de cena.
    done = true
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      ws.close()
    }
    ws = null
  }
}

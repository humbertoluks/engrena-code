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

/** Assina eventos de uma thread; devolve uma função de unsubscribe/close. */
export function connectThreadStream(threadId: string, onEvent: (event: StreamEvent) => void): () => void {
  const token = localStorage.getItem('sessionToken') ?? ''
  let ws: WebSocket | null = new WebSocket(`${WS_BASE_URL}/?threadId=${encodeURIComponent(threadId)}`, [
    `engrenacode-session.${token}`,
  ])

  ws.onmessage = (event) => {
    try {
      onEvent(JSON.parse(event.data as string) as StreamEvent)
    } catch {
      // ignora frames não-JSON
    }
  }

  return () => {
    ws?.close()
    ws = null
  }
}

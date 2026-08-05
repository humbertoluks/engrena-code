export type StreamEvent =
  | { type: 'message.delta'; threadId: string; text: string }
  | { type: 'tool_call.start'; threadId: string; id: string; name: string; params: unknown }
  | { type: 'tool_call.result'; threadId: string; id: string; status: string; result: unknown }
  | { type: 'diff.ready'; threadId: string; diffId: string; file: string }
  | { type: 'state.change'; threadId: string; state: string }
  | { type: 'error'; threadId: string; code: string; message: string }
  | { type: 'permission.request'; threadId: string; requestId: string; toolName: string; params: unknown }
  | { type: 'permission.resolved'; threadId: string; requestId: string; allow: boolean }
  | { type: 'subagent.start'; threadId: string; childThreadId: string; name: string }
  | { type: 'subagent.result'; threadId: string; childThreadId: string; status: string }
  | { type: 'mcp.notice'; threadId: string; code: string; mcpName: string; reason: string; message: string }

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

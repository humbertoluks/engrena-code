import type { WebSocket } from 'ws'

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
  | {
      type: 'mcp.notice'
      threadId: string
      code: 'mcp-omitted' | 'mcp-oauth-needs-reauth'
      mcpName: string
      reason: string
      message: string
    }

const subscribers = new Map<string, Set<WebSocket>>()

export function subscribe(threadId: string, socket: WebSocket): void {
  let set = subscribers.get(threadId)
  if (!set) {
    set = new Set()
    subscribers.set(threadId, set)
  }
  set.add(socket)
}

export function unsubscribe(threadId: string, socket: WebSocket): void {
  const set = subscribers.get(threadId)
  if (!set) return
  set.delete(socket)
  if (set.size === 0) subscribers.delete(threadId)
}

export function emit(threadId: string, event: StreamEvent): void {
  const set = subscribers.get(threadId)
  if (!set) return
  const payload = JSON.stringify(event)
  for (const socket of set) {
    if (socket.readyState === socket.OPEN) socket.send(payload)
  }
}

export function subscriberCount(threadId: string): number {
  return subscribers.get(threadId)?.size ?? 0
}

/** Apenas para testes: reseta o estado in-memory entre specs. */
export function clearAllSubscriptions(): void {
  subscribers.clear()
}

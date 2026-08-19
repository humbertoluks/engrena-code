import type { WebSocket } from 'ws'
import type { BrokerPermissionOutcome } from './providers/permission-contract.js'

export type StreamEvent =
  | { type: 'message.delta'; threadId: string; text: string }
  | { type: 'tool_call.start'; threadId: string; id: string; name: string; params: unknown }
  | { type: 'tool_call.result'; threadId: string; id: string; status: string; result: unknown }
  | { type: 'diff.ready'; threadId: string; diffId: string; file: string }
  | { type: 'state.change'; threadId: string; state: string }
  | { type: 'error'; threadId: string; code: string; message: string }
  /**
   * `gate.*` é o contrato do ThreadGate (`runner/gate.ts`) — dono único de "algo espera decisão
   * humana", nos dois kinds. O par legado `permission.request`/`permission.resolved` saiu quando o
   * renderer passou a consumir só isto (`renderer/hooks/useThreadGate.ts`).
   */
  | {
      type: 'gate.opened'
      threadId: string
      gateId: string
      kind: 'permission' | 'question'
      toolName: string | null
      payload: unknown
      createdAt: number
      expiresAt: number | null
    }
  | {
      type: 'gate.resolved'
      threadId: string
      gateId: string
      kind: 'permission' | 'question'
      state: 'resolved' | 'expired'
      allow: boolean
      reason: string
    }
  /**
   * Negação da aprovação nativa do Claude CLI — metadata only, sem tool_input.
   *
   * `brokerOutcome` é o que separa os casos e existe porque a UI não consegue derivá-lo: o que o
   * broker do EngrenaCode fez com aquela tool neste turno (concedeu, o usuário negou, expirou sem
   * resposta, o turno foi cancelado, falhou ao abrir o pedido, houve decisões opostas, ou nunca
   * foi consultado). Era um booleano `brokerGranted` até o R09, e por isso a faixa acusava o CLI
   * de negar sozinho uma tool que o usuário recusou.
   */
  | {
      type: 'permission.native_denial'
      threadId: string
      toolName: string
      code: 'permission_native_denial'
      message: string
      brokerOutcome: BrokerPermissionOutcome
      /**
       * Houve rejeição por tamanho de corpo neste turno. Só qualifica o caso "nunca consultado",
       * que é o único em que a rejeição sem `toolName` pode estar escondida.
       */
      oversizedRequestInTurn?: boolean
      toolUseId?: string
      decisionReasonType?: string | null
      /** `decision_reason` do CLI: a frase de quem negou, quando o payload traz. */
      decisionReason?: string | null
    }
  | { type: 'subagent.start'; threadId: string; childThreadId: string; name: string; parallelBatchId?: string | null }
  | { type: 'subagent.result'; threadId: string; childThreadId: string; status: string; parallelBatchId?: string | null }
  /**
   * Atividade de ferramenta **do filho**, trafegando no fio do pai (F29).
   *
   * Tipo próprio em vez de reusar `tool_call.*`: aqueles significam "tool desta thread" e todo
   * consumidor atual os trata assim (o de `usePrincipalWorkspace` refetcha o histórico do pai a
   * cada um). Um `childThreadId` opcional em `tool_call.*` obrigaria cada consumidor a lembrar de
   * filtrar, e quem esquecesse contaria tool do filho como do pai.
   *
   * Payload deliberadamente magro — sem `params`, sem `result`. É sinal de vida e de progresso,
   * não auditoria: no batch paralelo do F18 são até 4 filhos emitindo ao mesmo tempo, e o corpo
   * das tools do filho não tem consumidor. O que sobrevive ao turno é a contagem, em
   * `subagent_runs.action_count`.
   *
   * `threadId` é sempre o **pai** (o fio); `childThreadId` diz de quem é a tool. `id` é o id do
   * provider no stream do filho: cada filho é uma sessão de CLI distinta, então ids podem repetir
   * entre filhos — correlacionar sempre por `childThreadId` + `id`, nunca por `id` sozinho.
   */
  | { type: 'subagent.tool_call.start'; threadId: string; childThreadId: string; id: string; name: string }
  | { type: 'subagent.tool_call.result'; threadId: string; childThreadId: string; id: string; status: string }
  | { type: 'memory.entry'; threadId: string; projectId: string }
  | {
      type: 'pipeline.state'
      threadId: string
      pipelineId: string
      command: string
      status: string
      stageIndex: number
      stageTotal: number
    }
  | {
      type: 'pipeline.stage'
      threadId: string
      pipelineId: string
      stageId: string
      index: number
      total: number
      phase: 'start' | 'waiting_checkpoint' | 'done' | 'error' | 'timeout'
      subagentName: string
      status: string
    }
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

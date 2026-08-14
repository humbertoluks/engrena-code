import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { threadsService } from '../services/threads-service'
import type { StreamEvent } from '../services/ws-client'
import {
  activeGate,
  gateErrorMessage,
  gateFromOpenedEvent,
  permissionFromGate,
  questionFromGate,
  removeGate,
  upsertGate,
  type GatePermission,
  type GateQuestion,
  type GateResolveBody,
  type ThreadGate,
} from './threadGate.logic'

export interface ThreadGateApi {
  /** O gate que a UI mostra (o mais antigo aberto); `null` = ninguém espera decisão. */
  gate: ThreadGate | null
  /** Quantos gates além do exibido — vira "+N na fila" no card. */
  queuedCount: number
  /** Payload normalizado do gate ativo, por kind (um dos dois é sempre `null`). */
  question: GateQuestion | null
  permission: GatePermission | null
  /** Resolução em voo: trava o duplo clique (o mesmo papel do antigo `answerBusy`). */
  busy: boolean
  /** Falha visível da resolução — nunca `catch` silencioso. */
  error: string | null
  clearError: () => void
  /** `gate.opened` / `gate.resolved`; qualquer outro evento é ignorado. */
  applyStreamEvent: (event: StreamEvent) => void
  /** Snapshot `GET /gate`. Devolve a lista (o envio a usa para se recuperar de WS perdido). */
  refresh: (threadId: string) => Promise<ThreadGate[] | null>
  /** Resolve **este** gate por `gateId`. Só remove da UI depois do POST suceder. */
  resolve: (gate: ThreadGate, body: GateResolveBody) => Promise<{ ok: true } | { ok: false; message: string }>
  /** Turno assentado: nenhum gate pode sobrar em tela. */
  clear: () => void
}

/**
 * Fonte única de "algo espera decisão humana" na thread selecionada.
 *
 * Os dois caminhos entregam o mesmo shape e se reforçam: o snapshot `GET /api/threads/:id/gate`
 * remonta a UI na abertura da thread (e depois de um reconnect, onde o evento se perdeu), e
 * `gate.opened`/`gate.resolved` mantêm ao vivo. Nada aqui é derivado de `toolCalls` — o histórico
 * chega por refetch que pode ser abortado ou coalescido, e era isso que fazia o card de pergunta
 * piscar fora de sincronia com o estado real da thread.
 *
 * A resolução vai por `gateId`, o do gate que está em tela: é o que aposenta a heurística
 * "responde a pergunta mais recente" do wire legado `POST /answer`.
 */
export function useThreadGate(threadId: string | null): ThreadGateApi {
  const [gates, setGates] = useState<ThreadGate[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Thread corrente no momento da resposta do snapshot: sem isto, um GET lento de uma thread já
  // trocada repovoaria o card com o gate da anterior.
  const threadIdRef = useRef<string | null>(threadId)
  threadIdRef.current = threadId

  const refresh = useCallback(async (target: string): Promise<ThreadGate[] | null> => {
    try {
      const res = await threadsService.openGates(target)
      if (!mountedRef.current || threadIdRef.current !== target) return null
      if (res.error) {
        console.error('[gate] snapshot:', res.error.message)
        return null
      }
      const next = res.gates ?? []
      setGates(next)
      return next
    } catch (err) {
      console.error('[gate] snapshot:', err)
      return null
    }
  }, [])

  useEffect(() => {
    setGates([])
    setError(null)
    if (threadId === null) return
    void refresh(threadId)
  }, [threadId, refresh])

  const applyStreamEvent = useCallback((event: StreamEvent) => {
    if (event.type === 'gate.opened') {
      setGates((prev) => upsertGate(prev, gateFromOpenedEvent(event)))
      return
    }
    if (event.type === 'gate.resolved') {
      setGates((prev) => removeGate(prev, event.gateId))
    }
  }, [])

  const clear = useCallback(() => {
    setGates([])
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const resolve = useCallback(
    async (gate: ThreadGate, body: GateResolveBody): Promise<{ ok: true } | { ok: false; message: string }> => {
      if (busy) return { ok: false, message: '' }
      setBusy(true)
      setError(null)
      try {
        const res = await threadsService.resolveGate(gate.threadId, gate.gateId, body)
        if (res.error) {
          // Card permanece: o broker (ou o `tools/call` do MCP) continua preso do outro lado, e
          // sumir com o pedido aqui é o sintoma "clique aceito mas nada foi concedido".
          const message = gateErrorMessage(res.error.code, res.error.message)
          if (mountedRef.current) setError(message)
          return { ok: false, message }
        }
        // `gate.resolved` também remove — o upsert/remove por `gateId` é idempotente.
        if (mountedRef.current) setGates((prev) => removeGate(prev, gate.gateId))
        return { ok: true }
      } catch {
        const message = gateErrorMessage(undefined)
        if (mountedRef.current) setError(message)
        return { ok: false, message }
      } finally {
        if (mountedRef.current) setBusy(false)
      }
    },
    [busy]
  )

  // Derivações memoizadas: `questionFromGate`/`permissionFromGate` criam objeto novo a cada
  // chamada, e um objeto novo por render trocaria as props do card a cada tecla no composer.
  const gate = useMemo(() => activeGate(gates), [gates])
  const question = useMemo(() => questionFromGate(gate), [gate])
  const permission = useMemo(() => permissionFromGate(gate), [gate])

  return {
    gate,
    queuedCount: Math.max(gates.length - 1, 0),
    question,
    permission,
    busy,
    error,
    clearError,
    applyStreamEvent,
    refresh,
    resolve,
    clear,
  }
}

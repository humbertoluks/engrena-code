import {
  getThread,
  updateThread,
  type Thread,
  type ThreadState,
  type UpdateThreadInput,
} from '../db/repositories/threads.js'
import { emit } from './ws-hub.js'

/**
 * Máquina de estados do turno — **único** dono de `threads.state` fora do boot.
 *
 * `ThreadState` é união só de TypeScript (não há `CHECK` no SQLite), e antes deste módulo ~15 call
 * sites faziam `updateThread({ state })` + `emit('state.change')` por conta própria. Isso custou
 * três classes de bug nesta base:
 * - transição inválida que ninguém detecta (nenhuma camada sabia o que é legal);
 * - escrita sem `emit` (ou `emit` sem escrita) — a UI diverge do banco até o próximo refetch;
 * - cancel correndo junto de um `tool-result` atrasado, que sobrescrevia `stopping` com `running`.
 *
 * `nextThreadState` é puro (decide) e `applyTransition` é o único caminho que escreve+emite.
 *
 * Fora deste módulo por decisão explícita: `recoverRunningThreads()` (`db/repositories/threads.ts`),
 * um `UPDATE ... WHERE state IN (...)` em lote no boot, sem thread individual e sem WS ligado.
 */

/**
 * Eventos existem **um por causa real**, cada um com call site concreto — não há evento sem
 * consumidor. O estado alvo é função de (estado atual, evento), não do evento sozinho: ver
 * `stopping` + `turn_finished` na tabela abaixo.
 *
 * | evento                   | quem dispara                                                          |
 * |--------------------------|-----------------------------------------------------------------------|
 * | `follow_up`              | `dispatch.dispatchFollowUp` — novo turno em thread já assentada (H2)   |
 * | `gate_opened_permission` | `gate.openPermissionGate` — `PreToolUse` preso no broker               |
 * | `gate_opened_question`   | `gate.markThreadWaitingUser` (pré-arme do `tool-start` + `openQuestionGate`) e o checkpoint de `pipeline-runner` |
 * | `gates_closed`           | `gate.maybeRestoreRunning` e a volta do checkpoint respondido          |
 * | `cancel_requested`       | `dispatch.cancelThread` com execução ativa (abort disparado)           |
 * | `cancel_settled`         | deadline de 8s, cancel de thread órfã e `wasCancelled` no catch do turno/pipeline |
 * | `turn_failed`            | falha de worktree no dispatch e catch do turno sem cancelamento        |
 * | `turn_finished`          | fim feliz de `runTurn`/`runPipelineCommand` (e o catch não-cancelado do pipeline) |
 * | `diffs_committed`        | `apply-diff` aceitou tudo — não sobra diff pending                     |
 * | `diffs_settled`          | `apply-diff` rejeitou, ou aceitou só parte (ainda há pending)          |
 */
export type TurnEvent =
  | 'follow_up'
  | 'gate_opened_permission'
  | 'gate_opened_question'
  | 'gates_closed'
  | 'cancel_requested'
  | 'cancel_settled'
  | 'turn_failed'
  | 'turn_finished'
  | 'diffs_committed'
  | 'diffs_settled'

/** Estado de uma thread recém-criada. Criação não é transição (não há estado anterior nem assinante do WS), mas o valor é deste módulo. */
export const INITIAL_TURN_STATE: ThreadState = 'running'

/** Estados em que existe turno vivo — os únicos de onde um cancelamento ainda faz sentido. */
const LIVE_STATES: readonly ThreadState[] = ['running', 'waiting_user', 'waiting_permission']

/**
 * Estados já assentados: nenhum turno rodando, nenhum gate aberto.
 *
 * `interrupted` (F35) pertence aqui como qualquer outro assentamento. Ficou de fora na primeira
 * versão e o efeito foi pior que o defeito que a feature corrigia: `follow_up` só é legal a partir
 * desta lista, então a thread recuperada no boot **não aceitava mais nenhuma mensagem** — o dispatch
 * respondia `thread_busy` ("ainda tem um turno em andamento") para uma thread que estava parada, e
 * não havia botão de Parar para destravar, porque não havia turno. Com `error` isso não acontecia.
 * Pego no smoke ao vivo de 2026-08-19; a suíte não pegou porque nenhum teste tentava conversar com
 * uma thread interrompida.
 */
const SETTLED_STATES: readonly ThreadState[] = [
  'idle',
  'committed',
  'error',
  'cancelled',
  'interrupted',
]

/**
 * Todo estado da união cai em exatamente um balde: vivo, assentado, ou `stopping` (o transitório do
 * cancelamento, que não é nem um nem outro). Existe para o teste de partição — acrescentar valor a
 * `ThreadState` sem classificá-lo aqui quebra a suíte em vez de virar `thread_busy` em produção.
 */
export const TURN_STATE_BUCKETS = {
  live: LIVE_STATES,
  settled: SETTLED_STATES,
  transitional: ['stopping'] as readonly ThreadState[],
} as const

function from(states: readonly ThreadState[], next: ThreadState): Partial<Record<ThreadState, ThreadState>> {
  const table: Partial<Record<ThreadState, ThreadState>> = {}
  for (const state of states) table[state] = next
  return table
}

/**
 * Tabela de transições: `TRANSITIONS[event][current]` = próximo estado; ausente = ilegal.
 *
 * Duas invariantes que a tabela existe para garantir:
 *
 * 1. **`stopping` é absorvente até assentar.** Só sai para `cancelled` ou `error`. Um `tool-result`
 *    que chega tarde e tenta `gates_closed` (voltar a `running`) é rejeitado — é o bug real de
 *    cancel sobrescrito por evento atrasado. `turn_finished` em `stopping` não vira `idle`: vira
 *    `cancelled`, porque o cancel já foi pedido e deixar a thread presa em `stopping` (o `finally`
 *    do turno limpa o deadline de 8s logo em seguida) seria pior que qualquer um dos dois.
 * 2. **Voltar de gate para `running` só vem de `waiting_permission`/`waiting_user`.** De `idle` ou
 *    `cancelled` não há gate para fechar, e escrever `running` ali ressuscitaria thread assentada.
 */
const TRANSITIONS: Record<TurnEvent, Partial<Record<ThreadState, ThreadState>>> = {
  // Retomada explícita do usuário: só de thread assentada. De `running`/`waiting_*`/`stopping` o
  // turno anterior ainda está vivo (e a lease do projeto já rejeita antes de chegar aqui).
  follow_up: from(SETTLED_STATES, 'running'),

  // Abrir gate é o único caminho de entrada em `waiting_*` (contrato de `gate.ts`). Vindo do outro
  // `waiting_*` é legal: os dois kinds coexistem e o último a abrir manda no rótulo da UI.
  gate_opened_permission: from(['running', 'waiting_user', 'waiting_permission'], 'waiting_permission'),
  gate_opened_question: from(['running', 'waiting_permission', 'waiting_user'], 'waiting_user'),

  // Resolver/expirar o último gate é o único caminho de saída de `waiting_*` para `running`.
  gates_closed: from(['waiting_permission', 'waiting_user'], 'running'),

  // Cancel pedido com execução ativa. Repetir em `stopping` é no-op (clique duplo em Parar).
  cancel_requested: from([...LIVE_STATES, 'stopping'], 'stopping'),

  // Cancel assentado: deadline, thread órfã ou o catch do turno com `wasCancelled`.
  cancel_settled: from([...LIVE_STATES, 'stopping', 'cancelled'], 'cancelled'),

  // Falha do turno. Vale também durante `stopping`: erro real venceu a corrida com o cancel.
  turn_failed: from([...LIVE_STATES, 'stopping', 'error'], 'error'),

  // Fim do turno. Gate ainda aberto é expirado pelo `finally` do próprio turno, então `waiting_*`
  // também assenta em `idle` aqui — senão a thread ficaria presa esperando resposta que não vem.
  turn_finished: { ...from(['running', 'waiting_user', 'waiting_permission', 'idle'], 'idle'), stopping: 'cancelled' },

  // Revisão de diff acontece com a thread já parada (a lease do projeto barra o resto).
  diffs_committed: from(SETTLED_STATES, 'committed'),
  diffs_settled: from(SETTLED_STATES, 'idle'),
}

/**
 * Reducer puro: `null` = transição ilegal (o chamador **não** escreve). Sem I/O e sem efeito —
 * toda a tabela de legalidade vive aqui e é testável sem banco.
 */
export function nextThreadState(current: ThreadState, event: TurnEvent): ThreadState | null {
  return TRANSITIONS[event][current] ?? null
}

export type TransitionResult =
  | { ok: true; state: ThreadState; changed: boolean; thread: Thread }
  | { ok: false; code: 'thread_not_found' }
  | { ok: false; code: 'illegal_transition'; from: ThreadState; state: ThreadState }

export interface ApplyTransitionOptions {
  /**
   * Campos gravados no **mesmo** UPDATE do estado. Existe por causa do follow-up, que troca
   * `accessLevel`/`model`/`reasoningLevel`/`chatMode` junto com a volta para `running`: dois
   * UPDATEs deixariam uma janela com o estado novo e o modelo velho.
   */
  patch?: Omit<UpdateThreadInput, 'state'>
}

/**
 * Único caminho que escreve `threads.state`: valida pelo reducer, grava e **só então** emite
 * `state.change` — nessa ordem, para que quem reagir ao evento e reler a thread já veja o estado
 * novo.
 *
 * Transição ilegal **não escreve e não emite**: devolve `ok: false` com `code:
 * 'illegal_transition'` e o estado atual, para o chamador decidir (a maioria só ignora; o
 * follow-up rejeita o dispatch). Nunca lança — um turno em andamento não pode morrer porque um
 * caminho raro tentou uma transição boba.
 *
 * `changed: false` = transição legal cujo alvo é o estado atual (reabrir gate na mesma thread,
 * clique duplo em Parar): sem UPDATE redundante e sem `state.change` duplicado na timeline.
 */
export function applyTransition(
  threadId: string,
  event: TurnEvent,
  options: ApplyTransitionOptions = {}
): TransitionResult {
  const thread = getThread(threadId)
  if (thread === null) return { ok: false, code: 'thread_not_found' }

  const next = nextThreadState(thread.state, event)
  if (next === null) {
    // Sem payload no log: id + estados são os únicos dados seguros (params de tool carregam segredo).
    console.warn(`[turn-state] transição ilegal ignorada: ${thread.state} --${event}--> ? (thread ${threadId})`)
    return { ok: false, code: 'illegal_transition', from: thread.state, state: thread.state }
  }

  const patch = options.patch ?? {}
  const changed = next !== thread.state
  if (!changed && Object.keys(patch).length === 0) {
    return { ok: true, state: next, changed: false, thread }
  }

  const updated = updateThread(threadId, { ...patch, state: next })
  // Thread apagada entre o SELECT e o UPDATE (delete mid-turn): nada escrito, nada a emitir.
  if (updated === null) return { ok: false, code: 'thread_not_found' }

  if (changed) emit(threadId, { type: 'state.change', threadId, state: next })
  return { ok: true, state: next, changed, thread: updated }
}

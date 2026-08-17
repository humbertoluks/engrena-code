/**
 * Dev-only runtime counters for Sprint 5 memory work.
 * No secrets, command bodies, prompts, or tool params — counts and sizes only.
 * Pure module safe for renderer + main (no Node builtins).
 */

export interface RuntimeMetricsSnapshot {
  historyRefetchStarted: number
  historyRefetchCoalesced: number
  historyRefetchCompleted: number
  historyRefetchAborted: number
  stderrAppendBytesPeak: number
  toolResultTruncations: number
  /** Processos de provider spawnados desde o boot — acumula, nunca é sobrescrito. */
  providerProcessesSpawned: number
  /** Spawnados que ainda não emitiram `close` — gauge de processo vivo (órfão aparece aqui). */
  providerProcessesLive: number
}

const counters: RuntimeMetricsSnapshot = {
  historyRefetchStarted: 0,
  historyRefetchCoalesced: 0,
  historyRefetchCompleted: 0,
  historyRefetchAborted: 0,
  stderrAppendBytesPeak: 0,
  toolResultTruncations: 0,
  providerProcessesSpawned: 0,
  providerProcessesLive: 0,
}

type LooseEnv = { env?: Record<string, string | undefined> }

function readProcessEnv(): Record<string, string | undefined> | undefined {
  const g = globalThis as typeof globalThis & { process?: LooseEnv }
  return g.process?.env
}

function enabled(): boolean {
  const env = readProcessEnv()
  if (env) {
    if (env.ENGRENACODE_RUNTIME_METRICS === '1') return true
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') return true
  }
  // Vite renderer: prefer import.meta when present.
  try {
    const meta = import.meta as ImportMeta & { env?: { DEV?: boolean } }
    if (meta.env?.DEV === true) return true
  } catch {
    // ignore
  }
  return false
}

export function recordHistoryRefetchStarted(): void {
  if (!enabled()) return
  counters.historyRefetchStarted += 1
}

export function recordHistoryRefetchCoalesced(): void {
  if (!enabled()) return
  counters.historyRefetchCoalesced += 1
}

export function recordHistoryRefetchCompleted(): void {
  if (!enabled()) return
  counters.historyRefetchCompleted += 1
}

export function recordHistoryRefetchAborted(): void {
  if (!enabled()) return
  counters.historyRefetchAborted += 1
}

export function recordStderrBufBytes(size: number): void {
  if (!enabled()) return
  if (size > counters.stderrAppendBytesPeak) counters.stderrAppendBytesPeak = size
}

export function recordToolResultTruncation(): void {
  if (!enabled()) return
  counters.toolResultTruncations += 1
}

/**
 * Um processo de provider nasceu (spawn com PID). Conta de verdade: a versão anterior
 * (`recordTurnProcessCount`) *sobrescrevia* o contador com 0|1 a cada turno, então "contagem de
 * processos" na prática respondia só "o último turno tinha PID?" — inútil para achar órfão.
 */
export function recordProviderProcessSpawned(): void {
  if (!enabled()) return
  counters.providerProcessesSpawned += 1
  counters.providerProcessesLive += 1
}

/** O processo spawnado assentou (`close`). `live > 0` com o app ocioso = processo órfão. */
export function recordProviderProcessExited(): void {
  if (!enabled()) return
  if (counters.providerProcessesLive > 0) counters.providerProcessesLive -= 1
}

export function getRuntimeMetricsSnapshot(): RuntimeMetricsSnapshot {
  return { ...counters }
}

/** Test helper — resets counters between specs. */
export function resetRuntimeMetricsForTesting(): void {
  counters.historyRefetchStarted = 0
  counters.historyRefetchCoalesced = 0
  counters.historyRefetchCompleted = 0
  counters.historyRefetchAborted = 0
  counters.stderrAppendBytesPeak = 0
  counters.toolResultTruncations = 0
  counters.providerProcessesSpawned = 0
  counters.providerProcessesLive = 0
}

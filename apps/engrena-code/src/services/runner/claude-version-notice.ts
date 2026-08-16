/**
 * Aviso de versão do Claude CLI fora da faixa validada do contrato de permissão (D3).
 *
 * Regra de ouro: avisar sem bloquear. O gate fail-closed do spawn continua sendo
 * `assertPermissionContract`; aqui não se aborta, não se espera e não se altera nada do turno.
 * O disparo é fire-and-forget e o `emit` acontece quando a leitura terminar, que normalmente é
 * durante o primeiro turno, mas pode ser depois dele sem prejuízo nenhum.
 *
 * "Uma vez por boot" tem dois níveis: a leitura do binário é cacheada em `cli-version.ts` (uma
 * por processo) e a emissão é travada aqui (um aviso por processo), para que turnos concorrentes
 * não empilhem a mesma frase na faixa âmbar.
 */
import { emit } from './ws-hub.js'
import { createLogEntry } from '../db/repositories/log-entries.js'
import { readClaudeCliVersion } from './providers/claude/cli-version.js'
import {
  checkClaudeCliVersion,
  claudeCliVersionLogLine,
  claudeCliVersionWarrantsNotice,
} from './providers/permission-contract.js'

let noticeEmitted = false

/**
 * Dispara a checagem sem devolver promessa: o chamador não tem como esperar por engano.
 * Provider diferente de `claude` sai na hora; o contrato de permissão só existe neste CLI.
 */
export function announceClaudeCliVersionOnce(threadId: string, provider: string): void {
  if (noticeEmitted || provider !== 'claude') return

  void readClaudeCliVersion()
    .then((reading) => {
      // Outro turno pode ter ganhado a corrida enquanto o binário respondia.
      if (noticeEmitted) return
      // Binário que nem executa não merece aviso: o próprio turno falha, e com mensagem melhor.
      if (reading.outcome === 'unavailable') return

      const check = checkClaudeCliVersion(reading.rawOutput)
      if (!claudeCliVersionWarrantsNotice(check.status)) return

      noticeEmitted = true
      createLogEntry({ threadId, kind: 'task', event: claudeCliVersionLogLine(check) })
      emit(threadId, {
        type: 'cli.version_notice',
        threadId,
        code: 'claude_cli_version_out_of_range',
        status: check.status,
        observedVersion: check.observed,
        minValidated: check.minValidated,
        maxValidated: check.maxValidated,
      })
    })
    .catch(() => {
      // Aviso é acessório: falha aqui (log, emit) nunca pode escapar para o turno.
    })
}

export function resetClaudeCliVersionNoticeForTesting(): void {
  noticeEmitted = false
}

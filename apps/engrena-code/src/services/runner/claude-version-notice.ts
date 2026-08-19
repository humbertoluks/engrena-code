/**
 * Registro de versão do Claude CLI fora da faixa validada do contrato de permissão (D3).
 *
 * Regra de ouro: registrar sem bloquear. O gate fail-closed do spawn continua sendo
 * `assertPermissionContract`; aqui não se aborta, não se espera e não se altera nada do turno.
 * O disparo é fire-and-forget e o log é gravado quando a leitura terminar, que normalmente é
 * durante o primeiro turno, mas pode ser depois dele sem prejuízo nenhum.
 *
 * **Não emite nada no WS** (F30). Versão acima da faixa validada não é falha de turno — o spawn não
 * bloqueia — e a tarja âmbar do workspace é lida como erro do que acabou de rodar. O destino de
 * diagnóstico é `log_entries` (Registros / work log) e a caption da row Claude em `#configuracao`,
 * que lê a mesma checagem pelo cache de `readClaudeCliVersion`. Quem só conversa não é interrompido;
 * quem investiga tem os dois lugares certos.
 *
 * "Uma vez por boot" tem dois níveis: a leitura do binário é cacheada em `cli-version.ts` (uma
 * por processo) e a gravação é travada aqui (uma linha por processo), para que turnos concorrentes
 * não empilhem a mesma frase no log.
 */
import { createLogEntry } from '../db/repositories/log-entries.js'
import { readClaudeCliVersion } from './providers/claude/cli-version.js'
import {
  checkClaudeCliVersion,
  claudeCliVersionLogLine,
  claudeCliVersionWarrantsNotice,
} from './providers/permission-contract.js'

let versionLogged = false

/**
 * Dispara a checagem sem devolver promessa: o chamador não tem como esperar por engano.
 * Provider diferente de `claude` sai na hora; o contrato de permissão só existe neste CLI.
 *
 * Efeito colateral útil: é aqui que o cache de `readClaudeCliVersion` esquenta no primeiro turno,
 * e é dele que `peekClaudeCliVersion` serve a Configuração e a negação nativa sem spawn novo.
 */
export function announceClaudeCliVersionOnce(threadId: string, provider: string): void {
  if (versionLogged || provider !== 'claude') return

  void readClaudeCliVersion()
    .then((reading) => {
      // Outro turno pode ter ganhado a corrida enquanto o binário respondia.
      if (versionLogged) return
      // Binário que nem executa não merece aviso: o próprio turno falha, e com mensagem melhor.
      if (reading.outcome === 'unavailable') return

      const check = checkClaudeCliVersion(reading.rawOutput)
      if (!claudeCliVersionWarrantsNotice(check.status)) return

      versionLogged = true
      createLogEntry({ threadId, kind: 'task', event: claudeCliVersionLogLine(check) })
    })
    .catch(() => {
      // Registro é acessório: falha aqui nunca pode escapar para o turno.
    })
}

export function resetClaudeCliVersionNoticeForTesting(): void {
  versionLogged = false
}

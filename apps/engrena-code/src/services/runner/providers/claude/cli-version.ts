/**
 * Leitura da versão do binário `claude`, uma vez por processo.
 *
 * Mora no adaptador do Claude porque o binário é dele: `claude-probe.ts` também roda
 * `claude --version`, mas serve à tela de Configuração ("Testar conexão"), com timeout de 45 s,
 * detecção de assinatura e frases de UI próprias. Reaproveitá-lo aqui obrigaria o probe a devolver
 * stdout e a aceitar um segundo timeout, distorcendo o propósito dele para economizar dez linhas.
 *
 * Nada aqui pode atrasar ou derrubar o turno: a promessa é cacheada (custo pago uma vez por
 * processo, não por turno), a chamada é fire-and-forget do lado do dispatch, e qualquer falha
 * (binário ausente, timeout, saída ilegível) vira `unavailable` em vez de exceção.
 */
import { execFile } from 'child_process'

/** Curto de propósito: ninguém espera por isto, mas um `claude` travado não pode segurar o handle. */
const VERSION_TIMEOUT_MS = 5_000

export type ClaudeCliVersionReading =
  /** O binário respondeu; `rawOutput` pode ser ilegível, quem julga é `checkClaudeCliVersion`. */
  | { outcome: 'answered'; rawOutput: string }
  /** Não executou (ausente, sem permissão, timeout). Não vira aviso: o turno falha sozinho, melhor. */
  | { outcome: 'unavailable' }

type VersionReader = () => Promise<ClaudeCliVersionReading>

const spawnVersionReader: VersionReader = () =>
  new Promise<ClaudeCliVersionReading>((resolve) => {
    try {
      execFile(
        'claude',
        ['--version'],
        { timeout: VERSION_TIMEOUT_MS, windowsHide: true },
        (err, stdout, stderr) => {
          if (err) {
            resolve({ outcome: 'unavailable' })
            return
          }
          // Alguns builds mandam a versão no stderr; stdout continua sendo o caminho normal.
          const out = typeof stdout === 'string' ? stdout : ''
          const errOut = typeof stderr === 'string' ? stderr : ''
          resolve({ outcome: 'answered', rawOutput: out.trim() !== '' ? out : errOut })
        }
      )
    } catch {
      // `execFile` pode lançar de forma síncrona (ex.: env inválido) antes do callback existir.
      resolve({ outcome: 'unavailable' })
    }
  })

let readerImpl: VersionReader = spawnVersionReader
let pending: Promise<ClaudeCliVersionReading> | null = null

/** Cacheada por processo: o segundo turno reusa a promessa, sem spawn novo. */
export function readClaudeCliVersion(): Promise<ClaudeCliVersionReading> {
  pending ??= readerImpl().catch<ClaudeCliVersionReading>(() => ({ outcome: 'unavailable' }))
  return pending
}

export function setClaudeCliVersionReaderForTesting(fn: VersionReader): void {
  readerImpl = fn
  pending = null
}

export function resetClaudeCliVersionReaderForTesting(): void {
  readerImpl = spawnVersionReader
  pending = null
}

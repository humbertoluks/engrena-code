/**
 * Relógio do card de permissão.
 *
 * O EngrenaCode responde ao `PreToolUse` de um CLI que ele mesmo spawnou: o hook fica pendurado
 * esperando a resposta do broker, então o gate **precisa** ter teto — `PERMISSION_TIMEOUT_MS`,
 * fail-closed. Claude Code e Cursor esperam o humano sem relógio porque lá quem espera é a própria
 * TUI, que não tem processo preso do outro lado.
 *
 * O teto não é número escolhido aqui: F32 o derivou de `HOOK_COMMAND_TIMEOUT_SEC` menos margem (8
 * min hoje). Este módulo nunca repete o valor — lê `expiresAt`, que o gate calculou.
 *
 * Se o teto existe, ele tem que ser visível: o usuário que sai para pensar no comando merece saber
 * que a janela fecha. O que ele não merece é a explicação disso na cara — daí só o relógio, sem
 * barra de progresso, sem "expira em", sem pulse.
 *
 * Puro de propósito: `now` entra como argumento para o teste não depender de timer nem de fake
 * clock, e o componente é quem decide a cadência do tick.
 */

/** Abaixo disto o relógio vira amber. Último aviso, não alarme: o card continua igual. */
export const PERMISSION_COUNTDOWN_WARN_MS = 15_000

/** Cadência do tick no componente. Segundo cheio: nada aqui justifica repintar mais que isso. */
export const PERMISSION_COUNTDOWN_TICK_MS = 1_000

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/**
 * `mm:ss` restantes, ou `null` quando o gate não tem prazo (`expiresAt` nulo — é o caso das
 * perguntas do `ask_user_question`, que esperam o usuário sem teto).
 *
 * Prazo vencido devolve `00:00` em vez de `null`: quem fecha o card é o estado do gate, não este
 * cálculo, e um relógio que some no instante zero deixaria o card na tela sem explicar nada. O
 * relógio local pode estar alguns segundos fora do relógio do main; a diferença aparece como o
 * `00:00` durando um pouco, nunca como card que some sozinho.
 */
export function remainingLabel(expiresAt: number | null, now: number): string | null {
  if (expiresAt === null || !Number.isFinite(expiresAt)) return null
  const remainingMs = Math.max(0, expiresAt - now)
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${pad(minutes)}:${pad(seconds)}`
}

/** `true` nos últimos 15 s (e depois deles). Sem prazo nunca alarma. */
export function isCountdownWarning(expiresAt: number | null, now: number): boolean {
  if (expiresAt === null || !Number.isFinite(expiresAt)) return false
  return expiresAt - now <= PERMISSION_COUNTDOWN_WARN_MS
}

/**
 * Adaptador do Claude Code CLI — ponto único onde o driver pergunta "isto é Claude?".
 *
 * `runCliTurn` spawna três binários (claude/codex/kimi) com o mesmo loop e o mesmo núcleo de
 * argumentos. O que só o Claude entende (o `--resume` headless, o vocabulário de
 * `--permission-mode`, o par `--settings`/`--include-hook-events` do PermissionBroker) mora aqui,
 * para que uma mudança neste arquivo não atinja Codex/Kimi por acidente e vice-versa.
 */
import type { ThreadAccessLevel } from '../../../db/repositories/threads.js'
import type { ProviderTurnInput } from '../provider-types.js'
import { permissionBrokerApplies } from '../../permission-policy.js'
import {
  INCLUDE_HOOK_EVENTS_FLAG,
  shouldIncludeHookEvents,
  SUPERVISED_PERMISSION_MODE,
} from '../permission-contract.js'
import { mountPermissionSettings, type MountedPermissionSettings } from './permission-settings.js'

export { buildPermissionHookCommand } from './permission-settings.js'
export {
  resetPermissionSettingsBuilderForTesting,
  setPermissionSettingsBuilderForTesting,
} from './permission-settings.js'
export type { MountedPermissionSettings } from './permission-settings.js'

/**
 * Claude headless: `--resume <session_id>` continua a conversa no disco (~/.claude/projects/…).
 * Codex/Kimi não usam este flag neste driver — só Claude reporta `session_id` no stream-json.
 */
export function claudeResumeArgs(input: ProviderTurnInput): string[] {
  if (input.provider !== 'claude' || !input.resumeSessionId) return []
  return ['--resume', input.resumeSessionId]
}

/**
 * `supervised` sem hook confirmado ao vivo (claude-code 2.1.226): `'manual'`/`'dontAsk'` negam
 * toda tool com `decision_reason_type: "mode"` **antes** de qualquer `PreToolUse` hook rodar — o
 * hook chega a disparar, mas o veredito de modo já decidiu, `permissionDecision: "allow"` do hook
 * é ignorado. `'auto'` é a única combinação onde o hook (`--settings`, ver
 * `permission-settings.ts`) tem autoridade real de allow/deny — sem `'auto'`, o hook vira
 * decoração. `'default'` (valor antigo) nem é choice válido nesta versão do CLI.
 *
 * Com hook anexado, `auto-accept-edits` também vai de `'auto'`: sob `'acceptEdits'` o CLI nega
 * Bash/MCP nativamente sem consultar ninguém, e o usuário não tem como aprovar (nem no modal nem
 * por texto). A semântica do nível (edição livre, resto pergunta) passa a vir do broker
 * (`permission-policy.ts`).
 *
 * O vocabulário é do Claude CLI. O driver aplica o mesmo valor a Codex/Kimi pela mesma
 * simplificação já assumida em `buildArgs` (os três binários compartilham o shape de argumentos);
 * quando um deles ganhar modos próprios, é aqui que a divergência aparece.
 */
export function permissionModeFlag(accessLevel: ThreadAccessLevel, hasPermissionHook: boolean): string {
  if (accessLevel === 'full-access') return 'bypassPermissions'
  if (hasPermissionHook) return SUPERVISED_PERMISSION_MODE
  if (accessLevel === 'auto-accept-edits') return 'acceptEdits'
  // supervised sem hook disponível (provider sem suporte, broker não montado): sem gate real
  // possível, mas falha fechado — nunca vira 'auto' (permissivo) por omissão.
  return 'manual'
}

/** Flags que anexam o broker ao spawn; vazio quando o turno roda sem `--settings`. */
export function permissionSettingsArgs(permissionSettingsPath: string | undefined): string[] {
  if (!permissionSettingsPath) return []
  const args = ['--settings', permissionSettingsPath]
  // Visibilidade do lifecycle PreToolUse + permission_denied no stream (Sprint 1).
  if (shouldIncludeHookEvents(true)) args.push(INCLUDE_HOOK_EVENTS_FLAG)
  return args
}

/**
 * Monta o PermissionBroker quando o turno é do Claude, o nível pede gate (`permission-policy.ts`)
 * e o dispatch entregou porta/token. `undefined` significa spawn sem `--settings`: nesse caso
 * `assertPermissionContract` não tem contrato a cobrar.
 */
export function setupPermissionBroker(input: ProviderTurnInput): MountedPermissionSettings | undefined {
  if (input.provider !== 'claude') return undefined
  if (!permissionBrokerApplies(input.accessLevel)) return undefined
  if (input.permissionPort === undefined || !input.permissionToken) return undefined
  return mountPermissionSettings(input.permissionPort, input.permissionToken)
}

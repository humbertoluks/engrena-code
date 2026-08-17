/**
 * `--settings` com hook `PreToolUse` (spec `PermissionBroker`) — pra Claude em qualquer nível
 * exceto `full-access`: aprovação interativa via stdin não existe no spawn headless (`-p`), então
 * o hook (`permission-hook.ts`) segura cada tool call até a UI decidir, via `POST /permission` no
 * `permission-broker.ts` do dispatch. Quanto o nível auto-aprova sem UI é decisão de
 * `permission-policy.ts`, não do modo do CLI.
 */
import { writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { HOOK_COMMAND_TIMEOUT_SEC, type PermissionSettingsShape } from '../permission-contract.js'
import { resolveTurnArtifactsDir } from '../turn-artifacts.js'
import { ensurePermissionHookLauncher } from './permission-hook.js'

/**
 * Comando do hook PreToolUse. O CLI Claude pode spawnar o hook sem herdar
 * `ELECTRON_RUN_AS_NODE` do processo pai — sem a var, `process.execPath` (binário Electron)
 * abre UI em vez de interpretar o `.mjs`, o broker nunca recebe o POST e a tool cai em deny
 * sem modal. A var vai no próprio comando; o env do spawn do Claude continua como rede de segurança.
 */
/**
 * Comando do hook. No Windows o launcher é um `.cmd` (stdin preservado); no Unix prefixamos
 * ELECTRON_RUN_AS_NODE no próprio comando. `cmd /c set VAR=1&& electron …` engolia o JSON do
 * stdin em alguns hosts — o broker recebia `{}` e o modal virava tool "unknown".
 */
export function buildPermissionHookCommand(launcherPath: string, port: number, token: string): string {
  const args = `--port ${port} --token ${token}`
  if (process.platform === 'win32') {
    return `${JSON.stringify(launcherPath)} ${args}`
  }
  const exe = JSON.stringify(process.execPath)
  const script = JSON.stringify(launcherPath)
  return `ELECTRON_RUN_AS_NODE=1 ${exe} ${script} ${args}`
}

/**
 * Objeto de `--settings`, montado antes de virar arquivo para que `assertPermissionContract`
 * possa validá-lo sem reler o disco.
 *
 * `--settings` exige hooks aninhados sob "hooks". PermissionRequest é o gate real do
 * "haven't granted it yet" em headless — PreToolUse sozinho não basta (smoke Haiku 2026-08-12).
 */
function buildPermissionSettings(port: number, token: string): PermissionSettingsShape {
  const launcherPath = ensurePermissionHookLauncher()
  const command = buildPermissionHookCommand(launcherPath, port, token)
  const hookEntry = {
    matcher: '*',
    hooks: [{ type: 'command' as const, command, timeout: HOOK_COMMAND_TIMEOUT_SEC }],
  }
  return {
    hooks: {
      PreToolUse: [hookEntry],
      PermissionRequest: [hookEntry],
    },
  }
}

/**
 * Injetável só para teste: o gate de contrato só prova alguma coisa se o teste conseguir
 * entregar um settings fora do contrato. Retorna `unknown` de propósito — é a validação,
 * não o tipo, que garante o shape gravado.
 */
type PermissionSettingsBuilder = (port: number, token: string) => unknown
let permissionSettingsBuilder: PermissionSettingsBuilder = buildPermissionSettings
export function setPermissionSettingsBuilderForTesting(fn: PermissionSettingsBuilder): void {
  permissionSettingsBuilder = fn
}
export function resetPermissionSettingsBuilderForTesting(): void {
  permissionSettingsBuilder = buildPermissionSettings
}

function writePermissionSettingsFile(settings: unknown): string {
  const path = join(resolveTurnArtifactsDir(), `engrenacode-permission-settings-${randomUUID()}.json`)
  writeFileSync(path, JSON.stringify(settings), { mode: 0o600 })
  return path
}

/** O settings do turno e o arquivo que virou `--settings`; o gate valida o objeto sem reler o disco. */
export interface MountedPermissionSettings {
  settings: unknown
  path: string
}

/** Monta o par settings/arquivo do broker para este turno. */
export function mountPermissionSettings(port: number, token: string): MountedPermissionSettings | undefined {
  const settings = permissionSettingsBuilder(port, token)
  if (settings === undefined) return undefined
  return { settings, path: writePermissionSettingsFile(settings) }
}

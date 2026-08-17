import { mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

/** Mesmo contrato de vault/worktrees/db: override de teste, senão Electron userData. */
function resolveUserData(): string {
  const override = process.env.ENGRENACODE_USER_DATA
  if (override) {
    mkdirSync(override, { recursive: true })
    return override
  }
  return app.getPath('userData')
}

/**
 * Artefatos efêmeros do turno (mcp-config, imagens, settings do broker) — fora de os.tmpdir().
 * Compartilhado entre o driver e o adaptador do Claude: os três temporários nascem no mesmo
 * diretório e são apagados no mesmo ponto de limpeza do turno.
 */
export function resolveTurnArtifactsDir(): string {
  const dir = join(resolveUserData(), 'tmp')
  mkdirSync(dir, { recursive: true })
  return dir
}

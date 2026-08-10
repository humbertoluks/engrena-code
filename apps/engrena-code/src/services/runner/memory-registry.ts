// Fachada de leitura para o dispatch (F20 spec §3.2/§4) — mesmo papel de RuleRegistry no ciclo de turno.
import { getProject } from '../db/repositories/projects.js'
import { readJournal } from '../vault/memory-service.js'
import { createLogEntry } from '../db/repositories/log-entries.js'
import { composeMemoryBlock } from './memory-block.js'

export const MemoryRegistry = {
  isEnabledForProject(projectId: string): boolean {
    return getProject(projectId)?.memoryEnabled ?? false
  },

  /**
   * Journal corrompido é logado aqui (não em memory-service.ts) porque só o chamador do turno
   * (dispatch.ts) tem o `threadId` exigido pela FK de log_entries — a leitura em si (readJournal)
   * é pura, sem efeito colateral.
   */
  composeBlockForTurn(projectId: string, threadId: string): string {
    if (!this.isEnabledForProject(projectId)) return ''

    const { content, corrupted } = readJournal(projectId)
    if (corrupted) {
      createLogEntry({
        threadId,
        kind: 'task',
        event: 'memory: journal corrompido, tratado como vazio',
      })
      return ''
    }
    if (content === '') return ''

    return composeMemoryBlock(content)
  },
}

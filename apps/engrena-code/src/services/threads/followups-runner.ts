import type { Project } from '../db/repositories/projects.js'
import type { Thread } from '../db/repositories/threads.js'
import { resolveProviderApiKey } from '../runner/provider-resolution.js'
import { resolveThreadCwd } from '../runner/thread-cwd.js'
import { generateFollowups } from './followups.js'
import { resolveFollowups } from './followups-cache.js'

/**
 * Ponto único de geração das sugestões: o fim do turno chama para adiantar (fire-and-forget) e o
 * handler HTTP chama para entregar. O cache por mensagem garante um processo só.
 */
export function primeFollowupsForTurn(input: {
  thread: Thread
  project: Project
  messageId: string
  lastUserMessage: string
  lastAssistantMessage: string
}): Promise<string[]> {
  const { thread, project, messageId, lastUserMessage, lastAssistantMessage } = input
  return resolveFollowups(thread.id, messageId, () =>
    generateFollowups({
      provider: thread.provider,
      model: thread.model,
      apiKey: resolveProviderApiKey(thread.provider),
      cwd: resolveThreadCwd(thread, project),
      lastUserMessage,
      lastAssistantMessage,
    })
  )
}

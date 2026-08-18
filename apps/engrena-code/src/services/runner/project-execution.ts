export type LeaseOwnerType = 'agent' | 'git'

export interface LeaseInfo {
  projectId: string
  ownerType: LeaseOwnerType
  operation: string
  ownerThreadId: string | null
  startedAt: number
}

export class LeaseBusyError extends Error {
  code = 'thread_busy' as const
  info: LeaseInfo

  constructor(info: LeaseInfo) {
    // Sem o id do projeto e com acento: esta mensagem é lida pelo usuário no composer (o 409 leva
    // o `info` completo em `details` para diagnóstico). Mesma frase da recusa por thread ocupada
    // em `dispatch.ts`, porque para quem lê é a mesma situação.
    super('Este projeto já tem uma execução em andamento; aguarde ou pare o turno atual.')
    this.info = info
  }
}

const leases = new Map<string, LeaseInfo>()

/** Lease in-memory (não persistida): 1 execução longa por projeto, cobre dispatch/follow-up/accept/git mutável. */
export function acquireLease(
  projectId: string,
  ownerType: LeaseOwnerType,
  operation: string,
  ownerThreadId: string | null
): LeaseInfo {
  const existing = leases.get(projectId)
  if (existing) throw new LeaseBusyError(existing)

  const info: LeaseInfo = { projectId, ownerType, operation, ownerThreadId, startedAt: Date.now() }
  leases.set(projectId, info)
  return info
}

export function releaseLease(projectId: string): void {
  leases.delete(projectId)
}

export function getLease(projectId: string): LeaseInfo | null {
  return leases.get(projectId) ?? null
}

export function isLeased(projectId: string): boolean {
  return leases.has(projectId)
}

/** Apenas para testes: reseta o estado in-memory entre specs. */
export function clearAllLeases(): void {
  leases.clear()
}

import { vaultService } from './vault-service'

interface SessionRequest {
  headers: Record<string, string>
}

interface SessionResponse {
  status: number
  json: () => Promise<unknown>
}

const SESSION_HEADER = 'x-engrenacode-session'

export function sessionMiddleware(
  req: SessionRequest,
  res: SessionResponse,
  next: () => void
) {
  const sessionToken = req.headers[SESSION_HEADER]

  if (!sessionToken) {
    res.status = 401
    res.json = async () => ({
      error: {
        code: 'unauthorized',
        message: 'Sessão inválida ou ausente.'
      }
    })
    return
  }

  const validToken = vaultService.getSessionToken()
  if (sessionToken !== validToken) {
    res.status = 401
    res.json = async () => ({
      error: {
        code: 'unauthorized',
        message: 'Sessão expirada ou inválida.'
      }
    })
    return
  }

  next()
}

export function vaultGuard(_req: SessionRequest, res: SessionResponse, next: () => void) {
  if (vaultService.isLocked()) {
    res.status = 423
    res.json = async () => ({
      error: {
        code: 'vault_locked',
        message: 'Cofre local travado. Desbloqueie antes de continuar.'
      }
    })
    return
  }

  next()
}

export function isPublicRoute(_pathname: string): boolean {
  const publicRoutes = ['/api/vault/unlock', '/health', '/']
  return publicRoutes.some((route) => _pathname === route || _pathname.startsWith(route + '/'))
}

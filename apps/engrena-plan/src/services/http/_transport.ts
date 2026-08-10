/**
 * Plan HTTP transport shim — binds @engrena/http-core to the app vault singleton.
 * Session header is Plan-specific (SP-08 isolation from Code).
 */
import {
  createGuard,
  sendJson,
  sendError,
  readBody,
  parseBody,
  sendTransportError,
  MAX_BODY_BYTES,
  PayloadTooLargeError,
} from '@engrena/http-core'
import { vaultService } from '../vault/vault-service.js'

export const SESSION_HEADER = 'x-engrenaplan-session'

export const guard = createGuard(
  {
    isLocked: () => vaultService.isLocked(),
    getSessionToken: () => vaultService.getSessionToken(),
  },
  { sessionHeader: SESSION_HEADER },
)

export {
  sendJson,
  sendError,
  readBody,
  parseBody,
  sendTransportError,
  MAX_BODY_BYTES,
  PayloadTooLargeError,
}

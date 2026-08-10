/**
 * Code HTTP transport shim — binds @engrena/http-core to the app vault singleton.
 * Handlers keep importing from `./_transport.js` (stable path).
 */
import {
  createGuard,
  DEFAULT_SESSION_HEADER,
  sendJson,
  sendError,
  readBody,
  parseBody,
  sendTransportError,
  MAX_BODY_BYTES,
  PayloadTooLargeError,
} from '@engrena/http-core'
import { vaultService } from '../vault/vault-service.js'

export const SESSION_HEADER = DEFAULT_SESSION_HEADER

export const guard = createGuard(
  {
    isLocked: () => vaultService.isLocked(),
    getSessionToken: () => vaultService.getSessionToken(),
  },
  { sessionHeader: SESSION_HEADER }
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

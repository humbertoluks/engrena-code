export {
  DEFAULT_SESSION_HEADER,
  DEFAULT_SESSION_SUBPROTOCOL_PREFIX,
  extractSessionTokenFromSubprotocol,
} from './session.js'

export {
  sendJson,
  sendError,
  readBody,
  parseBody,
  sendTransportError,
  MAX_BODY_BYTES,
  PayloadTooLargeError,
  createGuard,
  type SessionAuth,
  type GuardOptions,
} from './transport.js'

export { isAllowedLoopbackOrigin, applyCors, type ApplyCorsOptions } from './cors.js'

export {
  createLoopbackServer,
  type CreateLoopbackServerOptions,
  type LoopbackRequestHandler,
  type LoopbackUpgradeHandler,
} from './create-loopback-server.js'

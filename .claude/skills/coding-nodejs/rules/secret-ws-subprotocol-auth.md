---
title: Authenticate WebSocket upgrades via subprotocol, not query string
impact: CRITICAL
impactDescription: ?token= leaks in logs, proxies, and history
tags: secret, websocket, auth
---

## Authenticate WebSocket upgrades via subprotocol, not query string

Upgrade WS: cofre travado → locked antes de token inválido → unauthorized. Autentique via subprotocol; **não** aceite `?token=` na query.

**Incorrect:**

```typescript
const token = url.searchParams.get('token') ?? subprotocolToken(req)
```

**Correct:**

```typescript
const token = subprotocolToken(req) // only
if (!token) {
  socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
  socket.destroy()
}
```

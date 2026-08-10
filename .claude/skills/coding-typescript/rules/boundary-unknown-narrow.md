---
title: Treat every I/O boundary as unknown and narrow it
impact: CRITICAL
impactDescription: trusted casts on HTTP/IPC/file/provider payloads hide runtime shape bugs
tags: boundary, narrowing, unknown
---

## Treat every I/O boundary as unknown and narrow it

Toda fronteira recebe `unknown` e estreita — não recebe o tipo desejado por fé. Fronteira = body HTTP, argumento de IPC, leitura de arquivo, resposta de provider externo, payload de WS/`postMessage`.

**Incorrect:**

```typescript
const data = JSON.parse(text) as UserDto
```

**Correct:**

```typescript
const data: unknown = JSON.parse(text)
if (!isUserDto(data)) throw new Error('invalid_user')
```

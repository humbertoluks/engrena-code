---
title: Restrict IPC to native capabilities; domain CRUD stays on HTTP
impact: HIGH
impactDescription: expanding IPC into product CRUD bypasses HTTP guards
tags: ipc, architecture, http
---

## Restrict IPC to native capabilities; domain CRUD stays on HTTP

IPC é só capacidade nativa (sessão do vault, dialog, shell, PTY). CRUD de domínio, keys, git de produto e dispatch ficam no HTTP loopback. PTY pode resolver `cwd` via projects/threads — isso não autoriza expandir IPC para catálogo/credencial.

**Incorrect:**

```typescript
ipcMain.handle('app:skills:list', () => listSkills())
```

**Correct:**

```typescript
ipcMain.handle('app:dialog:open-folder', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return r.filePaths[0] ?? null
})
// skills CRUD → HTTP handler with vault guard
```

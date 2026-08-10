---
title: Keep turn artifacts under app userData, not the project tree
impact: HIGH
impactDescription: temp worktrees and attachments pollute the user's repo
tags: fs, userdata, artifacts
---

## Keep turn artifacts under app userData, not the project tree

Artefato de turno (anexo, worktree temporário, config MCP efêmera) sempre sob o `userData` do app. Nunca em `project.path` fora do fluxo de Accept explícito no working tree.

**Incorrect:**

```typescript
const tmp = join(projectPath, '.agent-tmp', id)
```

**Correct:**

```typescript
const tmp = join(app.getPath('userData'), 'tmp', id)
```

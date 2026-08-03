# Data delta: 001-mvp-nucleo-operacional

## Novas entidades (conceitual)
- vault metadata (não segredos em claro)
- projects (path local, timestamps)
- threads (provider, model, access level, execution mode, status)
- thread_messages / tool_events (histórico)
- file_diffs (pending|accepted|rejected)
- skills + project_skill_links
- rules + project_rule_overrides
- subagents + project_subagent_links + ephemeral runs
- config flags: claude subscription status, CLI paths/status, global prompt, github token present (token no vault)

## Removidos
- n/a (greenfield lógico)

## Migrações
- Schema inicial SQLite local pós-unlock
- Segredos exclusivamente no cofre

## Fora deste MVP
- log_entries (F08), mcp servers (F09), api keys extras (F10), usage_events (F11)

---
Gerado por reversa-plan em 2026-07-31T10:55:00Z

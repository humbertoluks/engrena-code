# Business Rules (no banco) — lioncode.db

> Fonte: DDL live + triggers. Confianca: 🟢 (CHECK/trigger) | 🟡 (inferido de naming/seed)

## Triggers

Padrao unico: bump de `updated_at` em UPDATE quando o valor nao mudou (evita overwrite explicito).

| Nome | Tabela | Evento | Condicao | Acao |
| ---- | ------ | ------ | -------- | ---- |
| `trg_commands_updated_at` | `commands` | AFTER UPDATE | `NEW.updated_at = OLD.updated_at` | `UPDATE ... SET updated_at = datetime('now')` |
| `trg_mcps_updated_at` | `mcps` | AFTER UPDATE | `NEW.updated_at = OLD.updated_at` | `UPDATE ... SET updated_at = datetime('now')` |
| `trg_model_pricing_updated_at` | `model_pricing` | AFTER UPDATE | `NEW.updated_at = OLD.updated_at` | `UPDATE ... SET updated_at = datetime('now')` |
| `trg_projects_updated_at` | `projects` | AFTER UPDATE | `NEW.updated_at = OLD.updated_at` | `UPDATE ... SET updated_at = datetime('now')` |
| `trg_rules_updated_at` | `rules` | AFTER UPDATE | `NEW.updated_at = OLD.updated_at` | `UPDATE ... SET updated_at = datetime('now')` |
| `trg_skills_updated_at` | `skills` | AFTER UPDATE | `NEW.updated_at = OLD.updated_at` | `UPDATE ... SET updated_at = datetime('now')` |
| `trg_subagents_updated_at` | `subagents` | AFTER UPDATE | `NEW.updated_at = OLD.updated_at` | `UPDATE ... SET updated_at = datetime('now')` |
| `trg_threads_updated_at` | `threads` | AFTER UPDATE | `NEW.updated_at = OLD.updated_at` | `UPDATE ... SET updated_at = datetime('now')` |

### DDL dos triggers

#### `trg_commands_updated_at`

```sql
CREATE TRIGGER trg_commands_updated_at
        AFTER UPDATE ON commands
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at
        BEGIN
          UPDATE commands SET updated_at = datetime('now') WHERE id = OLD.id;
        END
```

#### `trg_mcps_updated_at`

```sql
CREATE TRIGGER trg_mcps_updated_at
        AFTER UPDATE ON mcps
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at
        BEGIN
          UPDATE mcps SET updated_at = datetime('now') WHERE id = OLD.id;
        END
```

#### `trg_model_pricing_updated_at`

```sql
CREATE TRIGGER trg_model_pricing_updated_at
      AFTER UPDATE ON model_pricing
      FOR EACH ROW
      WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE model_pricing SET updated_at = datetime('now') WHERE id = OLD.id;
      END
```

#### `trg_projects_updated_at`

```sql
CREATE TRIGGER trg_projects_updated_at
      AFTER UPDATE ON projects
      FOR EACH ROW
      WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE projects SET updated_at = datetime('now') WHERE id = OLD.id;
      END
```

#### `trg_rules_updated_at`

```sql
CREATE TRIGGER trg_rules_updated_at
        AFTER UPDATE ON rules
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at
        BEGIN
          UPDATE rules SET updated_at = datetime('now') WHERE id = OLD.id;
        END
```

#### `trg_skills_updated_at`

```sql
CREATE TRIGGER trg_skills_updated_at
        AFTER UPDATE ON skills
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at
        BEGIN
          UPDATE skills SET updated_at = datetime('now') WHERE id = OLD.id;
        END
```

#### `trg_subagents_updated_at`

```sql
CREATE TRIGGER trg_subagents_updated_at
      AFTER UPDATE ON subagents
      FOR EACH ROW
      WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE subagents SET updated_at = datetime('now') WHERE id = OLD.id;
      END
```

#### `trg_threads_updated_at`

```sql
CREATE TRIGGER trg_threads_updated_at
      AFTER UPDATE ON threads
      FOR EACH ROW
      WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE threads SET updated_at = datetime('now') WHERE id = OLD.id;
      END
```

## CHECK constraints

### `codegraph_runs`

```sql
CHECK (kind IN ('build','reindex','update','repair'))
```

```sql
CHECK (status IN ('running','done','error','cancelled'))
```

### `diffs`

```sql
CHECK (status IN ('pending','accepted','rejected'))
```

### `log_entries`

```sql
CHECK (kind IN ('task','tool','git'))
```

### `mcps`

```sql
CHECK (transport IN ('stdio','http','sse'))
```

### `messages`

```sql
CHECK (role IN ('user','assistant','system'))
```

```sql
CHECK (status IN ('complete','interrompido'))
```

### `projects`

```sql
CHECK (codegraph_status IN ('absent','building','ready','stale','error'))
```

### `skills`

```sql
CHECK ("trigger" IN ('auto','command'))
```

### `threads`

```sql
CHECK (state IN ('idle','running','awaiting-review','committed','pr-open','pr-merged','pr-closed','error'))
```

```sql
CHECK (mode_chat_plan IN ('chat','plan'))
```

### `tool_calls`

```sql
CHECK (status IN ('done','interrompido'))
```

### `usage_events`

```sql
CHECK (source IN ('agent','subagent'))
```

## Uniques e identidade de negocio

| Tabela | Constraint / Index UNIQUE | Significado |
| ------ | ------------------------- | ----------- |
| `commands` | `sqlite_autoindex_commands_2` (name) | Nome de catalogo globalmente unico. |
| `feature_builds` | `idx_feature_builds_project_slug_active` (project_id, slug) | Slug de feature build unico por projeto (active). |
| `feature_pipelines` | `idx_feature_pipelines_thread_active` (thread_id) | Uma baseline de review por thread. |
| `git_review_baselines` | `sqlite_autoindex_git_review_baselines_2` (thread_id) | Uma baseline de review por thread. |
| `mcps` | `sqlite_autoindex_mcps_2` (name) | Nome de catalogo globalmente unico. |
| `messages` | `idx_messages_thread_seq` (thread_id, seq) | Sequencia de mensagem unica por thread. |
| `model_pricing` | `sqlite_autoindex_model_pricing_2` (provider, model) | Par provider+model unico no catalogo de precos. |
| `projects` | `sqlite_autoindex_projects_2` (path) | Um path de projeto so pode existir uma vez. |
| `rules` | `sqlite_autoindex_rules_2` (name) | Nome de catalogo globalmente unico. |
| `skills` | `sqlite_autoindex_skills_2` (name) | Nome de catalogo globalmente unico. |
| `subagents` | `sqlite_autoindex_subagents_2` (name) | Nome de catalogo globalmente unico. |

## Cascades (integridade referencial)

Todas as FKs declaradas usam `ON DELETE CASCADE` e `ON UPDATE NO ACTION`. Apagar um `projects` remove threads, bindings de catalogo, usage, pipelines e builds ligados. Apagar um `threads` remove messages, tool_calls, diffs, logs, baselines, snapshots e runs filhos.

## Seeds e marcadores

- `data_seeds`: garante aplicacao idempotente de seeds de catalogo (skills/rules/subagents/etc.).
- `schema_migrations`: controla versao do schema; nao deve ser editado manualmente.
- Catalogos (`skills`, `rules`, `subagents`, `commands`, `model_pricing`) carregam dados de bootstrap via migrations/seeds.

## Views / materialized views

_Nenhuma view no snapshot live._

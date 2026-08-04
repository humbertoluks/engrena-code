# Data Dictionary — sistema-legado.db

> Fonte: DDL live `c:\Users\Me\AppData\Roaming\@sistema-legado\shell\sistema-legado.db` (somente leitura). Confianca: 🟢
> DDL autoritativo tambem em `packages/server/src/db/migrations/`.

## Metadata

| Campo | Valor |
| ----- | ----- |
| Engine | SQLite (better-sqlite3) |
| Nome logico | `sistema-legado.db` |
| Path snapshot | `c:\Users\Me\AppData\Roaming\@sistema-legado\shell\sistema-legado.db` |
| Tamanho logico | 1016.0 KiB (1,040,384 bytes) |
| page_count × page_size | 254 × 4096 |
| Tabelas | 31 |
| Views | 0 |
| Triggers | 8 |
| Colunas (total) | 333 |
| Foreign keys | 28 |
| Indexes (incl. autoindexes) | 30 |
| Row count (snapshot) | 154 |
| Document date | 2026-07-29 |

## Inventario por dominio

| Dominio | Tabela | Colunas | Rows | Proposito |
| ------- | ------ | ------: | ---: | --------- |
| App & meta | `app_config` | 3 | 0 | Configuracao chave-valor da aplicacao persistida localmente. |
| Git & codegraph | `codegraph_runs` | 9 | 0 | Historico de runs de indexacao/build/repair do codegraph por projeto. |
| Agents & tools catalog | `commands` | 18 | 3 | Templates de comandos/prompts reutilizaveis (workflows estilo slash). |
| App & meta | `data_seeds` | 2 | 5 | Marcadores idempotentes de seeds (catalogo/bootstrap aplicado uma vez). |
| Core / workspace | `diffs` | 15 | 0 | Snapshots de diff/git associados a threads ou reviews. |
| Feature pipeline & build | `feature_build_rounds` | 10 | 0 | Rounds individuais dentro de um sprint de feature-build. |
| Feature pipeline & build | `feature_build_sprints` | 11 | 0 | Containers de sprint dentro de uma execucao de feature build. |
| Feature pipeline & build | `feature_builds` | 16 | 0 | Execucoes top-level de feature build (loops validator/coding). |
| Feature pipeline & build | `feature_pipeline_phases` | 8 | 0 | Fases ordenadas pertencentes a um round de pipeline. |
| Feature pipeline & build | `feature_pipeline_rounds` | 11 | 0 | Rounds de uma execucao multiagente de feature pipeline. |
| Feature pipeline & build | `feature_pipelines` | 12 | 0 | Cabecalhos de run de feature pipeline (spec -> orquestracao de build). |
| Git & codegraph | `git_review_baselines` | 11 | 0 | Refs git usadas como baseline de review/diff por thread/projeto. |
| Core / workspace | `log_entries` | 5 | 0 | Linhas de log estruturado anexadas a threads ou eventos de sistema. |
| Agents & tools catalog | `mcps` | 17 | 0 | Catalogo de servidores MCP (metadados de conexao/config). |
| Core / workspace | `messages` | 9 | 0 | Mensagens de chat de uma thread (user/assistant/tool). |
| Models & usage | `model_pricing` | 11 | 15 | Catalogo de precos provider/model para estimativa de custo. |
| Agents & tools catalog | `project_mcps` | 5 | 0 | Junção N:M — quais MCPs estao habilitados para um projeto. |
| Agents & tools catalog | `project_rules` | 5 | 0 | Junção N:M — quais rules estao vinculadas a um projeto. |
| Agents & tools catalog | `project_skills` | 5 | 0 | Junção N:M — quais skills estao vinculadas a um projeto. |
| Agents & tools catalog | `project_subagents` | 5 | 0 | Junção N:M — quais subagents estao vinculados a um projeto. |
| Core / workspace | `projects` | 10 | 0 | Projetos/workspaces (path raiz, settings, identidade). |
| Agents & tools catalog | `quick_actions` | 6 | 0 | Definicoes de quick-actions da UI (prompts/atalhos). |
| Agents & tools catalog | `rules` | 9 | 6 | Documentos de rules persistentes aplicados ao contexto do agente. |
| App & meta | `schema_migrations` | 3 | 62 | Versoes de migration aplicadas pelo migrator do server. |
| Agents & tools catalog | `skills` | 10 | 29 | Catalogo de skills (instrucoes/bundles de tools). |
| Agents & tools catalog | `subagent_runs` | 21 | 0 | Registros runtime de invocacoes de subagent. |
| Agents & tools catalog | `subagents` | 17 | 34 | Catalogo de subagents (papel, tools, preferencias de model). |
| Models & usage | `thread_context_window_snapshots` | 11 | 0 | Snapshots de uso de context-window por thread. |
| Core / workspace | `threads` | 23 | 0 | Threads de conversa escopadas a um projeto. |
| Core / workspace | `tool_calls` | 9 | 0 | Registros de tool/function calls ligados a messages. |
| Models & usage | `usage_events` | 26 | 0 | Eventos de uso de tokens/custo para metering e metrics. |

## Tabelas (detalhe)

### `app_config`

**Dominio:** App & meta  
**Proposito:** Configuracao chave-valor da aplicacao persistida localmente.  
**PK:** `key`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `key` | `TEXT` | NO |  | YES |
| 1 | `value` | `TEXT` | NO |  |  |
| 2 | `updated_at` | `TEXT` | NO | datetime('now') |  |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_app_config_1` | YES | pk | key |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE app_config (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
```

</details>

### `codegraph_runs`

**Dominio:** Git & codegraph  
**Proposito:** Historico de runs de indexacao/build/repair do codegraph por projeto.  
**PK:** `id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `project_id` | `TEXT` | NO |  |  |
| 2 | `kind` | `TEXT` | NO |  |  |
| 3 | `status` | `TEXT` | NO |  |  |
| 4 | `output` | `TEXT` | YES |  |  |
| 5 | `error` | `TEXT` | YES |  |  |
| 6 | `duration_ms` | `INTEGER` | YES |  |  |
| 7 | `stats_json` | `TEXT` | YES |  |  |
| 8 | `created_at` | `TEXT` | NO | datetime('now') |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `project_id` | `projects.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_codegraph_runs_project_created` | NO | c | project_id, created_at |

#### CHECK constraints

```sql
CHECK (kind IN ('build','reindex','update','repair'))
```

```sql
CHECK (status IN ('running','done','error','cancelled'))
```


<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE codegraph_runs (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        kind        TEXT NOT NULL CHECK (kind IN ('build','reindex','update','repair')),
        status      TEXT NOT NULL CHECK (status IN ('running','done','error','cancelled')),
        output      TEXT,
        error       TEXT,
        duration_ms INTEGER,
        stats_json  TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
```

</details>

### `commands`

**Dominio:** Agents & tools catalog  
**Proposito:** Templates de comandos/prompts reutilizaveis (workflows estilo slash).  
**PK:** `id`  
**Rows (snapshot):** 3  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `name` | `TEXT` | NO |  |  |
| 2 | `description` | `TEXT` | NO |  |  |
| 3 | `prompt_template` | `TEXT` | NO |  |  |
| 4 | `skill_refs` | `TEXT` | YES |  |  |
| 5 | `subagent_refs` | `TEXT` | YES |  |  |
| 6 | `params` | `TEXT` | YES |  |  |
| 7 | `provider` | `TEXT` | YES |  |  |
| 8 | `model` | `TEXT` | YES |  |  |
| 9 | `reasoning_level` | `TEXT` | YES |  |  |
| 10 | `access_level` | `TEXT` | YES |  |  |
| 11 | `mode_chat_plan` | `TEXT` | YES |  |  |
| 12 | `execution_strategy` | `TEXT` | NO | 'prompt' |  |
| 13 | `category` | `TEXT` | YES |  |  |
| 14 | `enabled` | `INTEGER` | NO | 1 |  |
| 15 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 16 | `updated_at` | `TEXT` | NO | datetime('now') |  |
| 17 | `plan_json` | `TEXT` | YES |  |  |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_commands_2` | YES | u | name |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE commands (
        id                 TEXT PRIMARY KEY,
        name               TEXT NOT NULL,                 -- gatilho do slash (único global)
        description        TEXT NOT NULL,                 -- descrição no menu do composer
        prompt_template    TEXT NOT NULL,                 -- template do prompt do orquestrador
        skill_refs         TEXT,                          -- TEXT JSON: string[] ou NULL (nenhuma)
        subagent_refs      TEXT,                          -- TEXT JSON: string[] ou NULL (nenhum)
        params             TEXT,                          -- TEXT JSON: Record<string,string> ou NULL
        provider           TEXT,                          -- NULL = 'claude' (§6.3)
        model              TEXT,                          -- NULL = default do provider
        reasoning_level    TEXT,                          -- NULL = default do provider
        access_level       TEXT,                          -- NULL = herda o composer (§6.7)
        mode_chat_plan     TEXT,                          -- NULL = herda o composer (§6.7)
        execution_strategy TEXT NOT NULL DEFAULT 'prompt',-- costura p/ 'pipeline' (§12)
        category           TEXT,                          -- agrupamento no menu (opcional)
        enabled            INTEGER NOT NULL DEFAULT 1,
        created_at         TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at         TEXT NOT NULL DEFAULT (datetime('now')), plan_json TEXT,
        UNIQUE(name)
      )
```

</details>

### `data_seeds`

**Dominio:** App & meta  
**Proposito:** Marcadores idempotentes de seeds (catalogo/bootstrap aplicado uma vez).  
**PK:** `id`  
**Rows (snapshot):** 5  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `applied_at` | `TEXT` | NO |  |  |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_data_seeds_1` | YES | pk | id |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE data_seeds (
        id         TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
```

</details>

### `diffs`

**Dominio:** Core / workspace  
**Proposito:** Snapshots de diff/git associados a threads ou reviews.  
**PK:** `id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `thread_id` | `TEXT` | NO |  |  |
| 2 | `file` | `TEXT` | NO |  |  |
| 3 | `additions` | `INTEGER` | NO | 0 |  |
| 4 | `deletions` | `INTEGER` | NO | 0 |  |
| 5 | `hunks` | `TEXT` | NO |  |  |
| 6 | `provider` | `TEXT` | NO |  |  |
| 7 | `status` | `TEXT` | NO | 'pending' |  |
| 8 | `worktree_path` | `TEXT` | YES |  |  |
| 9 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 10 | `review_cycle_id` | `TEXT` | YES |  |  |
| 11 | `snapshot_ref` | `TEXT` | YES |  |  |
| 12 | `review_head` | `TEXT` | YES |  |  |
| 13 | `review_branch` | `TEXT` | YES |  |  |
| 14 | `strategy` | `TEXT` | YES |  |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `thread_id` | `threads.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_diffs_thread_review_cycle` | NO | c | thread_id, review_cycle_id, status |

#### CHECK constraints

```sql
CHECK (status IN ('pending','accepted','rejected'))
```


<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE diffs (
        id            TEXT PRIMARY KEY,
        thread_id     TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        file          TEXT NOT NULL,
        additions     INTEGER NOT NULL DEFAULT 0,
        deletions     INTEGER NOT NULL DEFAULT 0,
        hunks         TEXT NOT NULL,
        provider      TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','accepted','rejected')),
        worktree_path TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      , review_cycle_id TEXT, snapshot_ref TEXT, review_head TEXT, review_branch TEXT, strategy TEXT)
```

</details>

### `feature_build_rounds`

**Dominio:** Feature pipeline & build  
**Proposito:** Rounds individuais dentro de um sprint de feature-build.  
**PK:** `build_id`, `sprint_index`, `round`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `build_id` | `TEXT` | NO |  | YES |
| 1 | `sprint_index` | `INTEGER` | NO |  | YES |
| 2 | `round` | `INTEGER` | NO |  | YES |
| 3 | `dev_output_json` | `TEXT` | YES |  |  |
| 4 | `verification_json` | `TEXT` | YES |  |  |
| 5 | `validator_json` | `TEXT` | YES |  |  |
| 6 | `status` | `TEXT` | NO |  |  |
| 7 | `created_at` | `TEXT` | NO |  |  |
| 8 | `updated_at` | `TEXT` | NO |  |  |
| 9 | `run_refs_json` | `TEXT` | NO | '[]' |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `build_id` | `feature_builds.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_feature_build_rounds_1` | YES | pk | build_id, sprint_index, round |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE feature_build_rounds (
        build_id          TEXT NOT NULL REFERENCES feature_builds(id) ON DELETE CASCADE,
        sprint_index      INTEGER NOT NULL,
        round             INTEGER NOT NULL,
        dev_output_json   TEXT,
        verification_json TEXT,
        validator_json    TEXT,
        status            TEXT NOT NULL,        -- FeatureBuildRoundStatus
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL, run_refs_json TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (build_id, sprint_index, round)
      )
```

</details>

### `feature_build_sprints`

**Dominio:** Feature pipeline & build  
**Proposito:** Containers de sprint dentro de uma execucao de feature build.  
**PK:** `build_id`, `sprint_index`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `build_id` | `TEXT` | NO |  | YES |
| 1 | `sprint_index` | `INTEGER` | NO |  | YES |
| 2 | `build_sprint_id` | `TEXT` | NO |  |  |
| 3 | `status` | `TEXT` | NO |  |  |
| 4 | `round` | `INTEGER` | NO | 0 |  |
| 5 | `det_fixes` | `INTEGER` | NO | 0 |  |
| 6 | `checkpoint` | `TEXT` | YES |  |  |
| 7 | `quality` | `TEXT` | NO | 'clean' |  |
| 8 | `state_json` | `TEXT` | YES |  |  |
| 9 | `started_at` | `TEXT` | YES |  |  |
| 10 | `finished_at` | `TEXT` | YES |  |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `build_id` | `feature_builds.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_feature_build_sprints_2` | YES | pk | build_id, sprint_index |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE feature_build_sprints (
        build_id        TEXT NOT NULL REFERENCES feature_builds(id) ON DELETE CASCADE,
        sprint_index    INTEGER NOT NULL,
        build_sprint_id TEXT NOT NULL UNIQUE,
        status          TEXT NOT NULL,          -- SprintItemStatus (§3)
        round           INTEGER NOT NULL DEFAULT 0,
        det_fixes       INTEGER NOT NULL DEFAULT 0,
        checkpoint      TEXT,                   -- BuildSprintCheckpoint | NULL
        quality         TEXT NOT NULL DEFAULT 'clean',
        state_json      TEXT,
        started_at      TEXT,
        finished_at     TEXT,
        PRIMARY KEY (build_id, sprint_index)
      )
```

</details>

### `feature_builds`

**Dominio:** Feature pipeline & build  
**Proposito:** Execucoes top-level de feature build (loops validator/coding).  
**PK:** `id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `project_id` | `TEXT` | NO |  |  |
| 2 | `thread_id` | `TEXT` | NO |  |  |
| 3 | `slug` | `TEXT` | NO |  |  |
| 4 | `status` | `TEXT` | NO |  |  |
| 5 | `wave` | `INTEGER` | NO | 0 |  |
| 6 | `quality` | `TEXT` | NO | 'clean' |  |
| 7 | `review_status` | `TEXT` | NO | 'pending' |  |
| 8 | `reviewed_at` | `TEXT` | YES |  |  |
| 9 | `commands_hash` | `TEXT` | YES |  |  |
| 10 | `error_detail` | `TEXT` | YES |  |  |
| 11 | `created_at` | `TEXT` | NO |  |  |
| 12 | `updated_at` | `TEXT` | NO |  |  |
| 13 | `intervention_attempts` | `INTEGER` | NO | 0 |  |
| 14 | `error_fact` | `TEXT` | YES |  |  |
| 15 | `authorized_artifacts` | `TEXT` | YES |  |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `thread_id` | `threads.id` | CASCADE | NO ACTION |
| `project_id` | `projects.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_feature_builds_project_slug_active` | YES | c | project_id, slug |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE feature_builds (
        id            TEXT PRIMARY KEY,
        project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        thread_id     TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        slug          TEXT NOT NULL,
        status        TEXT NOT NULL,            -- FeatureBuildStatus (§3)
        wave          INTEGER NOT NULL DEFAULT 0,
        quality       TEXT NOT NULL DEFAULT 'clean',   -- 'clean'|'with-findings'
        review_status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'accepted'|'rejected'
        reviewed_at   TEXT,
        commands_hash TEXT,                     -- confirmação do dono (§2.6)
        error_detail  TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      , intervention_attempts INTEGER NOT NULL DEFAULT 0, error_fact TEXT, authorized_artifacts TEXT)
```

</details>

### `feature_pipeline_phases`

**Dominio:** Feature pipeline & build  
**Proposito:** Fases ordenadas pertencentes a um round de pipeline.  
**PK:** `pipeline_id`, `phase`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `pipeline_id` | `TEXT` | NO |  | YES |
| 1 | `phase` | `TEXT` | NO |  | YES |
| 2 | `status` | `TEXT` | NO |  |  |
| 3 | `rounds` | `INTEGER` | NO | 0 |  |
| 4 | `detail` | `TEXT` | YES |  |  |
| 5 | `artifact_hashes_json` | `TEXT` | YES |  |  |
| 6 | `started_at` | `TEXT` | YES |  |  |
| 7 | `finished_at` | `TEXT` | YES |  |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `pipeline_id` | `feature_pipelines.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_feature_pipeline_phases_1` | YES | pk | pipeline_id, phase |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE feature_pipeline_phases (
        pipeline_id          TEXT NOT NULL REFERENCES feature_pipelines(id) ON DELETE CASCADE,
        phase                TEXT NOT NULL,
        status               TEXT NOT NULL,  -- 'pending'|'running'|'done'|'error'|'interrupted'
        rounds               INTEGER NOT NULL DEFAULT 0,
        detail               TEXT,
        artifact_hashes_json TEXT,           -- no done da fase (não-clobber §9)
        started_at           TEXT,
        finished_at          TEXT,
        PRIMARY KEY (pipeline_id, phase)
      )
```

</details>

### `feature_pipeline_rounds`

**Dominio:** Feature pipeline & build  
**Proposito:** Rounds de uma execucao multiagente de feature pipeline.  
**PK:** `pipeline_id`, `phase`, `round`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `pipeline_id` | `TEXT` | NO |  | YES |
| 1 | `phase` | `TEXT` | NO |  | YES |
| 2 | `round` | `INTEGER` | NO |  | YES |
| 3 | `collected_json` | `TEXT` | NO |  |  |
| 4 | `artifact_hashes_json` | `TEXT` | NO |  |  |
| 5 | `decision_json` | `TEXT` | YES |  |  |
| 6 | `fix_report_json` | `TEXT` | YES |  |  |
| 7 | `status` | `TEXT` | NO |  |  |
| 8 | `created_at` | `TEXT` | NO |  |  |
| 9 | `updated_at` | `TEXT` | NO |  |  |
| 10 | `recollects` | `INTEGER` | NO | 0 |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `pipeline_id` | `feature_pipelines.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_feature_pipeline_rounds_1` | YES | pk | pipeline_id, phase, round |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE feature_pipeline_rounds (
        pipeline_id          TEXT NOT NULL REFERENCES feature_pipelines(id) ON DELETE CASCADE,
        phase                TEXT NOT NULL,
        round                INTEGER NOT NULL,
        collected_json       TEXT NOT NULL,  -- ValidatorOutput[] c/ IDs | ScoutSection[] (tech)
        artifact_hashes_json TEXT NOT NULL,  -- hashes dos artefatos NO MOMENTO da coleta
        decision_json        TEXT,           -- PipelineDecision (fechamento do turno)
        fix_report_json      TEXT,           -- FixReport (fechamento do turno de fix)
        status               TEXT NOT NULL,  -- 'collected'|'decided'|'fixed'
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL, recollects INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (pipeline_id, phase, round)
      )
```

</details>

### `feature_pipelines`

**Dominio:** Feature pipeline & build  
**Proposito:** Cabecalhos de run de feature pipeline (spec -> orquestracao de build).  
**PK:** `id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `project_id` | `TEXT` | NO |  |  |
| 2 | `thread_id` | `TEXT` | NO |  |  |
| 3 | `slug` | `TEXT` | NO |  |  |
| 4 | `title` | `TEXT` | NO |  |  |
| 5 | `phase` | `TEXT` | NO |  |  |
| 6 | `phase_status` | `TEXT` | NO |  |  |
| 7 | `pending_resume` | `TEXT` | YES |  |  |
| 8 | `quality` | `TEXT` | NO | 'clean' |  |
| 9 | `error_detail` | `TEXT` | YES |  |  |
| 10 | `created_at` | `TEXT` | NO |  |  |
| 11 | `updated_at` | `TEXT` | NO |  |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `thread_id` | `threads.id` | CASCADE | NO ACTION |
| `project_id` | `projects.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_feature_pipelines_thread_active` | YES | c | thread_id |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE feature_pipelines (
        id             TEXT PRIMARY KEY,
        project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        thread_id      TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        slug           TEXT NOT NULL,
        title          TEXT NOT NULL,
        phase          TEXT NOT NULL,
        phase_status   TEXT NOT NULL,
        pending_resume TEXT,                      -- NULL | phase-id | 'finalize'
        quality        TEXT NOT NULL DEFAULT 'clean', -- 'clean'|'with-findings'
        error_detail   TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        UNIQUE (project_id, slug)
      )
```

</details>

### `git_review_baselines`

**Dominio:** Git & codegraph  
**Proposito:** Refs git usadas como baseline de review/diff por thread/projeto.  
**PK:** `id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `thread_id` | `TEXT` | NO |  |  |
| 2 | `repo_path` | `TEXT` | NO |  |  |
| 3 | `worktree_ref` | `TEXT` | NO |  |  |
| 4 | `index_ref` | `TEXT` | NO |  |  |
| 5 | `output_ref` | `TEXT` | YES |  |  |
| 6 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 7 | `updated_at` | `TEXT` | NO | datetime('now') |  |
| 8 | `head_sha` | `TEXT` | YES |  |  |
| 9 | `branch` | `TEXT` | YES |  |  |
| 10 | `strategy` | `TEXT` | YES |  |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `thread_id` | `threads.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_git_review_baselines_2` | YES | u | thread_id |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE git_review_baselines (
        id                TEXT PRIMARY KEY,
        thread_id         TEXT NOT NULL UNIQUE
                            REFERENCES threads(id) ON DELETE CASCADE,
        repo_path         TEXT NOT NULL,
        worktree_ref      TEXT NOT NULL,
        index_ref         TEXT NOT NULL,
        output_ref        TEXT,
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
      , head_sha TEXT, branch TEXT, strategy TEXT)
```

</details>

### `log_entries`

**Dominio:** Core / workspace  
**Proposito:** Linhas de log estruturado anexadas a threads ou eventos de sistema.  
**PK:** `id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `thread_id` | `TEXT` | NO |  |  |
| 2 | `kind` | `TEXT` | NO |  |  |
| 3 | `event` | `TEXT` | NO |  |  |
| 4 | `timestamp` | `TEXT` | NO | datetime('now') |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `thread_id` | `threads.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_log_entries_kind` | NO | c | kind |

#### CHECK constraints

```sql
CHECK (kind IN ('task','tool','git'))
```


<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE log_entries (
        id        TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        kind      TEXT NOT NULL CHECK (kind IN ('task','tool','git')),
        event     TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )
```

</details>

### `mcps`

**Dominio:** Agents & tools catalog  
**Proposito:** Catalogo de servidores MCP (metadados de conexao/config).  
**PK:** `id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `name` | `TEXT` | NO |  |  |
| 2 | `description` | `TEXT` | YES |  |  |
| 3 | `transport` | `TEXT` | NO | 'stdio' |  |
| 4 | `command` | `TEXT` | YES |  |  |
| 5 | `args_json` | `TEXT` | YES |  |  |
| 6 | `env_json` | `TEXT` | YES |  |  |
| 7 | `url` | `TEXT` | YES |  |  |
| 8 | `headers_json` | `TEXT` | YES |  |  |
| 9 | `category` | `TEXT` | YES |  |  |
| 10 | `enabled` | `INTEGER` | NO | 1 |  |
| 11 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 12 | `updated_at` | `TEXT` | NO | datetime('now') |  |
| 13 | `preset_id` | `TEXT` | YES |  |  |
| 14 | `auth_mode` | `TEXT` | NO | 'secret' |  |
| 15 | `oauth_status` | `TEXT` | YES |  |  |
| 16 | `oauth_client_json` | `TEXT` | YES |  |  |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_mcps_2` | YES | u | name |

#### CHECK constraints

```sql
CHECK (transport IN ('stdio','http','sse'))
```


<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE mcps (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,               -- chave (vira a chave do mcpServers)
        description  TEXT,                        -- opcional (ao contrário de skills)
        transport    TEXT NOT NULL DEFAULT 'stdio'
                       CHECK (transport IN ('stdio','http','sse')),
        command      TEXT,                        -- stdio
        args_json    TEXT,                        -- stdio: string[] (NULL = [])
        env_json     TEXT,                        -- stdio: Record<string,string> (§12.2)
        url          TEXT,                        -- http/sse
        headers_json TEXT,                        -- http/sse: Record<string,string>
        category     TEXT,
        enabled      INTEGER NOT NULL DEFAULT 1,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now')), preset_id TEXT, auth_mode TEXT NOT NULL DEFAULT 'secret', oauth_status TEXT, oauth_client_json TEXT,
        UNIQUE(name)
      )
```

</details>

### `messages`

**Dominio:** Core / workspace  
**Proposito:** Mensagens de chat de uma thread (user/assistant/tool).  
**PK:** `id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `thread_id` | `TEXT` | NO |  |  |
| 2 | `role` | `TEXT` | NO |  |  |
| 3 | `content` | `TEXT` | NO |  |  |
| 4 | `seq` | `INTEGER` | NO |  |  |
| 5 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 6 | `status` | `TEXT` | NO | 'complete' |  |
| 7 | `images_json` | `TEXT` | YES |  |  |
| 8 | `synthetic` | `TEXT` | YES |  |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `thread_id` | `threads.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_messages_thread_seq` | YES | c | thread_id, seq |

#### CHECK constraints

```sql
CHECK (role IN ('user','assistant','system'))
```

```sql
CHECK (status IN ('complete','interrompido'))
```


<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE messages (
        id         TEXT PRIMARY KEY,
        thread_id  TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        role       TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
        content    TEXT NOT NULL,
        seq        INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      , status TEXT NOT NULL DEFAULT 'complete'
            CHECK (status IN ('complete','interrompido')), images_json TEXT, synthetic TEXT)
```

</details>

### `model_pricing`

**Dominio:** Models & usage  
**Proposito:** Catalogo de precos provider/model para estimativa de custo.  
**PK:** `id`  
**Rows (snapshot):** 15  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `provider` | `TEXT` | NO |  |  |
| 2 | `model` | `TEXT` | NO |  |  |
| 3 | `input_per_mtok` | `REAL` | NO |  |  |
| 4 | `output_per_mtok` | `REAL` | NO |  |  |
| 5 | `cache_read_per_mtok` | `REAL` | YES |  |  |
| 6 | `cache_write_per_mtok` | `REAL` | YES |  |  |
| 7 | `approximate` | `INTEGER` | NO | 0 |  |
| 8 | `source` | `TEXT` | YES |  |  |
| 9 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 10 | `updated_at` | `TEXT` | NO | datetime('now') |  |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_model_pricing_2` | YES | u | provider, model |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE model_pricing (
        id                   TEXT PRIMARY KEY,
        provider             TEXT NOT NULL,
        model                TEXT NOT NULL,
        input_per_mtok       REAL NOT NULL,
        output_per_mtok      REAL NOT NULL,
        cache_read_per_mtok  REAL,
        cache_write_per_mtok REAL,
        approximate          INTEGER NOT NULL DEFAULT 0,
        source               TEXT,
        created_at           TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(provider, model)
      )
```

</details>

### `project_mcps`

**Dominio:** Agents & tools catalog  
**Proposito:** Junção N:M — quais MCPs estao habilitados para um projeto.  
**PK:** `project_id`, `mcp_id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `project_id` | `TEXT` | NO |  | YES |
| 1 | `mcp_id` | `TEXT` | NO |  | YES |
| 2 | `enabled` | `INTEGER` | NO | 1 |  |
| 3 | `sort_order` | `INTEGER` | NO | 0 |  |
| 4 | `created_at` | `TEXT` | NO | datetime('now') |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `mcp_id` | `mcps.id` | CASCADE | NO ACTION |
| `project_id` | `projects.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_project_mcps_project` | NO | c | project_id |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE project_mcps (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        mcp_id     TEXT NOT NULL REFERENCES mcps(id)     ON DELETE CASCADE,
        enabled    INTEGER NOT NULL DEFAULT 1,           -- liga/desliga POR projeto
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (project_id, mcp_id)
      )
```

</details>

### `project_rules`

**Dominio:** Agents & tools catalog  
**Proposito:** Junção N:M — quais rules estao vinculadas a um projeto.  
**PK:** `project_id`, `rule_id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `project_id` | `TEXT` | NO |  | YES |
| 1 | `rule_id` | `TEXT` | NO |  | YES |
| 2 | `enabled` | `INTEGER` | NO | 1 |  |
| 3 | `sort_order` | `INTEGER` | NO | 0 |  |
| 4 | `created_at` | `TEXT` | NO | datetime('now') |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `rule_id` | `rules.id` | CASCADE | NO ACTION |
| `project_id` | `projects.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_project_rules_project` | NO | c | project_id |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE project_rules (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        rule_id    TEXT NOT NULL REFERENCES rules(id)    ON DELETE CASCADE,
        enabled    INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (project_id, rule_id)
      )
```

</details>

### `project_skills`

**Dominio:** Agents & tools catalog  
**Proposito:** Junção N:M — quais skills estao vinculadas a um projeto.  
**PK:** `project_id`, `skill_id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `project_id` | `TEXT` | NO |  | YES |
| 1 | `skill_id` | `TEXT` | NO |  | YES |
| 2 | `enabled` | `INTEGER` | NO | 1 |  |
| 3 | `sort_order` | `INTEGER` | NO | 0 |  |
| 4 | `created_at` | `TEXT` | NO | datetime('now') |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `skill_id` | `skills.id` | CASCADE | NO ACTION |
| `project_id` | `projects.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_project_skills_project` | NO | c | project_id |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE project_skills (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        skill_id   TEXT NOT NULL REFERENCES skills(id)   ON DELETE CASCADE,
        enabled    INTEGER NOT NULL DEFAULT 1,           -- liga/desliga POR projeto
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (project_id, skill_id)
      )
```

</details>

### `project_subagents`

**Dominio:** Agents & tools catalog  
**Proposito:** Junção N:M — quais subagents estao vinculados a um projeto.  
**PK:** `project_id`, `subagent_id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `project_id` | `TEXT` | NO |  | YES |
| 1 | `subagent_id` | `TEXT` | NO |  | YES |
| 2 | `enabled` | `INTEGER` | NO | 1 |  |
| 3 | `sort_order` | `INTEGER` | NO | 0 |  |
| 4 | `created_at` | `TEXT` | NO | datetime('now') |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `subagent_id` | `subagents.id` | CASCADE | NO ACTION |
| `project_id` | `projects.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_project_subagents_project` | NO | c | project_id |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE project_subagents (
        project_id   TEXT NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
        subagent_id  TEXT NOT NULL REFERENCES subagents(id) ON DELETE CASCADE,
        enabled      INTEGER NOT NULL DEFAULT 1,
        sort_order   INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (project_id, subagent_id)
      )
```

</details>

### `projects`

**Dominio:** Core / workspace  
**Proposito:** Projetos/workspaces (path raiz, settings, identidade).  
**PK:** `id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `name` | `TEXT` | NO |  |  |
| 2 | `path` | `TEXT` | NO |  |  |
| 3 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 4 | `updated_at` | `TEXT` | NO | datetime('now') |  |
| 5 | `codegraph_status` | `TEXT` | NO | 'absent' |  |
| 6 | `codegraph_indexed_commit` | `TEXT` | YES |  |  |
| 7 | `codegraph_last_indexed_at` | `TEXT` | YES |  |  |
| 8 | `codegraph_stats_json` | `TEXT` | YES |  |  |
| 9 | `codegraph_offer_suppressed` | `INTEGER` | NO | 0 |  |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_projects_2` | YES | u | path |

#### CHECK constraints

```sql
CHECK (codegraph_status IN ('absent','building','ready','stale','error'))
```


<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE projects (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        path       TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      , codegraph_status TEXT NOT NULL
        DEFAULT 'absent'
        CHECK (codegraph_status IN ('absent','building','ready','stale','error')), codegraph_indexed_commit TEXT, codegraph_last_indexed_at TEXT, codegraph_stats_json TEXT, codegraph_offer_suppressed INTEGER NOT NULL DEFAULT 0)
```

</details>

### `quick_actions`

**Dominio:** Agents & tools catalog  
**Proposito:** Definicoes de quick-actions da UI (prompts/atalhos).  
**PK:** `id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `project_id` | `TEXT` | NO |  |  |
| 2 | `label` | `TEXT` | NO |  |  |
| 3 | `command` | `TEXT` | NO |  |  |
| 4 | `keybinding` | `TEXT` | YES |  |  |
| 5 | `created_at` | `TEXT` | NO | datetime('now') |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `project_id` | `projects.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_quick_actions_project_id` | NO | c | project_id |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE quick_actions (
        id         TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        label      TEXT NOT NULL,
        command    TEXT NOT NULL,
        keybinding TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
```

</details>

### `rules`

**Dominio:** Agents & tools catalog  
**Proposito:** Documentos de rules persistentes aplicados ao contexto do agente.  
**PK:** `id`  
**Rows (snapshot):** 6  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `name` | `TEXT` | NO |  |  |
| 2 | `description` | `TEXT` | YES |  |  |
| 3 | `content` | `TEXT` | NO |  |  |
| 4 | `category` | `TEXT` | YES |  |  |
| 5 | `is_global` | `INTEGER` | NO | 0 |  |
| 6 | `enabled` | `INTEGER` | NO | 1 |  |
| 7 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 8 | `updated_at` | `TEXT` | NO | datetime('now') |  |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_rules_2` | YES | u | name |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE rules (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,               -- entra no delimitador do bloco (D5)
        description TEXT,
        content     TEXT NOT NULL,               -- a instrução (markdown)
        category    TEXT,
        is_global   INTEGER NOT NULL DEFAULT 0,  -- 1 = todo projeto (default-on)
        enabled     INTEGER NOT NULL DEFAULT 1,  -- kill-switch global
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(name)
      )
```

</details>

### `schema_migrations`

**Dominio:** App & meta  
**Proposito:** Versoes de migration aplicadas pelo migrator do server.  
**PK:** `id`  
**Rows (snapshot):** 62  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `INTEGER` | NO |  | YES |
| 1 | `name` | `TEXT` | NO |  |  |
| 2 | `applied_at` | `TEXT` | NO | datetime('now') |  |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE schema_migrations (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
```

</details>

### `skills`

**Dominio:** Agents & tools catalog  
**Proposito:** Catalogo de skills (instrucoes/bundles de tools).  
**PK:** `id`  
**Rows (snapshot):** 29  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `name` | `TEXT` | NO |  |  |
| 2 | `description` | `TEXT` | NO |  |  |
| 3 | `content` | `TEXT` | NO |  |  |
| 4 | `category` | `TEXT` | YES |  |  |
| 5 | `enabled` | `INTEGER` | NO | 1 |  |
| 6 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 7 | `updated_at` | `TEXT` | NO | datetime('now') |  |
| 8 | `trigger` | `TEXT` | NO | 'auto' |  |
| 9 | `locked` | `INTEGER` | NO | 0 |  |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_skills_2` | YES | u | name |

#### CHECK constraints

```sql
CHECK ("trigger" IN ('auto','command'))
```


<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE skills (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,                 -- chave de invocação (única global)
        description TEXT NOT NULL,                 -- "quando usar" (vai no catálogo da tool)
        content     TEXT NOT NULL,                 -- corpo markdown (entregue no load_skill)
        category    TEXT,                          -- agrupamento no menu (opcional)
        enabled     INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')), "trigger" TEXT NOT NULL DEFAULT 'auto'
            CHECK ("trigger" IN ('auto','command')), locked INTEGER NOT NULL DEFAULT 0,
        UNIQUE(name)
      )
```

</details>

### `subagent_runs`

**Dominio:** Agents & tools catalog  
**Proposito:** Registros runtime de invocacoes de subagent.  
**PK:** `child_thread_id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `child_thread_id` | `TEXT` | NO |  | YES |
| 1 | `parent_thread_id` | `TEXT` | NO |  |  |
| 2 | `parent_tool_call_id` | `TEXT` | YES |  |  |
| 3 | `anchor_seq` | `INTEGER` | NO |  |  |
| 4 | `subagent_name` | `TEXT` | NO |  |  |
| 5 | `provider` | `TEXT` | NO |  |  |
| 6 | `model` | `TEXT` | YES |  |  |
| 7 | `status` | `TEXT` | NO |  |  |
| 8 | `text` | `TEXT` | YES |  |  |
| 9 | `usage_json` | `TEXT` | YES |  |  |
| 10 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 11 | `reasoning_level` | `TEXT` | YES |  |  |
| 12 | `duration_ms` | `INTEGER` | YES |  |  |
| 13 | `isolation` | `TEXT` | YES |  |  |
| 14 | `stage_id` | `TEXT` | YES |  |  |
| 15 | `apply_status` | `TEXT` | YES |  |  |
| 16 | `patch_files` | `TEXT` | YES |  |  |
| 17 | `patch_ref` | `TEXT` | YES |  |  |
| 18 | `retry_of` | `TEXT` | YES |  |  |
| 19 | `actions_json` | `TEXT` | YES |  |  |
| 20 | `action_count` | `INTEGER` | NO | 0 |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `parent_thread_id` | `threads.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_subagent_runs_parent` | NO | c | parent_thread_id |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE subagent_runs (
        child_thread_id     TEXT PRIMARY KEY,
        parent_thread_id    TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        parent_tool_call_id TEXT,
        anchor_seq          INTEGER NOT NULL,
        subagent_name       TEXT NOT NULL,
        provider            TEXT NOT NULL,
        model               TEXT,
        status              TEXT NOT NULL,
        text                TEXT,
        usage_json          TEXT,
        created_at          TEXT NOT NULL DEFAULT (datetime('now'))
      , reasoning_level TEXT, duration_ms INTEGER, isolation TEXT, stage_id TEXT, apply_status TEXT, patch_files TEXT, patch_ref TEXT, retry_of TEXT, actions_json TEXT, action_count INTEGER NOT NULL DEFAULT 0)
```

</details>

### `subagents`

**Dominio:** Agents & tools catalog  
**Proposito:** Catalogo de subagents (papel, tools, preferencias de model).  
**PK:** `id`  
**Rows (snapshot):** 34  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `name` | `TEXT` | NO |  |  |
| 2 | `description` | `TEXT` | NO |  |  |
| 3 | `prompt` | `TEXT` | NO |  |  |
| 4 | `provider` | `TEXT` | NO | 'inherit' |  |
| 5 | `model` | `TEXT` | YES |  |  |
| 6 | `reasoning_level` | `TEXT` | YES |  |  |
| 7 | `tools_json` | `TEXT` | YES |  |  |
| 8 | `category` | `TEXT` | YES |  |  |
| 9 | `enabled` | `INTEGER` | NO | 1 |  |
| 10 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 11 | `updated_at` | `TEXT` | NO | datetime('now') |  |
| 12 | `skills_json` | `TEXT` | YES |  |  |
| 13 | `mcps_json` | `TEXT` | YES |  |  |
| 14 | `network_access` | `INTEGER` | NO | 0 |  |
| 15 | `idle_timeout_minutes` | `INTEGER` | YES |  |  |
| 16 | `kind` | `TEXT` | NO | 'dev' |  |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_subagents_2` | YES | u | name |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE "subagents" (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        description     TEXT NOT NULL,
        prompt          TEXT NOT NULL,
        provider        TEXT NOT NULL DEFAULT 'inherit',
        model           TEXT,
        reasoning_level TEXT,
        tools_json      TEXT,
        category        TEXT,
        enabled         INTEGER NOT NULL DEFAULT 1,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
        skills_json     TEXT,
        mcps_json       TEXT, network_access INTEGER NOT NULL DEFAULT 0, idle_timeout_minutes INTEGER, kind TEXT NOT NULL DEFAULT 'dev',
        UNIQUE(name)
      )
```

</details>

### `thread_context_window_snapshots`

**Dominio:** Models & usage  
**Proposito:** Snapshots de uso de context-window por thread.  
**PK:** `thread_id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `thread_id` | `TEXT` | NO |  | YES |
| 1 | `used_tokens` | `INTEGER` | NO |  |  |
| 2 | `max_tokens` | `INTEGER` | YES |  |  |
| 3 | `total_processed_tokens` | `INTEGER` | YES |  |  |
| 4 | `input_tokens` | `INTEGER` | YES |  |  |
| 5 | `output_tokens` | `INTEGER` | YES |  |  |
| 6 | `cache_read_tokens` | `INTEGER` | YES |  |  |
| 7 | `compacts_automatically` | `INTEGER` | YES |  |  |
| 8 | `compacted` | `INTEGER` | NO | 0 |  |
| 9 | `updated_at` | `TEXT` | NO | datetime('now') |  |
| 10 | `revision` | `INTEGER` | NO | 1 |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `thread_id` | `threads.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `sqlite_autoindex_thread_context_window_snapshots_1` | YES | pk | thread_id |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE thread_context_window_snapshots (
        thread_id                 TEXT PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
        used_tokens               INTEGER NOT NULL,
        max_tokens                INTEGER,
        total_processed_tokens    INTEGER,
        input_tokens              INTEGER,
        output_tokens             INTEGER,
        cache_read_tokens         INTEGER,
        compacts_automatically    INTEGER,
        compacted                 INTEGER NOT NULL DEFAULT 0,
        updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
      , revision INTEGER NOT NULL DEFAULT 1)
```

</details>

### `threads`

**Dominio:** Core / workspace  
**Proposito:** Threads de conversa escopadas a um projeto.  
**PK:** `id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `project_id` | `TEXT` | NO |  |  |
| 2 | `title` | `TEXT` | NO |  |  |
| 3 | `provider` | `TEXT` | NO |  |  |
| 4 | `state` | `TEXT` | NO | 'idle' |  |
| 5 | `reasoning_level` | `TEXT` | YES |  |  |
| 6 | `mode_chat_plan` | `TEXT` | YES |  |  |
| 7 | `mode_full_supervised` | `TEXT` | YES |  |  |
| 8 | `access_level` | `TEXT` | YES |  |  |
| 9 | `fast_mode` | `INTEGER` | YES |  |  |
| 10 | `system_prompt` | `TEXT` | YES |  |  |
| 11 | `branch` | `TEXT` | YES |  |  |
| 12 | `pr_url` | `TEXT` | YES |  |  |
| 13 | `error_message` | `TEXT` | YES |  |  |
| 14 | `model` | `TEXT` | YES |  |  |
| 15 | `session_id` | `TEXT` | YES |  |  |
| 16 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 17 | `updated_at` | `TEXT` | NO | datetime('now') |  |
| 18 | `context_window` | `INTEGER` | YES |  |  |
| 19 | `execution_mode` | `TEXT` | NO | 'main' |  |
| 20 | `worktree_path` | `TEXT` | YES |  |  |
| 21 | `session_cwd` | `TEXT` | YES |  |  |
| 22 | `command_name` | `TEXT` | YES |  |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `project_id` | `projects.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_threads_project_id` | NO | c | project_id |

#### CHECK constraints

```sql
CHECK (state IN ('idle','running','awaiting-review','committed','pr-open','pr-merged','pr-closed','error'))
```

```sql
CHECK (mode_chat_plan IN ('chat','plan'))
```


<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE "threads" (
        id                   TEXT PRIMARY KEY,
        project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title                TEXT NOT NULL,
        provider             TEXT NOT NULL,
        state                TEXT NOT NULL DEFAULT 'idle'
                               CHECK (state IN ('idle','running','awaiting-review','committed','pr-open','pr-merged','pr-closed','error')),
        reasoning_level      TEXT,
        mode_chat_plan       TEXT CHECK (mode_chat_plan IN ('chat','plan')),
        mode_full_supervised TEXT,
        access_level         TEXT,
        fast_mode            INTEGER,
        system_prompt        TEXT,
        branch               TEXT,
        pr_url               TEXT,
        error_message        TEXT,
        model                TEXT,
        session_id           TEXT,
        created_at           TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
        context_window       INTEGER,
        execution_mode       TEXT NOT NULL DEFAULT 'main',
        worktree_path        TEXT,
        session_cwd          TEXT,
        command_name         TEXT
      )
```

</details>

### `tool_calls`

**Dominio:** Core / workspace  
**Proposito:** Registros de tool/function calls ligados a messages.  
**PK:** `id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `id` | `TEXT` | NO |  | YES |
| 1 | `thread_id` | `TEXT` | NO |  |  |
| 2 | `message_id` | `TEXT` | YES |  |  |
| 3 | `tool_name` | `TEXT` | NO |  |  |
| 4 | `params` | `TEXT` | YES |  |  |
| 5 | `result` | `TEXT` | YES |  |  |
| 6 | `seq` | `INTEGER` | NO |  |  |
| 7 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 8 | `status` | `TEXT` | NO | 'done' |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `message_id` | `messages.id` | CASCADE | NO ACTION |
| `thread_id` | `threads.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_tool_calls_message_id` | NO | c | message_id |

#### CHECK constraints

```sql
CHECK (status IN ('done','interrompido'))
```


<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE tool_calls (
        id         TEXT PRIMARY KEY,
        thread_id  TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
        tool_name  TEXT NOT NULL,
        params     TEXT,
        result     TEXT,
        seq        INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      , status TEXT NOT NULL DEFAULT 'done'
            CHECK (status IN ('done','interrompido')))
```

</details>

### `usage_events`

**Dominio:** Models & usage  
**Proposito:** Eventos de uso de tokens/custo para metering e metrics.  
**PK:** `order_id`  
**Rows (snapshot):** 0  
**Confianca:** 🟢

#### Colunas

| # | Nome | Tipo | Nullable | Default | PK |
| -: | ---- | ---- | -------- | ------- | -- |
| 0 | `order_id` | `INTEGER` | NO |  | YES |
| 1 | `id` | `TEXT` | NO |  |  |
| 2 | `turn_id` | `TEXT` | NO |  |  |
| 3 | `project_id` | `TEXT` | NO |  |  |
| 4 | `thread_id` | `TEXT` | NO |  |  |
| 5 | `source` | `TEXT` | NO |  |  |
| 6 | `child_thread_id` | `TEXT` | YES |  |  |
| 7 | `subagent_name` | `TEXT` | YES |  |  |
| 8 | `parent_tool_call_id` | `TEXT` | YES |  |  |
| 9 | `provider` | `TEXT` | NO |  |  |
| 10 | `model` | `TEXT` | NO |  |  |
| 11 | `billing_mode` | `TEXT` | NO |  |  |
| 12 | `reasoning_level` | `TEXT` | YES |  |  |
| 13 | `fast_mode` | `INTEGER` | YES |  |  |
| 14 | `context_window` | `INTEGER` | YES |  |  |
| 15 | `input_tokens` | `INTEGER` | NO |  |  |
| 16 | `cache_read_tokens` | `INTEGER` | YES |  |  |
| 17 | `cache_creation_tokens` | `INTEGER` | YES |  |  |
| 18 | `output_tokens` | `INTEGER` | NO |  |  |
| 19 | `total_tokens` | `INTEGER` | NO |  |  |
| 20 | `cost_usd` | `REAL` | YES |  |  |
| 21 | `cost_source` | `TEXT` | NO | 'table' |  |
| 22 | `cost_approximate` | `INTEGER` | NO | 0 |  |
| 23 | `created_at` | `TEXT` | NO | datetime('now') |  |
| 24 | `reasoning_tokens` | `INTEGER` | YES |  |  |
| 25 | `repo_graph_calls` | `TEXT` | YES |  |  |

#### Foreign keys

| Coluna | Referencia | ON DELETE | ON UPDATE |
| ------ | ---------- | --------- | --------- |
| `project_id` | `projects.id` | CASCADE | NO ACTION |

#### Indexes

| Nome | Unique | Origin | Colunas |
| ---- | ------ | ------ | ------- |
| `idx_usage_events_thread_order` | NO | c | thread_id, order_id |

#### CHECK constraints

```sql
CHECK (source IN ('agent','subagent'))
```


<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE usage_events (
        order_id              INTEGER PRIMARY KEY AUTOINCREMENT,
        id                    TEXT NOT NULL UNIQUE,
        turn_id               TEXT NOT NULL,
        project_id            TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        thread_id             TEXT NOT NULL,
        source                TEXT NOT NULL CHECK (source IN ('agent','subagent')),
        child_thread_id       TEXT,
        subagent_name         TEXT,
        parent_tool_call_id   TEXT,
        provider              TEXT NOT NULL,
        model                 TEXT NOT NULL,
        billing_mode          TEXT NOT NULL,
        reasoning_level       TEXT,
        fast_mode             INTEGER,
        context_window        INTEGER,
        input_tokens          INTEGER NOT NULL,
        cache_read_tokens     INTEGER,
        cache_creation_tokens INTEGER,
        output_tokens         INTEGER NOT NULL,
        total_tokens          INTEGER NOT NULL,
        cost_usd              REAL,
        cost_source           TEXT NOT NULL DEFAULT 'table',
        cost_approximate      INTEGER NOT NULL DEFAULT 0,
        created_at            TEXT NOT NULL DEFAULT (datetime('now'))
      , reasoning_tokens INTEGER, repo_graph_calls TEXT)
```

</details>

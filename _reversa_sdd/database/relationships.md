# Relationships — lioncode.db

> Fonte: `PRAGMA foreign_key_list` + DDL live. Confianca: 🟢

## Indice de FKs

| From table | From column | To table | To column | Cardinalidade | ON DELETE | ON UPDATE |
| ---------- | ----------- | -------- | --------- | ------------- | --------- | --------- |
| `codegraph_runs` | `project_id` | `projects` | `id` | 1:N | CASCADE | NO ACTION |
| `diffs` | `thread_id` | `threads` | `id` | 1:N | CASCADE | NO ACTION |
| `feature_build_rounds` | `build_id` | `feature_builds` | `id` | 1:N | CASCADE | NO ACTION |
| `feature_build_sprints` | `build_id` | `feature_builds` | `id` | 1:N | CASCADE | NO ACTION |
| `feature_builds` | `thread_id` | `threads` | `id` | 1:N | CASCADE | NO ACTION |
| `feature_builds` | `project_id` | `projects` | `id` | 1:N | CASCADE | NO ACTION |
| `feature_pipeline_phases` | `pipeline_id` | `feature_pipelines` | `id` | 1:N | CASCADE | NO ACTION |
| `feature_pipeline_rounds` | `pipeline_id` | `feature_pipelines` | `id` | 1:N | CASCADE | NO ACTION |
| `feature_pipelines` | `thread_id` | `threads` | `id` | 1:N | CASCADE | NO ACTION |
| `feature_pipelines` | `project_id` | `projects` | `id` | 1:N | CASCADE | NO ACTION |
| `git_review_baselines` | `thread_id` | `threads` | `id` | 1:N | CASCADE | NO ACTION |
| `log_entries` | `thread_id` | `threads` | `id` | 1:N | CASCADE | NO ACTION |
| `messages` | `thread_id` | `threads` | `id` | 1:N | CASCADE | NO ACTION |
| `project_mcps` | `mcp_id` | `mcps` | `id` | N:M (junction) | CASCADE | NO ACTION |
| `project_mcps` | `project_id` | `projects` | `id` | N:M (junction) | CASCADE | NO ACTION |
| `project_rules` | `rule_id` | `rules` | `id` | N:M (junction) | CASCADE | NO ACTION |
| `project_rules` | `project_id` | `projects` | `id` | N:M (junction) | CASCADE | NO ACTION |
| `project_skills` | `skill_id` | `skills` | `id` | N:M (junction) | CASCADE | NO ACTION |
| `project_skills` | `project_id` | `projects` | `id` | N:M (junction) | CASCADE | NO ACTION |
| `project_subagents` | `subagent_id` | `subagents` | `id` | N:M (junction) | CASCADE | NO ACTION |
| `project_subagents` | `project_id` | `projects` | `id` | N:M (junction) | CASCADE | NO ACTION |
| `quick_actions` | `project_id` | `projects` | `id` | 1:N | CASCADE | NO ACTION |
| `subagent_runs` | `parent_thread_id` | `threads` | `id` | 1:N | CASCADE | NO ACTION |
| `thread_context_window_snapshots` | `thread_id` | `threads` | `id` | 1:N | CASCADE | NO ACTION |
| `threads` | `project_id` | `projects` | `id` | 1:N | CASCADE | NO ACTION |
| `tool_calls` | `message_id` | `messages` | `id` | 1:N | CASCADE | NO ACTION |
| `tool_calls` | `thread_id` | `threads` | `id` | 1:N | CASCADE | NO ACTION |
| `usage_events` | `project_id` | `projects` | `id` | 1:N | CASCADE | NO ACTION |

## Hubs (mais FKs entrantes)

| Tabela | Incoming FK refs |
| ------ | ---------------: |
| `projects` | 10 |
| `threads` | 9 |
| `feature_builds` | 2 |
| `feature_pipelines` | 2 |
| `mcps` | 1 |
| `messages` | 1 |
| `rules` | 1 |
| `skills` | 1 |
| `subagents` | 1 |

## Arvore parent ← children

```
feature_builds
  |-- feature_build_rounds.build_id
  `-- feature_build_sprints.build_id

feature_pipelines
  |-- feature_pipeline_phases.pipeline_id
  `-- feature_pipeline_rounds.pipeline_id

mcps
  `-- project_mcps.mcp_id

messages
  `-- tool_calls.message_id

projects
  |-- codegraph_runs.project_id
  |-- feature_builds.project_id
  |-- feature_pipelines.project_id
  |-- project_mcps.project_id
  |-- project_rules.project_id
  |-- project_skills.project_id
  |-- project_subagents.project_id
  |-- quick_actions.project_id
  |-- threads.project_id
  `-- usage_events.project_id

rules
  `-- project_rules.rule_id

skills
  `-- project_skills.skill_id

subagents
  `-- project_subagents.subagent_id

threads
  |-- diffs.thread_id
  |-- feature_builds.thread_id
  |-- feature_pipelines.thread_id
  |-- git_review_baselines.thread_id
  |-- log_entries.thread_id
  |-- messages.thread_id
  |-- subagent_runs.parent_thread_id
  |-- thread_context_window_snapshots.thread_id
  `-- tool_calls.thread_id

```

## Tabelas de juncao (N:M)

| Junction | Lado A | Lado B | PK composta |
| -------- | ------ | ------ | ----------- |
| `project_mcps` | `mcps` via `mcp_id` | `projects` via `project_id` | `project_id`, `mcp_id` |
| `project_rules` | `rules` via `rule_id` | `projects` via `project_id` | `project_id`, `rule_id` |
| `project_skills` | `skills` via `skill_id` | `projects` via `project_id` | `project_id`, `skill_id` |
| `project_subagents` | `subagents` via `subagent_id` | `projects` via `project_id` | `project_id`, `subagent_id` |

## Relacionamentos logicos sem FK declarada

Colunas que referenciam entidades por convencao no codigo, sem `FOREIGN KEY` no DDL:

| Tabela | Coluna | Referencia inferida | Confianca | Nota |
| ------ | ------ | ------------------- | --------- | ---- |
| `usage_events` | `thread_id` | `threads.id` | 🟡 | Indexada (`idx_usage_events_thread_order`); FK ausente no DDL live |
| `subagent_runs` | `child_thread_id` | `threads.id` (PK propria) | 🟡 | PK e ancora do child thread; so `parent_thread_id` tem FK |
| `feature_build_rounds` | `sprint_index` | `feature_build_sprints.sprint_index` | 🟡 | Compoe identidade junto com `build_id`; FK so em `build_id` |

## Cardinalidades resumidas

- **1:N** dominantes: `projects` → threads/catalog bindings/usage/codegraph/pipelines/builds; `threads` → messages/diffs/logs/tool_calls/pipelines/builds.
- **1:1**: `thread_context_window_snapshots.thread_id` → `threads.id`; `git_review_baselines.thread_id` UNIQUE → `threads.id`.
- **N:M** via junction: projects↔skills, projects↔mcps, projects↔rules, projects↔subagents.

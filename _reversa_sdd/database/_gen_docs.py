#!/usr/bin/env python3
"""Generate Reversa Data Master docs from live lioncode.db (read-only)."""
from __future__ import annotations

import json
import re
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

DB = Path(r"c:\Users\Me\AppData\Roaming\@lioncode\shell\lioncode.db")
OUT = Path(__file__).resolve().parent

DOMAIN = {
    "projects": "Core / workspace",
    "threads": "Core / workspace",
    "messages": "Core / workspace",
    "tool_calls": "Core / workspace",
    "log_entries": "Core / workspace",
    "diffs": "Core / workspace",
    "model_pricing": "Models & usage",
    "usage_events": "Models & usage",
    "thread_context_window_snapshots": "Models & usage",
    "subagents": "Agents & tools catalog",
    "project_subagents": "Agents & tools catalog",
    "subagent_runs": "Agents & tools catalog",
    "skills": "Agents & tools catalog",
    "project_skills": "Agents & tools catalog",
    "mcps": "Agents & tools catalog",
    "project_mcps": "Agents & tools catalog",
    "rules": "Agents & tools catalog",
    "project_rules": "Agents & tools catalog",
    "commands": "Agents & tools catalog",
    "quick_actions": "Agents & tools catalog",
    "git_review_baselines": "Git & codegraph",
    "codegraph_runs": "Git & codegraph",
    "feature_pipelines": "Feature pipeline & build",
    "feature_pipeline_rounds": "Feature pipeline & build",
    "feature_pipeline_phases": "Feature pipeline & build",
    "feature_builds": "Feature pipeline & build",
    "feature_build_sprints": "Feature pipeline & build",
    "feature_build_rounds": "Feature pipeline & build",
    "app_config": "App & meta",
    "data_seeds": "App & meta",
    "schema_migrations": "App & meta",
}

PURPOSE = {
    "app_config": "Configuracao chave-valor da aplicacao persistida localmente.",
    "codegraph_runs": "Historico de runs de indexacao/build/repair do codegraph por projeto.",
    "commands": "Templates de comandos/prompts reutilizaveis (workflows estilo slash).",
    "data_seeds": "Marcadores idempotentes de seeds (catalogo/bootstrap aplicado uma vez).",
    "diffs": "Snapshots de diff/git associados a threads ou reviews.",
    "feature_build_rounds": "Rounds individuais dentro de um sprint de feature-build.",
    "feature_build_sprints": "Containers de sprint dentro de uma execucao de feature build.",
    "feature_builds": "Execucoes top-level de feature build (loops validator/coding).",
    "feature_pipeline_phases": "Fases ordenadas pertencentes a um round de pipeline.",
    "feature_pipeline_rounds": "Rounds de uma execucao multiagente de feature pipeline.",
    "feature_pipelines": "Cabecalhos de run de feature pipeline (spec -> orquestracao de build).",
    "git_review_baselines": "Refs git usadas como baseline de review/diff por thread/projeto.",
    "log_entries": "Linhas de log estruturado anexadas a threads ou eventos de sistema.",
    "mcps": "Catalogo de servidores MCP (metadados de conexao/config).",
    "messages": "Mensagens de chat de uma thread (user/assistant/tool).",
    "model_pricing": "Catalogo de precos provider/model para estimativa de custo.",
    "project_mcps": "Junção N:M — quais MCPs estao habilitados para um projeto.",
    "project_rules": "Junção N:M — quais rules estao vinculadas a um projeto.",
    "project_skills": "Junção N:M — quais skills estao vinculadas a um projeto.",
    "project_subagents": "Junção N:M — quais subagents estao vinculados a um projeto.",
    "projects": "Projetos/workspaces (path raiz, settings, identidade).",
    "quick_actions": "Definicoes de quick-actions da UI (prompts/atalhos).",
    "rules": "Documentos de rules persistentes aplicados ao contexto do agente.",
    "schema_migrations": "Versoes de migration aplicadas pelo migrator do server.",
    "skills": "Catalogo de skills (instrucoes/bundles de tools).",
    "subagent_runs": "Registros runtime de invocacoes de subagent.",
    "subagents": "Catalogo de subagents (papel, tools, preferencias de model).",
    "thread_context_window_snapshots": "Snapshots de uso de context-window por thread.",
    "threads": "Threads de conversa escopadas a um projeto.",
    "tool_calls": "Registros de tool/function calls ligados a messages.",
    "usage_events": "Eventos de uso de tokens/custo para metering e metrics.",
}

JUNCTION = {
    "project_mcps",
    "project_rules",
    "project_skills",
    "project_subagents",
}


def mermaid_type(ctype: str) -> str:
    c = (ctype or "TEXT").upper()
    if "INT" in c:
        return "INTEGER"
    if "REAL" in c or "FLOA" in c or "DOUB" in c:
        return "REAL"
    if "BLOB" in c:
        return "BLOB"
    return "TEXT"


def extract_checks(sql: str | None) -> list[str]:
    if not sql:
        return []
    return re.findall(r"CHECK\s*\((?:[^()]|\([^()]*\))*\)", sql, flags=re.IGNORECASE)


def load_schema() -> dict:
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    tables = [
        r[0]
        for r in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
    ]
    views = [
        r[0]
        for r in cur.execute("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")
    ]
    triggers = [
        {"name": r[0], "tbl": r[1], "sql": r[2]}
        for r in cur.execute(
            "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger' ORDER BY name"
        )
    ]
    page_count = cur.execute("PRAGMA page_count").fetchone()[0]
    page_size = cur.execute("PRAGMA page_size").fetchone()[0]

    result: dict = {
        "db_path": str(DB),
        "db_size_bytes": page_count * page_size,
        "page_count": page_count,
        "page_size": page_size,
        "tables": [],
        "views": views,
        "triggers": triggers,
    }

    for t in tables:
        cols = [dict(c) for c in cur.execute(f'PRAGMA table_info("{t}")')]
        fks = [dict(f) for f in cur.execute(f'PRAGMA foreign_key_list("{t}")')]
        indexes = []
        for idx in cur.execute(f'PRAGMA index_list("{t}")'):
            idx_d = dict(idx)
            cols_i = [dict(c) for c in cur.execute(f'PRAGMA index_info("{idx_d["name"]}")')]
            indexes.append({**idx_d, "columns": cols_i})
        row_count = cur.execute(f'SELECT COUNT(*) AS n FROM "{t}"').fetchone()["n"]
        create_sql = cur.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (t,)
        ).fetchone()
        sql = create_sql["sql"] if create_sql else None
        result["tables"].append(
            {
                "name": t,
                "columns": cols,
                "foreign_keys": fks,
                "indexes": indexes,
                "row_count": row_count,
                "sql": sql,
                "checks": extract_checks(sql),
            }
        )
    con.close()
    return result


def pk_cols(t: dict) -> list[str]:
    return [c["name"] for c in t["columns"] if c["pk"]]


def write(path: Path, text: str) -> None:
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def gen_erd(data: dict) -> str:
    by_domain: dict[str, list] = defaultdict(list)
    for t in data["tables"]:
        by_domain[DOMAIN.get(t["name"], "Other")].append(t)

    lines = [
        "# ERD — lioncode.db",
        "",
        f"> Fonte: DDL live `{data['db_path']}` (somente leitura). Confianca: 🟢",
        f"> Snapshot: {datetime.now(timezone.utc).strftime('%Y-%m-%d')} | "
        f"{len(data['tables'])} tabelas | {len(data['triggers'])} triggers | "
        f"{sum(len(t['foreign_keys']) for t in data['tables'])} FKs",
        "",
        "## Visao geral (simplificada)",
        "",
        "```mermaid",
        "erDiagram",
    ]

    # Simplified: entities + relationships only (no columns)
    for t in data["tables"]:
        lines.append(f"  {t['name']} {{")
        for c in t["columns"][:6]:
            suffix = " PK" if c["pk"] else ""
            lines.append(f"    {mermaid_type(c['type'])} {c['name']}{suffix}")
        if len(t["columns"]) > 6:
            lines.append(f"    TEXT _more_ \"+{len(t['columns']) - 6} cols\"")
        lines.append("  }")

    seen_rel = set()
    for t in data["tables"]:
        for fk in t["foreign_keys"]:
            parent = fk["table"]
            child = t["name"]
            key = (parent, child, fk["from"], fk["to"])
            if key in seen_rel:
                continue
            seen_rel.add(key)
            card = "}o--||" if child in JUNCTION else "}o--||"
            # junctions are N:M via two 1:N; others are 1:N parent->child
            if child in JUNCTION:
                lines.append(f"  {parent} ||--o{{ {child} : \"{fk['to']}<-{fk['from']}\"")
            else:
                lines.append(f"  {parent} ||--o{{ {child} : \"{fk['to']}<-{fk['from']}\"")

    lines += ["```", "", "## ERDs por dominio", ""]

    for domain in sorted(by_domain.keys()):
        tables = by_domain[domain]
        names = {t["name"] for t in tables}
        lines += [f"### {domain}", "", "```mermaid", "erDiagram"]
        for t in tables:
            lines.append(f"  {t['name']} {{")
            for c in t["columns"]:
                flags = []
                if c["pk"]:
                    flags.append("PK")
                if any(fk["from"] == c["name"] for fk in t["foreign_keys"]):
                    flags.append("FK")
                if not c["notnull"] and not c["pk"]:
                    flags.append("NULL")
                flag_s = " " + ",".join(flags) if flags else ""
                lines.append(f"    {mermaid_type(c['type'])} {c['name']}{flag_s}")
            lines.append("  }")
        for t in tables:
            for fk in t["foreign_keys"]:
                if fk["table"] in names or t["name"] in names:
                    lines.append(
                        f"  {fk['table']} ||--o{{ {t['name']} : \"{fk['to']}<-{fk['from']}\""
                    )
        lines += ["```", ""]

    return "\n".join(lines)


def gen_data_dictionary(data: dict) -> str:
    total_cols = sum(len(t["columns"]) for t in data["tables"])
    total_fks = sum(len(t["foreign_keys"]) for t in data["tables"])
    total_idx = sum(len(t["indexes"]) for t in data["tables"])
    total_rows = sum(t["row_count"] for t in data["tables"])

    lines = [
        "# Data Dictionary — lioncode.db",
        "",
        f"> Fonte: DDL live `{data['db_path']}` (somente leitura). Confianca: 🟢",
        "> DDL autoritativo tambem em `packages/server/src/db/migrations/`.",
        "",
        "## Metadata",
        "",
        "| Campo | Valor |",
        "| ----- | ----- |",
        "| Engine | SQLite (better-sqlite3) |",
        "| Nome logico | `lioncode.db` |",
        f"| Path snapshot | `{data['db_path']}` |",
        f"| Tamanho logico | {data['db_size_bytes'] / 1024:.1f} KiB "
        f"({data['db_size_bytes']:,} bytes) |",
        f"| page_count × page_size | {data['page_count']} × {data['page_size']} |",
        f"| Tabelas | {len(data['tables'])} |",
        f"| Views | {len(data['views'])} |",
        f"| Triggers | {len(data['triggers'])} |",
        f"| Colunas (total) | {total_cols} |",
        f"| Foreign keys | {total_fks} |",
        f"| Indexes (incl. autoindexes) | {total_idx} |",
        f"| Row count (snapshot) | {total_rows} |",
        f"| Document date | {datetime.now(timezone.utc).strftime('%Y-%m-%d')} |",
        "",
        "## Inventario por dominio",
        "",
        "| Dominio | Tabela | Colunas | Rows | Proposito |",
        "| ------- | ------ | ------: | ---: | --------- |",
    ]

    for t in data["tables"]:
        dom = DOMAIN.get(t["name"], "Other")
        purpose = PURPOSE.get(t["name"], "")
        lines.append(
            f"| {dom} | `{t['name']}` | {len(t['columns'])} | {t['row_count']} | {purpose} |"
        )

    lines += ["", "## Tabelas (detalhe)", ""]

    for t in data["tables"]:
        pks = pk_cols(t)
        lines += [
            f"### `{t['name']}`",
            "",
            f"**Dominio:** {DOMAIN.get(t['name'], 'Other')}  ",
            f"**Proposito:** {PURPOSE.get(t['name'], '—')}  ",
            f"**PK:** {', '.join(f'`{c}`' for c in pks) if pks else '—'}  ",
            f"**Rows (snapshot):** {t['row_count']}  ",
            f"**Confianca:** 🟢",
            "",
            "#### Colunas",
            "",
            "| # | Nome | Tipo | Nullable | Default | PK |",
            "| -: | ---- | ---- | -------- | ------- | -- |",
        ]
        for c in t["columns"]:
            nullable = "NO" if c["notnull"] or c["pk"] else "YES"
            default = c["dflt_value"] if c["dflt_value"] is not None else ""
            lines.append(
                f"| {c['cid']} | `{c['name']}` | `{c['type'] or '—'}` | {nullable} | "
                f"{default} | {'YES' if c['pk'] else ''} |"
            )

        if t["foreign_keys"]:
            lines += [
                "",
                "#### Foreign keys",
                "",
                "| Coluna | Referencia | ON DELETE | ON UPDATE |",
                "| ------ | ---------- | --------- | --------- |",
            ]
            for fk in t["foreign_keys"]:
                lines.append(
                    f"| `{fk['from']}` | `{fk['table']}.{fk['to']}` | "
                    f"{fk.get('on_delete') or 'NO ACTION'} | "
                    f"{fk.get('on_update') or 'NO ACTION'} |"
                )

        if t["indexes"]:
            lines += [
                "",
                "#### Indexes",
                "",
                "| Nome | Unique | Origin | Colunas |",
                "| ---- | ------ | ------ | ------- |",
            ]
            for idx in t["indexes"]:
                cols = ", ".join(
                    c["name"]
                    for c in sorted(idx["columns"], key=lambda x: x["seqno"])
                    if c.get("name")
                )
                uniq = "YES" if idx.get("unique") else "NO"
                origin = idx.get("origin", "")
                lines.append(f"| `{idx['name']}` | {uniq} | {origin} | {cols} |")

        if t["checks"]:
            lines += ["", "#### CHECK constraints", ""]
            for ch in t["checks"]:
                lines += ["```sql", ch, "```", ""]

        if t["sql"]:
            lines += [
                "",
                "<details><summary>CREATE TABLE</summary>",
                "",
                "```sql",
                t["sql"],
                "```",
                "",
                "</details>",
                "",
            ]
        else:
            lines.append("")

    return "\n".join(lines)


def gen_relationships(data: dict) -> str:
    lines = [
        "# Relationships — lioncode.db",
        "",
        f"> Fonte: `PRAGMA foreign_key_list` + DDL live. Confianca: 🟢",
        "",
        "## Indice de FKs",
        "",
        "| From table | From column | To table | To column | Cardinalidade | ON DELETE | ON UPDATE |",
        "| ---------- | ----------- | -------- | --------- | ------------- | --------- | --------- |",
    ]

    for t in data["tables"]:
        for fk in t["foreign_keys"]:
            card = "N:M (junction)" if t["name"] in JUNCTION else "1:N"
            lines.append(
                f"| `{t['name']}` | `{fk['from']}` | `{fk['table']}` | `{fk['to']}` | "
                f"{card} | {fk.get('on_delete') or 'NO ACTION'} | "
                f"{fk.get('on_update') or 'NO ACTION'} |"
            )

    # Parent hub stats
    incoming: dict[str, list[str]] = defaultdict(list)
    for t in data["tables"]:
        for fk in t["foreign_keys"]:
            incoming[fk["table"]].append(f"{t['name']}.{fk['from']}")

    lines += [
        "",
        "## Hubs (mais FKs entrantes)",
        "",
        "| Tabela | Incoming FK refs |",
        "| ------ | ---------------: |",
    ]
    for parent, refs in sorted(incoming.items(), key=lambda x: (-len(x[1]), x[0])):
        lines.append(f"| `{parent}` | {len(refs)} |")

    lines += [
        "",
        "## Arvore parent ← children",
        "",
        "```",
    ]
    for parent in sorted(incoming.keys()):
        kids = sorted(incoming[parent])
        lines.append(parent)
        for i, kid in enumerate(kids):
            prefix = "`--" if i == len(kids) - 1 else "|--"
            lines.append(f"  {prefix} {kid}")
        lines.append("")
    lines.append("```")

    lines += [
        "",
        "## Tabelas de juncao (N:M)",
        "",
        "| Junction | Lado A | Lado B | PK composta |",
        "| -------- | ------ | ------ | ----------- |",
    ]
    for name in sorted(JUNCTION):
        t = next(x for x in data["tables"] if x["name"] == name)
        fks = t["foreign_keys"]
        a = f"`{fks[0]['table']}` via `{fks[0]['from']}`" if len(fks) > 0 else "—"
        b = f"`{fks[1]['table']}` via `{fks[1]['from']}`" if len(fks) > 1 else "—"
        pks = ", ".join(f"`{c}`" for c in pk_cols(t))
        lines.append(f"| `{name}` | {a} | {b} | {pks} |")

    lines += [
        "",
        "## Relacionamentos logicos sem FK declarada",
        "",
        "Colunas que referenciam entidades por convencao no codigo, sem `FOREIGN KEY` no DDL:",
        "",
        "| Tabela | Coluna | Referencia inferida | Confianca | Nota |",
        "| ------ | ------ | ------------------- | --------- | ---- |",
        "| `usage_events` | `thread_id` | `threads.id` | 🟡 | Indexada (`idx_usage_events_thread_order`); FK ausente no DDL live |",
        "| `subagent_runs` | `child_thread_id` | `threads.id` (PK propria) | 🟡 | PK e ancora do child thread; so `parent_thread_id` tem FK |",
        "| `feature_build_rounds` | `sprint_index` | `feature_build_sprints.sprint_index` | 🟡 | Compoe identidade junto com `build_id`; FK so em `build_id` |",
        "",
        "## Cardinalidades resumidas",
        "",
        "- **1:N** dominantes: `projects` → threads/catalog bindings/usage/codegraph/pipelines/builds; `threads` → messages/diffs/logs/tool_calls/pipelines/builds.",
        "- **1:1**: `thread_context_window_snapshots.thread_id` → `threads.id`; `git_review_baselines.thread_id` UNIQUE → `threads.id`.",
        "- **N:M** via junction: projects↔skills, projects↔mcps, projects↔rules, projects↔subagents.",
        "",
    ]
    return "\n".join(lines)


def gen_business_rules(data: dict) -> str:
    lines = [
        "# Business Rules (no banco) — lioncode.db",
        "",
        f"> Fonte: DDL live + triggers. Confianca: 🟢 (CHECK/trigger) | 🟡 (inferido de naming/seed)",
        "",
        "## Triggers",
        "",
        "Padrao unico: bump de `updated_at` em UPDATE quando o valor nao mudou "
        "(evita overwrite explicito).",
        "",
        "| Nome | Tabela | Evento | Condicao | Acao |",
        "| ---- | ------ | ------ | -------- | ---- |",
    ]
    for tr in data["triggers"]:
        lines.append(
            f"| `{tr['name']}` | `{tr['tbl']}` | AFTER UPDATE | "
            f"`NEW.updated_at = OLD.updated_at` | "
            f"`UPDATE ... SET updated_at = datetime('now')` |"
        )

    lines += ["", "### DDL dos triggers", ""]
    for tr in data["triggers"]:
        lines += [f"#### `{tr['name']}`", "", "```sql", tr["sql"] or "", "```", ""]

    # Collect checks
    lines += ["## CHECK constraints", ""]
    any_check = False
    for t in data["tables"]:
        if not t["checks"]:
            continue
        any_check = True
        lines += [f"### `{t['name']}`", ""]
        for ch in t["checks"]:
            lines += ["```sql", ch, "```", ""]
    if not any_check:
        lines.append("_Nenhum CHECK encontrado via regex no CREATE TABLE._")
        lines.append("")

    lines += [
        "## Uniques e identidade de negocio",
        "",
        "| Tabela | Constraint / Index UNIQUE | Significado |",
        "| ------ | ------------------------- | ----------- |",
    ]
    for t in data["tables"]:
        for idx in t["indexes"]:
            if not idx.get("unique"):
                continue
            cols = ", ".join(
                c["name"]
                for c in sorted(idx["columns"], key=lambda x: x["seqno"])
                if c.get("name")
            )
            origin = idx.get("origin", "")
            if origin == "pk":
                continue
            meaning = {
                "path": "Um path de projeto so pode existir uma vez.",
                "name": "Nome de catalogo globalmente unico.",
                "provider, model": "Par provider+model unico no catalogo de precos.",
                "thread_id": "Uma baseline de review por thread.",
                "project_id, slug": "Slug de feature build unico por projeto (active).",
                "thread_id, seq": "Sequencia de mensagem unica por thread.",
            }.get(cols, "Unicidade estrutural.")
            lines.append(f"| `{t['name']}` | `{idx['name']}` ({cols}) | {meaning} |")

    lines += [
        "",
        "## Cascades (integridade referencial)",
        "",
        "Todas as FKs declaradas usam `ON DELETE CASCADE` e `ON UPDATE NO ACTION`. "
        "Apagar um `projects` remove threads, bindings de catalogo, usage, pipelines e builds ligados. "
        "Apagar um `threads` remove messages, tool_calls, diffs, logs, baselines, snapshots e runs filhos.",
        "",
        "## Seeds e marcadores",
        "",
        "- `data_seeds`: garante aplicacao idempotente de seeds de catalogo (skills/rules/subagents/etc.).",
        "- `schema_migrations`: controla versao do schema; nao deve ser editado manualmente.",
        "- Catalogos (`skills`, `rules`, `subagents`, `commands`, `model_pricing`) carregam dados de bootstrap via migrations/seeds.",
        "",
        "## Views / materialized views",
        "",
        "_Nenhuma view no snapshot live._",
        "",
    ]
    return "\n".join(lines)


def gen_procedures(data: dict) -> str:
    return "\n".join(
        [
            "# Procedures & Functions — lioncode.db",
            "",
            f"> Fonte: `sqlite_master` live. Confianca: 🟢",
            "",
            "## Resultado",
            "",
            "SQLite neste banco **nao possui** stored procedures nem user-defined functions "
            "persistidas no schema. A logica de negocio vive no processo Node "
            "(`better-sqlite3` + repositorios em `packages/server/src/db/repositories/`).",
            "",
            "## Equivalentes no lado aplicacao",
            "",
            "| Conceito | Onde | Nota |",
            "| -------- | ---- | ---- |",
            "| Migrations | `packages/server/src/db/migrations/` | DDL versionado (001…062+) |",
            "| Repositories | `packages/server/src/db/repositories/` | CRUD tipado e queries |",
            "| Triggers | 8× `trg_*_updated_at` | Unico SQL procedural no DB |",
            "| Seeds | migrations + `data_seeds` | Catalogos iniciais |",
            "",
            f"Views: {len(data['views'])} | Triggers: {len(data['triggers'])} | "
            f"Tabelas: {len(data['tables'])}",
            "",
        ]
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    data = load_schema()
    # cache for debugging inside reversa folder only
    (OUT / "_schema_snapshot.json").write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    write(OUT / "erd.md", gen_erd(data))
    write(OUT / "data-dictionary.md", gen_data_dictionary(data))
    write(OUT / "relationships.md", gen_relationships(data))
    write(OUT / "business-rules.md", gen_business_rules(data))
    write(OUT / "procedures.md", gen_procedures(data))
    print(
        f"OK: {len(data['tables'])} tables, "
        f"{sum(len(t['foreign_keys']) for t in data['tables'])} FKs, "
        f"{len(data['triggers'])} triggers -> {OUT}"
    )


if __name__ == "__main__":
    main()

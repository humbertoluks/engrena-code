# Relatório de Confiança — sistema legado

> Gerado pelo Revisor em 2026-07-28  
> Nível de documentação: **essencial** (relatório simplificado)

---

## Resumo Geral

| Nível | Quantidade | Percentual |
|-------|-----------|------------|
| 🟢 CONFIRMADO | 1975 | 90.3% |
| 🟡 INFERIDO   | 131 | 6.0% |
| 🔴 LACUNA     | 80 | 3.7% |
| **Total**     | 2186 | 100% |

**Confiança geral:** 93.3% (soma de 🟢 + metade dos 🟡)

Specs revisadas: **32 units** (96 arquivos canônicos) + artefatos globais.  
Revisão cruzada Codex: **não** (nível essencial).

---

## Por Spec

| Spec | 🟢 | 🟡 | 🔴 | Confiança |
|------|----|----|-----|-----------|
| `shell` | 70 | 7 | 3 | 92% |
| `shell/bootstrap-janela` | 69 | 4 | 2 | 95% |
| `shell/ipc-sessao` | 48 | 4 | 1 | 94% |
| `shared` | 56 | 3 | 3 | 93% |
| `server-core` | 58 | 8 | 3 | 90% |
| `server-core/http-ws-bootstrap` | 60 | 7 | 3 | 91% |
| `server-core/autenticacao-sessao` | 65 | 6 | 3 | 92% |
| `vault` | 68 | 3 | 3 | 94% |
| `vault/unlock-cofre` | 66 | 1 | 2 | 96% |
| `providers` | 57 | 6 | 3 | 91% |
| `providers/dispatch-provider` | 60 | 5 | 3 | 92% |
| `runner` | 79 | 5 | 3 | 94% |
| `runner/turno-dispatch` | 67 | 2 | 1 | 97% |
| `runner/feature-pipeline` | 62 | 3 | 2 | 95% |
| `runner/feature-build` | 65 | 1 | 2 | 96% |
| `git` | 78 | 3 | 2 | 96% |
| `git/commit-pr-worktree` | 67 | 2 | 1 | 97% |
| `mcp` | 65 | 6 | 3 | 92% |
| `mcp/catalogo-vinculo` | 49 | 5 | 2 | 92% |
| `mcp-servers` | 64 | 3 | 3 | 94% |
| `mcp-servers/secret-wrapper` | 50 | 3 | 2 | 94% |
| `mcp-servers/bridge-subagents` | 57 | 6 | 3 | 91% |
| `memory` | 57 | 4 | 3 | 92% |
| `memory/gravar-e-dreaming` | 61 | 3 | 3 | 93% |
| `codegraph` | 65 | 3 | 2 | 95% |
| `codegraph/indexar-graph` | 60 | 4 | 2 | 94% |
| `metrics` | 61 | 3 | 3 | 93% |
| `terminal` | 60 | 3 | 2 | 95% |
| `terminal/pty-e-exec` | 50 | 3 | 3 | 92% |
| `renderer` | 61 | 7 | 3 | 91% |
| `renderer/vault-gate` | 52 | 5 | 3 | 91% |
| `renderer/workspace-principal` | 68 | 3 | 3 | 94% |

---

## Lacunas Pendentes 🔴

Nenhuma lacuna **crítica** (bloqueante de reimplementação) permanece após a revisão.

As 🔴 restantes (~80 marcações) são de completude do nível essencial: matrizes PermissionBroker finas, CSP detalhado, timeouts por provider, textos i18n, etc. Não impedem reimplementar o núcleo a partir do código + specs.

Pergunta crítica resolvida: ver `questions.md#pergunta-1` (`pr-merged`/`pr-closed` → só espelhar enum).

---

## Recomendações

- [x] Corrigir contrato unlock (token via IPC, não body HTTP) — feito
- [x] Alinhar rotas MCP link/unlink e journal clear/reset — feito
- [x] Fechar escopo `pr-merged`/`pr-closed` com stakeholder — feito (só enum)
- [ ] Se subir para doc_level `completo`: gerar matrizes PermissionBroker e OpenAPI

---

## Histórico de Reclassificações

| De | Para | Afirmação | Evidência |
|----|------|-----------|-----------|
| 🟢 (errado) | 🟢 corrigido | Token no body de `POST /vault/unlock` | `shared/src/vault.ts`; `vault-unlock.ts` — só `{ unlocked }` |
| 🔴 | 🟢 | Header HTTP de sessão | `session-auth.ts:19` → `x-sistema-legado-session` |
| 🟡 | 🟢 | Campo `workspace` no unlock | `vault-unlock.ts` `requireNonEmptyString` |
| 🟢 (errado) | 🟢 corrigido | MCP link `POST .../link` | `routes/mcps.ts` → `PUT /projects/:id/mcps/:mcpId` |
| 🟢 (errado) | 🟢 corrigido | Journal clear `POST .../clear` | `project-memory.ts` → `DELETE /projects/:id/journal` |
| 🟡 | 🟢 | `pending_resume` + onIdle | `pipeline-scheduler.ts` |
| 🔴 | 🟢 | Enum `codegraph_runs.status` | migration `043_codegraph.ts` |
| 🔴 | 🟢 | Versão pinada CodeGraph | `installer.ts` `1.4.1` |
| 🔴 | 🟢 | Shell Windows vs POSIX | `terminal/pty.ts` |
| 🔴 | 🟢 | Path loopback `/mcp-spec` | `runner/mcp-secrets.ts` |
| 🔴 | 🟢 | Escopo `pr-merged`/`pr-closed` | Validação humana: só espelhar enum |

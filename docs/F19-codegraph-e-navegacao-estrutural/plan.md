# Plano de Implementação: F19. CodeGraph e Navegação Estrutural

**Pré-requisitos:**
- Herdar stack de `docs/_shared/codebase-patterns.md` e padrão MCP F12
- Mover `typescript` de `devDependencies` para `dependencies` (única mudança de packaging)
- Sem variáveis de ambiente novas
- `ui.md`/`copy.md` de F19 existem — fase visual segue anatomia/copy; slots CLI externa da fonte ficam fora do escopo Engrena F19 (ver `ui.md` Escopo)

### Fase 1: Índice em disco e consultas

**1. Store e meta do CodeGraph** - Criar a camada de paths sob `userData/codegraph/<projectId>`, leitura/escrita atômica de `index.json`/`meta.json`, TTL de 24h e cálculo de status (`indexed` / `indexing` / `unsupported` / `missing`).

**2. Indexador TS/JS + fallback textual** - Implementar walk do `project.path` (mesmos ignores/teto do listagem de arquivos do workspace), parse AST via TypeScript Compiler API para extensões suportadas, e indexação textual para o restante.

**3. API de query** - Expor find definition, find references e module deps sobre o índice carregado, com respostas estáveis para “não encontrado” sem lançar erro duro.

### Fase 2: MCP e ciclo de turno

**4. Tools no MCP `engrenacode`** - Registrar as três tools `repo_graph_*` condicionadas à flag de índice, somente leitura, e estender a montagem do MCP interno para aceitar o path do índice.

**5. Ensure no dispatch** - No início do turno, garantir índice fresco (ausente ou expirado) antes do spawn do provider e passar o path ao MCP; falha de indexação degrada sem abortar o turno.

**6. Packaging** - Declarar `typescript` como dependência de runtime para o processo main/MCP empacotado.

### Fase 3: Incremental, HTTP e contrato UI

**7. Reindex no accept** - Após accept bem-sucedido de diff, reindexar de forma best-effort o arquivo afetado sob o root do projeto, sem falhar o accept.

**8. Endpoints status e reindex** - Adicionar handler HTTP com GET de status e POST de reindex completo, com o mesmo guard de sessão/vault dos demais handlers, registrado no server loopback.

**9. Cliente frontend** - Criar o service de renderer que consome status/reindex para o indicador do Repo Harness quando o design existir.

### Fase 4: Validação e fechamento

**10. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + subprocesso MCP + HTTP + smoke). Confirmar os 4 ACs de F19 e o cross-feature das tools no MCP `engrenacode`. Verificar light/dark, anatomia vs `ui.md` e strings vs `copy.md` (sem slots CLI fora de escopo). Gate: suite e build verdes.

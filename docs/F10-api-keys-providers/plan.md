# Plano de Implementação: F10. API Keys dos Providers

**Pré-requisitos:**
- Herda stack/tooling do codebase atual (Node/TypeScript ESM, Vitest, Electron + HTTP loopback `127.0.0.1:5174`) — sem novo dep obrigatória
- Sem variáveis de ambiente novas de build; runtime injeta `ANTHROPIC_API_KEY`/`CODEX_API_KEY` só no processo filho spawnado (não no processo principal)
- `docs/F10-api-keys-providers/ui.md` e `copy.md` já existem — fonte de verdade de anatomia/copy

### Fase 1: Vault e validação

**1. Validadores de provider key** - Criar `src/services/vault/provider-keys.ts` com validação pura (prefixo/whitespace/tamanho) para Claude (`sk-ant-`), Codex (`sk-`/`sk-codex-`) e Minimax (loose), espelhando o padrão de `github-token.ts`. Cobrir com testes table-driven.

**2. Convenção de secrets no vault** - Adotar `keys:claude`, `keys:codex`, `keys:minimax` como novas chaves no vault existente (F01), sem mudança de schema.

### Fase 2: Endpoints de configuração

**3. Salvar keys dos providers** - Adicionar `POST /api/config/keys/save` em `config-handler.ts`: valida cada campo presente (validators da Fase 1), preserva secret anterior quando campo vazio, persiste via `vaultService`, retorna presença atualizada por provider.

**4. Extender status e guard de modo Claude** - `GET /api/config/status` passa a incluir presença de keys e disponibilidade por provider (`providers.*.available/reason`). `POST /api/config/claude/mode` ganha guard: rejeita `api-key` sem `keys:claude` salva.

**5. Testar conexão ciente de modo** - Criar `claude-probe.ts` reusando o mecanismo de spawn já usado pelo runner; `POST /api/config/claude/test` passa a rodar o probe certo por `claude:mode` (subscription: check atual; api-key: spawn com `ANTHROPIC_API_KEY` injetado), distinguindo sucesso, falha, rate limit e timeout.

### Fase 3: Runner — Minimax e injeção de API key

**6. Ampliar ThreadProvider** - Incluir `'minimax'` no tipo `ThreadProvider` (`threads.ts`) e no array de validação runtime de `threads-handler.ts`; sem migração de banco (coluna já é `TEXT` livre).

**7. Driver HTTP para Minimax** - Criar `minimax-driver.ts` com uma execução de turno via chamada HTTP à API de Chat Completion da Minimax (sem loop de tool-use nesta fase, ver spec §3.2), com tratamento de erro de rede/resposta malformada.

**8. Branch de execução e injeção de key no dispatch** - `cli-driver.ts` passa a distinguir providers `cli` (spawn) de `http` (delega a `minimax-driver.ts`) e aceita uma API key opcional para injetar como env no spawn (Claude modo api-key, Codex). `dispatch.ts` resolve a key certa do vault por `thread.provider`/`claude:mode` antes de chamar o runner.

### Fase 4: UI — `#configuracao` e composer

**9. Primitives compartilhados** - Extrair `Card`, `Field` (label + input password + reveal + hint/erro) e `Badge` para `src/renderer/components/`, substituindo os equivalentes locais de `ConfiguracaoScreen.tsx` usados pelos novos cards.

**10. ClaudeCard real + KeysCard** - Remover o `disabled: true` hardcoded do segmento "API key"; habilitar conforme presença de `keys.claude` no status. Adicionar `KeysCard` com as três rows (Claude → Codex → Minimax, ordem de `ui.md`), reveal, badges e save parcial, seguindo anatomia/tokens/copy de `ui.md`/`copy.md`.

**11. Composer ciente de provider por key** - `TaskComposer.tsx` inclui Minimax no seletor de provider e passa a gatear disponibilidade via `configStatus.providers[provider]` (em vez de só `clis`), exibindo o motivo (`composer.*.unavailable`) quando indisponível.

### Fase 5: Validação e fechamento

**12. Validação e fechamento** - Rodar a estratégia de testes da spec (unitário: validators, config-handler, claude-probe, minimax-driver, cli-driver, dispatch; smoke manual 7.2). Confirmar os quatro critérios de aceitação PRD §9 F10 e os critérios de Integração Cross-Feature listados na spec §7.3. Conferir aceite visual light/dark/system vs `ui/api-keys-referencia.png` e strings vs `copy.md`. Gate: suite verde + `pnpm build`.

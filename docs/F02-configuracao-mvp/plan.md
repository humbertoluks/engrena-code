# F02. Configuração MVP — Plano de Implementação

**Feature:** F02  
**Complexidade:** Médio  
**Fases:** 4  
**Status:** Pronto para dev

---

## Pré-requisitos

- ✓ F01 (Vault + Session) implementado
- ✓ F01.1 (Design System + Tema) implementado
- ✓ TypeScript + React + Electron + Tailwind setup funcionando
- ✓ HTTP server loopback (porta 5174) ativo

---

## Fase 1: Setup de Backend e Estado

**Objetivo:** Arquitetura HTTP + hook de estado React + vault schema pronto.

### 1. Criar `src/services/http/config-handler.ts`

Handler HTTP com endpoints GET `/api/config/status` e POST `/api/config/*/{claude,clis,prompt,github}/`. Validação de session token via middleware F01. Respostas JSON com tipos TypeScript. Referência: `src/services/http/unlock-handler.ts`.

### 2. Criar `packages/renderer/src/services/configuracao-service.ts`

Cliente HTTP (axios) para todos os endpoints F02. Funções tipadas: `getStatus()`, `setClaudeMode()`, `testClaude()`, `testClis()`, `savePrompt()`, `restorePrompt()`, `saveGithubToken()`. Retry de rede. Referência: patterns axios já em `package.json`.

### 3. Criar `packages/renderer/src/hooks/useConfiguracao.ts`

Zustand store ou hook com estado completo (ConfigState). Inicializa via `getStatus()` ao mount. Ações: `setClaudeMode()`, `setClaudeSubscriptionOk()`, `setClis()`, `setPromptCurrent()`, `setPromptIsDefault()`, `setGithubTokenPresent()`, `setLoading()`, `setError()`, `setSuccess()`. Estrutura espelha spec section 2.2.

---

## Fase 2: Card Claude + Testes

**Objetivo:** Primeiro card funcional (modo segmentado, teste de conexão, feedback).

### 4. Criar `packages/renderer/src/components/ConfigCard.tsx`

Wrapper card reutilizável: `rounded-lg border border-border bg-surface p-lg`. Props: `title`, `subtitle?`, `children`, `loading?`, `error?`, `success?`. Dot de status opcional (9×9). Referência: design tokens F01.1.

### 5. Criar `packages/renderer/src/components/SegmentedControl.tsx`

2+ buttons com `aria-pressed`; um selecionado por vez. Props: `options`, `value`, `onChange`. Aplicar: Assinatura | API key. Estilos: `bg-surface-2` ou `bg-accent` conforme seleção.

### 6. Implementar Card Claude (ConfiguracaoScreen)

Montar card Claude com: subtítulo (copy), segmented (Assinatura/API key), status message (hardcoded per modo), CTA "Testar conexão", feedback inline. Mode switch chama `setClaudeMode()` → POST `/api/config/claude/mode` → update vault + estado + feedback "modo alterado".

### 7. Implementar POST /api/config/claude/mode Handler

Backend: recebe `{mode}`, valida enum, grava `claude:mode` no vault, retorna modo atualizado + `subscriptionOk` status. Referência: `vaultService.setSecret()`.

### 8. Implementar POST /api/config/claude/test Handler

Backend: testa Claude SDK com turno mínimo (ex.: listar modelos). Captura 429 rate limit. Retorna `{success, detail}`. Caso: sem login, assinatura não detectada → `success: false, detail: "…rode `claude`…"`.

### 9. Wiring "Testar Conexão"

Frontend: CTA → `setLoading('test')` → POST `/api/config/claude/test` → `setClaudeSubscriptionOk()` + `setSuccess()/setError()` + `setLoading(null)`. Feedback inline com `InlineFeedback` component.

---

## Fase 3: CLIs + Prompt + GitHub

**Objetivo:** 3 cards restantes com state + endpoints.

### 10. Implementar POST /api/config/clis/test Handler

Backend: exec `claude --version`, `codex --version`, `kimi --version` em paralelo. Detectar instalado (exit 0), logado (parse CLI output ou arquivo de config). Retorna `{results: {...}}`. Erro em uma CLI não falha o resto.

### 11. Wiring "Testar Conexões" (CLIs Card)

Frontend: CTA → `setLoading('clis-test')` → POST `/api/config/clis/test` → `setClis()` + feedback "X/3 logados". Render 3 rows (Claude, Codex, Kimi) com dot (verde=logado, âmbar=instalado não logado, cinza=não instalado) + label + hint.

### 12. Implementar Card Prompt Global

Textarea (controlled, state.prompt.current). Botões: "Salvar prompt global", "Restaurar padrão". Validação dirty (disable save se limpo). Badge: "Padrão" | "Customizado". Dot: "Ativo" | "Desligado" (se vazio).

### 13. Implementar POST /api/config/prompt/save Handler

Backend: recebe `{prompt}`, valida tamanho (<50k), grava `prompt:global` no vault, retorna `{isDefault, message}`. Null = padrão.

### 14. Implementar POST /api/config/prompt/restore Handler

Backend: grava `prompt:global = null` no vault, retorna padrão. Wiring: CTA "Restaurar" → confirm se custom → POST → feedback.

### 15. Implementar Card GitHub Token

Input password com reveal button (eye icon). Label/hint per design. CTA "Salvar token". Validação ANTES de submit: sem espaços, ≥8 chars, prefixo válido. Se inválido: erro inline, bloqueia submit.

### 16. Implementar POST /api/config/github/token Handler

Backend: validação de formato (local; sem ping remoto). Grava `github:token` no vault. Retorna `{saved: true, message}` ou erro 400 com reason.

---

## Fase 4: Integração + Polish

**Objetivo:** Agregação de status (F04 ready), testes E2E, polishing UI.

### 17. Implementar GET /api/config/status Handler

Backend: lê vault (`claude:mode`, `prompt:global`, `github:token`), testa CLIs em background (ou por cache), retorna objeto agregado. Usado por F04 dashboard e F03 workspace.

### 18. Wiring GET /api/config/status ao Mount de ConfiguracaoScreen

Frontend: mount → `useEffect(() => { getStatus() }, [])`. Hydra `useConfiguracao` state. Loading state enquanto fetch. Error fallback se falhar.

### 19. Integração com Tema F01.1

Aplicar design tokens em todas as classes: `text-fg`, `bg-surface`, `border-border`, `text-accent`, `focus:ring-accent`. Sem hexes fora do Design Lock. Teste light + dark.

### 20. Componentes Auxiliares

`StatusDot.tsx` (9×9, cores: verde, âmbar, cinza, neutro). `InlineFeedback.tsx` (feedback success/error/loading inline, `role=status`/`role=alert`). `ButtonPrimary.tsx`, `ButtonSecondary.tsx` reutilizáveis. Referência: componentes F01.1 já existentes.

### 21. Copy 100% (Literal)

Aplicar tabela de copy de ui.md (marca EngrenaCode). Validar: títulos de card, botões, hints, feedbacks, placeholders. Ver ui.md section "Copy".

### 22. Testes de Aceitação

Testes unitários: validação de token GitHub (formato, espaços, tamanho). Testes de integração: E2E da tela (mount → status → modo switch → teste Claude → feedback). Testes de componentes: SegmentedControl, StatusDot, InlineFeedback.

### 23. Validação contra PRD

✓ Card Claude com detecção de assinatura + teste com rate limit.  
✓ Card CLIs com instalado/logado + teste 3 CLIs.  
✓ Card Prompt com save/restore + padrão.  
✓ Card GitHub com validação local, sem ping remoto.  
✓ Nenhum bloco F10 (API keys) ou STT ou Grok/CodeGraph no Central.

### 24. Setup para F03/F04 Integration

Documentar:
- Como F03 consome `getStatus()` para saber se providers estão ok
- Como F03 injeta `prompt:global` em turnos
- Como F04 usa `/api/config/status` para dashboard health widget
- Como F03 usa `github:token` em fluxo git (commit, push, PR)

---

## Fase 5: Validação e fechamento

**25. Validação e fechamento** - Executar a estratégia de testes da spec (unitário Vitest + smoke API/UI em `smoke-results.md`). Confirmar critérios de aceitação F02 Central. Verificar light/dark e copy vs `ui.md`. Gate: `pnpm test` e `tsc -b` verdes. Cross-feature F03/F04 permanece deferred.


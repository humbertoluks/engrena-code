# F02. Configuração MVP — Especificação Técnica

**Feature ID:** F02  
**Nome:** Configuração MVP  
**Status:** Especificação  
**Última atualização:** 2026-07-30

---

## 1. Escopo

### Incluído (Escopo Central)

Configuração de 4 provedores/sistemas críticos para o workspace F03 funcionar:

1. **Claude (Autenticação por Assinatura)**
   - Detectar `~/.claude.json` (Claude Code CLI login)
   - UI segmentado: Assinatura | API key (API key desabilitada até F10)
   - "Testar conexão" com turno mínimo via Claude SDK
   - Feedback: autenticado | sem login | modo não disponível

2. **CLIs de Assinatura (Claude, Codex, Kimi)**
   - Auto-discover em PATH via shebang + `--version`
   - Report: instalado/não | logado/não (status em tempo de exec)
   - "Testar conexões" paralela (3 CLIs)
   - Hints de login conforme status

3. **System Prompt Global**
   - Textarea com prompt customizado ou padrão EngrenaCode
   - Salvar (dirty check) | Restaurar padrão (confirm se custom)
   - Badge: "Padrão" | "Customizado"
   - Dot de status: Ativo | Desligado (se vazio)

4. **Token GitHub (PAT)**
   - Input password com reveal button
   - Validação local: formato (prefixos `ghp_`, `github_pat_`, etc), sem espaços, ≥8 chars
   - Save SEM ping remoto
   - Feedback: salvo localmente

### Adiado (Escopo Completo)

- Caminho manual de CLI + "Salvar caminhos" (F02 Completo)
- Bloco "API keys dos providers" (Claude API key, Codex, Minimax) → F10
- Transcrição por voz (STT) → Fora do MVP
- Linhas CLI Grok, CodeGraph → Fora (Kimi em Central, conforme PRD)

---

## 2. Componentes e Arquitetura

### 2.1 Component Overview

```
packages/renderer/
├── screens/
│   └── ConfiguracaoScreen.tsx         # Página principal; layout coluna centrada
├── components/
│   ├── ConfigCard.tsx                 # Wrapper card (rounded-lg, border, p-lg)
│   ├── StatusDot.tsx                  # 9×9 dot, conectado/ativo/desligado
│   ├── SegmentedControl.tsx           # Assinatura | API key
│   ├── ButtonPrimary.tsx              # CTA save/test (acento, primário)
│   ├── ButtonSecondary.tsx            # Restaurar padrão
│   ├── InlineFeedback.tsx             # Estado success/error/loading inline
│   └── (reusos de F01.1: Button, Input, Textarea, Field)
├── hooks/
│   └── useConfiguracao.ts             # State management: claude, clis, prompt, github
└── services/
    └── configuracao-service.ts        # Camada HTTP para /api/config/*

packages/renderer/src/services/
├── configuracao-service.ts            # HTTP client para endpoints F02
└── (existentes: vault, unlock, etc)

src/services/http/
└── config-handler.ts                  # Endpoints GET /api/config/*, POST /api/config/*/save
                                        # (novo; ao lado de unlock-handler.ts)
```

### 2.2 Estado React (useConfiguracao Hook)

```typescript
interface ConfigState {
  // Claude
  claude: {
    mode: 'subscription' | 'api-key'
    subscriptionOk: boolean | null           // null = loading, true = detectado, false = não logado
    apiKeyPresent: boolean
  }
  
  // CLIs
  clis: {
    claude: { installed: boolean; loggedIn: boolean; path?: string }
    codex: { installed: boolean; loggedIn: boolean; path?: string }
    kimi: { installed: boolean; loggedIn: boolean; path?: string }
  }
  
  // Prompt Global
  prompt: {
    current: string | null              // conteúdo customizado, ou null = padrão
    default: string                     // prompt padrão EngrenaCode (hardcoded ou carregado)
    isDefault: boolean
    isDirty: boolean
  }
  
  // GitHub
  github: {
    tokenPresent: boolean
    tokenLastSaved: number              // timestamp local
  }
  
  // UI
  loading: { test?: boolean; save?: boolean; restore?: boolean }
  errors: { test?: string; save?: string; restore?: string }
  success: { test?: string; save?: string }
}
```

### 2.3 Fluxo de Dados

```
[ConfiguracaoScreen]
    ├─ mount: GET /api/config/status
    │   └─ hydrate useConfiguracao state
    │
    ├─ [Claude Card]
    │   ├─ segmented control (mode switch)
    │   │   └─ POST /api/config/claude/mode { mode: 'subscription' | 'api-key' }
    │   │       └─ update vault + state.claude.mode
    │   │
    │   └─ CTA "Testar conexão"
    │       └─ POST /api/config/claude/test
    │           └─ backend: turno mínimo via Claude SDK
    │           └─ update state.claude.subscriptionOk + feedback
    │
    ├─ [CLIs Card]
    │   └─ CTA "Testar conexões"
    │       └─ POST /api/config/clis/test
    │           └─ backend: exec --version + check login status
    │           └─ update state.clis + feedback "X/3 CLIs logados"
    │
    ├─ [Prompt Card]
    │   ├─ textarea: edit state.prompt.current + isDirty
    │   ├─ CTA "Salvar prompt global"
    │   │   └─ POST /api/config/prompt/save { prompt: string | null }
    │   │       └─ vault: setSecret('prompt:global', ...)
    │   │       └─ update state.prompt.isDefault, isDirty, feedback
    │   │
    │   └─ CTA "Restaurar padrão"
    │       └─ POST /api/config/prompt/restore
    │           └─ vault: setSecret('prompt:global', null)
    │           └─ update state + feedback
    │
    └─ [GitHub Card]
        └─ input + CTA "Salvar token"
            └─ validação local (format + length)
            ├─ se inválido: feedback error (não submit)
            └─ se ok: POST /api/config/github/token { token: string }
                └─ vault: setSecret('github:token', ...)
                └─ feedback success (local, sem validação remota)
```

---

## 3. API Contracts

### 3.1 GET /api/config/status

**Descrição:** Retorna status agregado de configuração. Alimenta dashboard F04.

**Requisição:**
```
GET /api/config/status
Authorization: Bearer <session-token>        # F01 session middleware
```

**Resposta 200:**
```json
{
  "claude": {
    "mode": "subscription",
    "subscriptionOk": true
  },
  "clis": {
    "claude": { "installed": true, "loggedIn": true, "path": "/usr/local/bin/claude" },
    "codex": { "installed": false, "loggedIn": false },
    "kimi": { "installed": true, "loggedIn": false }
  },
  "prompt": {
    "isDefault": false,
    "isEmpty": false
  },
  "github": {
    "tokenPresent": true
  }
}
```

**Resposta 401:** Cofre travado (F01 session middleware)  
**Resposta 500:** Erro ao carregar config

---

### 3.2 POST /api/config/claude/mode

**Descrição:** Muda modo Claude entre assinatura e API key. Grava no vault imediatamente (UX fluida).

**Requisição:**
```json
POST /api/config/claude/mode
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "mode": "subscription" | "api-key"
}
```

**Resposta 200:**
```json
{
  "mode": "subscription",
  "subscriptionOk": true
}
```

**Resposta 400:** Modo inválido  
**Resposta 401:** Não autenticado  
**Resposta 500:** Erro ao gravar vault

---

### 3.3 POST /api/config/claude/test

**Descrição:** Testa conexão do Claude via SDK (turno mínimo).

**Requisição:**
```json
POST /api/config/claude/test
Authorization: Bearer <session-token>
```

**Resposta 200:**
```json
{
  "success": true,
  "detail": "Conectado com sucesso."
}
```

**Resposta 200 (sem login):**
```json
{
  "success": false,
  "detail": "Assinatura selecionada, mas não detectei login do Claude Code. Rode `claude` no terminal para autenticar."
}
```

**Resposta 429:** Rate limit  
```json
{
  "success": false,
  "detail": "Rate limit. Tente novamente em 60s.",
  "retryAfterSeconds": 60
}
```

**Resposta 500:** Erro ao testar

---

### 3.4 POST /api/config/clis/test

**Descrição:** Testa 3 CLIs (Claude, Codex, Kimi) em paralelo.

**Requisição:**
```json
POST /api/config/clis/test
Authorization: Bearer <session-token>
```

**Resposta 200:**
```json
{
  "results": {
    "claude": { "installed": true, "loggedIn": true, "path": "/usr/local/bin/claude" },
    "codex": { "installed": true, "loggedIn": true, "path": "/usr/local/bin/codex" },
    "kimi": { "installed": false, "loggedIn": false }
  },
  "summary": "Teste concluído: 2/3 CLIs logados."
}
```

**Resposta 500:** Erro ao testar CLIs

---

### 3.5 POST /api/config/prompt/save

**Descrição:** Salva prompt customizado ou `null` (padrão).

**Requisição:**
```json
POST /api/config/prompt/save
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "prompt": "Você é um assistente..." | null
}
```

**Resposta 200:**
```json
{
  "isDefault": false,
  "message": "Prompt global salvo. Vale a partir do próximo turno de qualquer provider."
}
```

**Resposta 200 (padrão restaurado):**
```json
{
  "isDefault": true,
  "message": "Prompt global restaurado ao padrão do EngrenaCode."
}
```

**Resposta 400:** Prompt muito longo (>50k chars)  
**Resposta 401:** Não autenticado  
**Resposta 500:** Erro ao gravar vault

---

### 3.6 POST /api/config/prompt/restore

**Descrição:** Restaura prompt padrão (POST por convenção REST, poderia ser DELETE).

**Requisição:**
```json
POST /api/config/prompt/restore
Authorization: Bearer <session-token>
```

**Resposta 200:**
```json
{
  "isDefault": true,
  "message": "Prompt global restaurado ao padrão do EngrenaCode."
}
```

---

### 3.7 POST /api/config/github/token

**Descrição:** Valida e salva token GitHub localmente (sem ping remoto).

**Requisição:**
```json
POST /api/config/github/token
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "token": "ghp_xxxxxxxxxxxxxxxxxxxx" | ""
}
```

**Validação Local:**
- Sem espaços
- ≥ 8 caracteres
- Prefixo: `ghp_`, `github_pat_`, `gho_`, `ghu_`, `ghs_`, `ghr_`
- Caso vazio: limpa token (válido)

**Resposta 200:**
```json
{
  "saved": true,
  "message": "Token salvo localmente (não validado com o GitHub)."
}
```

**Resposta 400 (formato):**
```json
{
  "error": "validation_error",
  "message": "Formato inválido. Esperado: ghp_… ou github_pat_…"
}
```

**Resposta 400 (espaços):**
```json
{
  "error": "validation_error",
  "message": "A chave não pode conter espaços."
}
```

**Resposta 400 (curto):**
```json
{
  "error": "validation_error",
  "message": "Chave muito curta para ser válida."
}
```

**Resposta 401:** Não autenticado  
**Resposta 500:** Erro ao gravar vault

---

## 4. Data Model

### 4.1 Vault Schema (Flat)

Todas as chaves armazenadas via `vaultService.setSecret(key, value)`:

| Chave | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `claude:mode` | string | `"subscription"` \| `"api-key"` | `"subscription"` |
| `prompt:global` | string \| null | Prompt customizado ou null (padrão) | `"Você é um assistante..."` |
| `github:token` | string | PAT validado | `"ghp_xxxx..."` |

**Nota:** CLI paths e status de login (instalado/logado) são computados em tempo de execução via `exec --version` e verificação de autenticação. NÃO são persistidos.

### 4.2 Runtime State (TypeScript)

```typescript
// Persistido no vault
interface VaultConfigData {
  'claude:mode': 'subscription' | 'api-key'
  'prompt:global': string | null
  'github:token': string
}

// Computado em tempo de execução (não persiste)
interface CLIStatus {
  installed: boolean
  loggedIn: boolean
  path?: string
}

interface RuntimeConfig {
  claude: {
    mode: 'subscription' | 'api-key'
    subscriptionOk: boolean | null
  }
  clis: Record<'claude' | 'codex' | 'kimi', CLIStatus>
  prompt: {
    current: string | null
    isDefault: boolean
  }
  github: {
    tokenPresent: boolean
  }
}
```

---

## 5. Tratamento de Erros

| Erro | Gatilho | Resposta | Feedback ao Usuário |
|------|---------|----------|---------------------|
| `vault_locked` | POST /api/config/* sem session | 401 | (UI bloqueada; dashboard mostra "Desbloqueie") |
| `validation_error` | Token formato inválido | 400 | "Formato inválido. Esperado: ghp_… ou github_pat_…" |
| `cli_not_found` | `--version` exec falha | 200 (partial) | row com "não instalado" + hint de instalação |
| `cli_not_logged_in` | Detecção de login falha | 200 (partial) | row "não logado" + hint `<cli> login` |
| `rate_limit` | Claude SDK retorna 429 | 429 | "Rate limit. Tente novamente em 60s." |
| `no_subscription` | Claude Code login não detectado | 200 | "Assinatura selecionada, mas não detectei login…" |
| `network_error` | POST /api/config/* falha | 500 | "Verifique se o EngrenaCode está em execução." |
| `vault_persist_error` | Falha ao gravar vault | 500 | "Não foi possível gravar localmente…" |

---

## 6. Testing Strategy

### 6.1 Unitário

| Arquivo | Tipo | Alvo |
|---------|------|------|
| `src/services/http/github-token.test.ts` | Unitário | `validateGithubToken` |

| Função de Teste | Descrição | Assertions |
|-----------------|-----------|------------|
| `clears when token is empty` | Empty → remove | `{ ok: true, action: 'clear' }` |
| `rejects tokens with whitespace` | Espaços | message espaços |
| `rejects tokens shorter than 8 chars` | Curto demais | message curto |
| `rejects invalid prefixes` | Prefixo inválido | message formato |
| `accepts valid prefix token %s` | `ghp_` / `github_pat_` / `gho_` / `ghu_` / `ghs_` / `ghr_` | `{ ok: true, action: 'save' }` |

Runner: Vitest (`pnpm test`). Bootstrap adicionado no fechamento F02.

### 6.2 Smoke / Aceitação manual (F02 Central)

Ver checklist operacional em [`smoke-results.md`](./smoke-results.md) (execução 2026-08-03).

- [x] Card Claude detecta assinatura e "Testar conexão" distingue sucesso, sem login e rate limit
- [x] Card CLIs lista Claude, Codex e Kimi com instalado/logado e teste X/3
- [x] Prompt global salva, restaura padrão e desliga com feedbacks específicos
- [x] Token GitHub rejeita espaços, curto demais e prefixo inválido; aceita `ghp_` / `github_pat_` válidos
- [x] Mode switch Claude grava no vault e reflete imediatamente na UI
- [x] Light + dark: cards/legíveis; copy alinhada a `ui.md` (EngrenaCode)

### 6.3 Cross-feature (deferred)

| Critério | Status | Nota |
|----------|--------|------|
| Status de F02 alimenta dashboard F04 via GET `/api/config/status` | deferred | até F04 |
| Prompt global de F02 é injetado em turno F03 após salvar | deferred | até F03 |
| Token GitHub de F02 é usado em fluxo git F03 (commit, push, PR) | deferred | até F03 |
| Cofre travado (F01) retorna 401 em POST `/api/config/*` e UI entra lockscreen | ready | A2 smoke: 401 sem sessão |

### 6.4 Handoff F03 / F04

- **F04 Dashboard:** consumir `GET /api/config/status` (session header) para health widget — campos `claude.subscriptionOk`, `clis.*.installed/loggedIn`, `github.tokenPresent`, `prompt.isDefault/isEmpty`.
- **F03 Workspace / turnos:** ler `prompt:global` do vault (ou via status `prompt.currentText` / default do handler); se vazio/`isEmpty`, não injetar.
- **F03 Git:** ler `github:token` do vault no fluxo commit/push/PR; validação remota fica no uso, não no save F02.

---

## 7. Decisões e Assumptions

| Decisão | Razão |
|---------|-------|
| Schema flat com prefixos (`claude:`, `prompt:`, `github:`) | Simplicidade; alinha com generic `setSecret`/`getSecret` de F01 |
| CLI status em runtime, não persistido | CLIs mudam de status frequentemente (instala, desinstala, loga); descoberta fresh a cada status |
| Teste Claude via SDK (turno mínimo) | Valida de verdade (não só arquivo `~/.claude.json`); garante SDK funcionando |
| GitHub token: validação local, sem ping | MVP rápido; validação remota fica no workspace F03 (ao fazer push) |
| Mode switch Claude grava imediatamente | UX fluida; usuário vê feedback imediato |
| Prompt default hardcoded em Frontend | Primeira iteração; após F02, pode ser carregado do backend |
| Sem mode API-key até F10 | Central MVP só assinatura; API key entra com F10 |
| CLI paths via PATH envvar | Padrão POSIX; manual paths é Escopo Completo |
| Unlock HTTP devolve `sessionToken` | Clientes HTTP/smoke não dependem só de IPC Electron |
| `ENGRENACODE_USER_DATA` override no vault store | Isola smoke/testes do vault real do usuário |


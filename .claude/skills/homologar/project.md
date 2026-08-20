# Bindings — EngrenaCode (Homologação)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

## Como subir

```bash
env -u ANTHROPIC_API_KEY pnpm dev
```

| Peça | Valor |
|------|-------|
| Renderer (Vite) | `http://localhost:5173` |
| Unlock + API + WebSocket | `127.0.0.1:5174` |
| Build empacotado | `pnpm --filter engrena-code build` (feche o app antes: EPERM no rename de `release/win-unpacked`) |

**`ANTHROPIC_API_KEY` não pode estar no ambiente.** O processo filho `claude` herda a variável e
autentica por API key em vez da sessão de assinatura já logada no binário. Confira que a variável
existe antes de removê-la, mas **nunca imprima o valor**.

**Fechar a janela do Electron derruba o `pnpm dev` inteiro** (exit 0) e leva a API junto.

## Como destravar sem tocar na janela

```
POST 127.0.0.1:5174/api/vault/unlock   {"workspace": "<qualquer string>", "password": "<senha>"}
```

`workspace` só chaveia o backoff de tentativa. A resposta traz `sessionToken`; as chamadas seguintes
usam o header **`x-engrenacode-session`** (não `Authorization: Bearer`).

O cofre mantém **um** `sessionToken` por processo e `unlock()` gera outro a cada chamada: destravar
por API invalida o token que a janela já tinha. Se o usuário destravou pela UI, **não** destrave de
novo — ou avise que a janela vai precisar recarregar.

## Onde está a evidência

| Fonte | Caminho |
|-------|---------|
| Banco | `%APPDATA%/engrena-code/engrenacode.db` (SQLite) |
| Leitura | `node:sqlite` → `new DatabaseSync(path, { readOnly: true })` |
| Log que o usuário vê | tabela `log_entries` → tela `#registros` |
| Estado de turno | tabela `threads`, coluna `state` |
| Pedidos de permissão | tabela `thread_gates` (`state`, `created_at`, `expires_at`, `resolved_at`) |

Isolar o ambiente, quando o teste puder sujar dado real: `ENGRENACODE_USER_DATA=<dir>`.

## Runbook

[`apps/engrena-code/docs/RUNBOOK-HOMOLOGACAO.md`](../../../apps/engrena-code/docs/RUNBOOK-HOMOLOGACAO.md)

| Roteiro | Escopo |
|---------|--------|
| A | Fumaça, sem custo de turno |
| B | Turno real (com custo) |
| C | Governança, segredos e integrações |
| D | Resiliência |
| E | Runtime, prazo, histórico e recuperação (F30–F35) |

**Critério de aprovação:** um único `BLOQUEIA` em `❌` reprova a versão. Não existe aprovação parcial.
Placar em branco significa que nada foi homologado.

Registro de evidência por rodada: `apps/engrena-code/docs/F<ID>-*/smoke-results.md` ou documento
próprio (ex.: `F30-F35-smoke-results.md`).

## Marcador de fixture

Prefixo no título: `[fixture <ID do check> — remover]`. Limpeza ao fim:

```sql
DELETE FROM threads WHERE title LIKE '[fixture %';
```

## Armadilhas deste repo

| Armadilha | Consequência |
|-----------|--------------|
| Editar arquivo de `src/services/**` com o dev rodando | Vite reinicia o processo main → cofre trava → API responde `423 vault_locked` |
| `Stop-Process -Name node` / `pkill node` | Derruba Electron, Vite e o editor. Sempre por PID ou por porta |
| `git add <diretório>` | Varre alteração de terceiro no working tree para dentro do commit; adicione arquivo a arquivo |
| Emulação de rede do Chromium para derrubar WebSocket | Não corta WS em loopback e a condição gruda na sessão CDP |
| `playwright-cli` em headless quando o usuário precisa digitar | Ele digita numa janela que não existe; use `--headed` |

## Precedentes vivos

| Regra | Onde este repo pagou por ela |
|-------|------------------------------|
| `terminal-state-must-be-usable` | 2026-08-19, check E11: `interrupted` entrou na união de estados, nos conjuntos do renderer e na recuperação de boot, mas ficou fora de `SETTLED_STATES` em `turn-state.ts`. Como `follow_up` só é legal a partir dela, a thread recuperada parou de aceitar mensagem — pior que o `error` que a feature veio substituir. 2320 testes verdes não pegaram |
| `prove-the-negative` | F31: as três auto-aprovações de shell valeram menos que o `COUNT(*) = 0` em `thread_gates`, e a borda só ficou provada quando um caminho fora do projeto **abriu** card |
| `read-evidence-dont-instrument` | Todo o smoke de F30–F35 saiu de `SELECT` no `engrenacode.db` e de `log_entries`, sem tocar em WebSocket nem DOM |
| `fixtures-are-temporary` | Fixtures de F33 (74 mensagens) e E12 (thread sem diff), mais um `state` alterado à mão — todos removidos e conferidos por órfão ao fim |
| `dont-edit-while-measuring` | Corrigir `permission-broker.ts` no meio da bateria reiniciou o Electron e travou o cofre; a chamada seguinte falhou por `423`, não pelo que estava sendo medido |

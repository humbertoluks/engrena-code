---
name: review-robustness
description: Revisa robustez do EngrenaCode — validação em HTTP/IPC/FS/spawn, tipagem sem any injustificado, regra de negócio duplicada, erros úteis ao usuário e vazamento de segredo (incl. sanitize stderr VCS). Use ao revisar diff, branch, PR, feature, ou com /review-robustness quanto a validação, tipos, erros ou credenciais.
---

# Review — Robustez

Revisão **somente leitura** de validação, tipos, duplicação e erros. Nunca edita código: observa, analisa e relata.

**Auditoria full-base / artefato:** quando o pedido for reauditoria da base completa ou “rodar as 3 reviews”, use a skill `audit-full-base` (orquestra architecture + esta frente + delivery e grava `docs/AUDIT-CODE-REVIEW.md` categorizando achados por **Stack**: Electron, React, Node.js, SQLite, TypeScript, Vitest).

**Idioma:** relatório em português do Brasil. Códigos de erro, nomes de símbolo e comandos permanecem em inglês; mensagens de erro voltadas ao usuário são em PT-BR por contrato do produto.

## Escopo

| Revisa aqui | Não revisa aqui |
|---|---|
| Validação de toda entrada de fronteira | Camadas, isolamento Electron, abstração morta → `review-architecture` |
| Tipagem estrita, zero `any` injustificado | Cobertura de teste e tamanho de commit → `review-delivery` |
| Duplicação de regra de negócio | |
| Erro útil, visível e gracioso para o usuário | |
| Segredo fora de log, SQLite e localStorage | |

## Entrada

Formato livre. Default: **mudanças do branch** (`git diff main...HEAD`).

Também aceita: `uncommitted` (`git diff HEAD`), caminhos explícitos, ou `F<ID>` (usa o Component Overview e a seção Error Handling de `docs/F<ID>-*/spec.md`).

Diff vazio: pare e diga qual escopo foi tentado.

## Fronteiras que exigem validação

Toda entrada que cruza uma destas linhas é **não confiável** até ser estreitada:

| Fronteira | Onde | Entrada não confiável |
|---|---|---|
| HTTP loopback | `src/services/http/*-handler.ts` | body, path params, query, header de sessão |
| IPC | `ipcMain.handle` em `src/main/index.ts` | todo argumento chega como `unknown` |
| Filesystem / git | `src/services/git/*`, `runner/apply-diff.ts`, `runner/project-execution.ts` | path, nome de branch, conteúdo de diff |
| Spawn de agente | `src/services/runner/providers/*` | prompt, model, effort, anexos, env |
| API / provider externo | `src/services/http/claude-probe.ts`, `runner/providers/minimax-driver.ts`, `mcps/oauth.ts` | resposta remota, token, status |
| Vault | `src/services/vault/*` | senha, arquivo `vault.enc`, session token |

## Checklist

Marque cada item ✓ / ✗ / — e cite `arquivo:linha`.

### 1. Validação na fronteira HTTP

Padrão estabelecido em todos os `src/services/http/*-handler.ts` (referência: `rules-handler.ts`). Único sem `guard` é `unlock-handler.ts`, que é o roteador + as rotas públicas pré-sessão. Rota nova precisa de tudo abaixo:

- `guard(req, res)` antes de qualquer efeito: vault travado → **423 `vault_locked`**; header `x-engrenacode-session` ausente/divergente → **401 `unauthorized`**. Rota nova sem `guard` é 🔴, salvo rota pública deliberada (unlock/health) declarada no diff.
- `parseBody` devolvendo `null` → **400 `invalid_request`** antes de tocar repositório. Faltando é 🔴.
- Cada campo obrigatório com checagem de tipo explícita (`typeof data.name !== 'string'`). Confiar na anotação de tipo do body é 🔴 — o tipo é só compile-time, o JSON vem do renderer.
- Limites numéricos e enums validados contra a fonte canônica, não contra literal solto (precedente: model/effort validados contra `runner/providers/provider-catalog.ts`; imagens contra `composer-images.ts`). Literal duplicado é 🟡.
- Path param extraído por regex de rota (`RULE_ID_RE`), nunca por `split('/')` com índice mágico. 🟡.
- Resposta de erro sempre no formato `{ error: { code, message } }` com status coerente: 400 validação, 401 sessão, 404 não encontrado, 409 conflito, 423 vault travado, 500 interno. Formato ou status divergente é 🔴 — o renderer lê `ApiErrorBody`.

### 2. Validação na fronteira IPC, FS e spawn

- Argumento de `ipcMain.handle` é estreitado antes do uso. Precedente correto: `shell:open-external` faz `typeof url !== 'string' || !url.startsWith('https://')` → retorna `false`. Handler novo sem estreitamento é 🔴.
- Capacidade nativa perigosa usa allowlist, não blocklist (protocolo `https://` permitido; nunca "bloqueia `file://`").
- Path que venha do cliente é resolvido e confinado: `resolve(base, input)` + `startsWith(base)`. Hoje os paths vêm de `project.path` do repositório (`project-files-handler.ts` caminha a partir da raiz), então endpoint novo que aceite path do payload sem confinamento é 🔴 (traversal).
- Worktree e artefatos temporários ficam sob `app.getPath('userData')`; escrita fora dessa base ou dentro de `project.path` quando o modo é worktree é 🔴 (contrato de F13).
- Anexo/arquivo temporário criado para o turno é limpo no fim, inclusive no caminho de erro (`finally`). Faltando é 🟡.
- Resposta de provider externo é validada antes do uso (campo pode faltar, status pode não ser 2xx). `res.json()` usado direto como se o formato fosse garantido é 🟡; sem checar status HTTP é 🔴.

### 3. Tipagem estrita

- `rg -n ": any|as any|<any>" src` — hoje sai **vazio**, inclusive no preload. Todo `any` novo é 🔴, salvo comentário na linha justificando por que `unknown` + narrowing não serve.
- Fronteira recebe `unknown` e estreita; não recebe o tipo desejado por fé. 🔴.
- `as` que force forma de objeto em código de produção é 🔴 (em fake de teste é aceito — precedente `fakeReq`/`fakeRes` em `rules-handler.test.ts`).
- `!` (non-null assertion) e `?? {}` mascarando ausência real de dado são 🟡: prefira checagem explícita com erro nomeado.
- Resultado de validação usa união discriminada, não booleano com mensagem por fora. Precedente: `type ImageValidationResult = { ok: true } | { ok: false; code: 'type' | 'size'; message: string }` em `composer.logic.ts`. 🟡 quando o diff inventa outra forma.
- Estado com combinações impossíveis (`isLoading` + `error` + `data` todos opcionais soltos) é 🟡 quando uma união resolveria.
- Contrato de wire duplicado entre `src/renderer/services/*-service.ts` e handler/repositório precisa bater campo a campo. Divergência silenciosa (campo renomeado num lado só) é 🔴.

### 4. Duplicação

Distinção que importa neste repo — não trate tudo igual:

- **Boilerplate de transporte duplicado é aceito.** Os handlers importam/repetem `sendJson`, `sendError`, `readBody`, `parseBody`, `guard` e a constante `SESSION_HEADER`. Handler novo seguindo esse padrão **não é achado**. O bug é a **divergência**: código de erro diferente, status diferente, nome de header diferente, `guard` que checa sessão antes de vault travado. Divergência é 🔴.
- **Regra de negócio duplicada é 🔴.** Limite, clamp, enum, cálculo de preço, mapeamento status→código: existe num lugar só. Se cliente e servidor precisam da mesma regra, importe a constante compartilhada em vez de re-declarar o literal — precedente: `composer.logic.ts` espelha a validação do servidor importando `ALLOWED_IMAGE_MIME_TYPES`/`MAX_IMAGE_BYTES` de `composer-images.ts`.
- Mesma query SQL copiada em dois arquivos é 🟡 → pertence ao repositório da entidade.
- String voltada ao usuário duplicada em dois componentes é 🟡: quando existe `docs/F<ID>-*/copy.md`, a fonte é ele (precedente de módulo de copy: `components/subagents/copy.ts`).
- Bloco `catch` idêntico repetido no mesmo arquivo é 🟢 → um `handle<Entidade>Error` local, como em `handleRuleError`.

### 5. Erro útil, visível e gracioso

- Erro de domínio é classe tipada com `code` estável, não `throw new Error('falhou')`. Precedentes: `RuleError`, `ApplyDiffValidationError('validation_error', ...)`. 🔴 quando o diff lança string ou `Error` genérico atravessando fronteira.
- `code` novo é estável e em snake_case, alinhado aos existentes (`vault_locked`, `unauthorized`, `invalid_request`, `rule_not_found`, `rule_name_conflict`, `thread_busy`, `github_token_missing`, `worktree_create_failed`, `image_too_large`). Código inventado fora desse padrão é 🟡.
- `message` é em PT-BR, acionável e sem jargão interno — diz o que fazer ("Configure um token do GitHub em Configuração antes de fazer push."), não "Error 500". Mensagem em inglês, vazia ou genérica em rota nova é 🔴.
- `message` nunca vaza stack, path absoluto do usuário, senha, token ou body cru. 🔴.
- Erro inesperado: `console.error('[<módulo>] Unhandled error:', err)` + resposta 500 `internal_error` genérica. `catch` vazio, `catch` que só faz `return null` perdendo a causa, ou `res` sem resposta (request pendurado) é 🔴.
- Falha parcial não derruba o fluxo inteiro quando o produto tolera degradação — precedente: seed do catálogo falha e loga sem alterar a resposta do unlock (`apply-catalog.ts`). Fluxo novo que aborta o unlock/boot por causa de acessório é 🔴.
- Efeito destrutivo não acontece pela metade: commit local não é revertido porque o push falhou; diff aplicado é atômico sob o lease do projeto. 🔴 quando o diff introduz meia-transação.
- **Superfície visível:** todo `code` novo que pode chegar ao usuário tem tratamento na UI — `InlineFeedback` ou container com `role="alert"` exibindo `error.message`, com o botão voltando a habilitar depois da falha. Erro que só aparece no console é 🔴. Botão que fica travado em "enviando" após falha é 🔴.
- Estado de erro coexiste com retry: o usuário consegue corrigir e tentar de novo sem recarregar o app. 🟡.

### 6. Segredo

- Chave de provider e segredo de MCP/VCS só no vault (`src/services/vault/provider-keys.ts`, `runner/mcp-secrets.ts`, tokens VCS). Segredo em coluna do SQLite, em arquivo do projeto, em `.env` commitado ou em resposta HTTP é 🔴.
- `localStorage` do renderer: `sessionToken`, `engrenacode:theme`, e filas/UX sem credencial. Chave nova com credencial é 🔴.
- `rg -n "console\.(log|error|warn)" nos arquivos do diff` — nenhum log imprime token, senha, header de sessão ou body de unlock. 🔴.
- Endpoint que devolve configuração expõe **status** ("configurada"), nunca o valor da chave. 🔴.
- Stderr / message que pode chegar à UI passa por `sanitizeProcessError`. Diff que adiciona inject de token em URL HTTPS (`oauth2:`, `x-token-auth:`, `https://:<token>@`, além de `x-access-token:`) ou prefixo de provider (`xai-`, `gsk_`, …) **sem** atualizar o sanitizer + teste que falha se o segredo sobreviver é 🔴.
- Autenticação WS via subprotocol; aceitar `?token=` na query (legado) é 🟡 — remova ou documente data de corte (vaza em logs/proxy).
- PTY / spawn de shell: herdar `process.env` inteiro é 🟡 (keys do host no terminal). Preferir allowlist.

## Formato de saída

```
Review Robustez — <escopo revisado>
Veredito: aprovado | ressalvas | bloqueado

🔴 Bloqueia merge
- `caminho:linha` — <problema em uma linha>. Correção: <ação concreta>.

🟡 Ajustar antes de fechar a feature
- `caminho:linha` — <problema>. Correção: <ação>.

🟢 Opcional
- `caminho:linha` — <observação>.

Fronteiras tocadas neste diff:
- <fronteira> — <validada / gap apontado acima>

Checklist:
✓ 3. Tipagem estrita — <evidência>
✗ 5. Erro visível — <o que falta>
— 6. Segredo — nada de credencial neste diff

Não verificado:
- <o que não deu para checar e por quê>
```

Veredito: **bloqueado** com qualquer 🔴; **ressalvas** com só 🟡/🟢; **aprovado** sem achados.

Exemplo de relatório completo: [references/examples.md](references/examples.md).

## Sempre

- Listar as fronteiras que o diff atravessa antes de julgar validação — se não atravessa nenhuma, diga isso e siga.
- Ler a seção Error Handling de `docs/F<ID>-*/spec.md` e o `copy.md` da feature quando existirem, antes de chamar mensagem de erro de errada.
- Perseguir cada `code` novo até a UI: quem exibe, com que copy, em que elemento.
- Citar `arquivo:linha` e correção concreta em uma linha.
- Tratar `any` novo, `catch` vazio, erro invisível ao usuário e segredo em log como 🔴 sem negociação.

## Nunca

- Editar, formatar ou "corrigir de passagem" qualquer arquivo — a saída é o relatório.
- Flagrar os helpers de transporte replicados nos handlers como duplicação: só a divergência entre eles é achado.
- Exigir Zod, biblioteca de validação ou middleware genérico: o padrão daqui é checagem explícita de `typeof` no handler.
- Exigir `try/catch` em torno de código que não pode lançar.
- Flagrar `as` em fake de teste (`fakeReq`/`fakeRes`) como cast indevido.
- Reclamar de estilo/formatação: `biome` decide isso.

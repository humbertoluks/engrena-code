# F28 — Paridade de chat com o Copilot Chat: smoke

Referência upstream (MIT): clone raso de `microsoft/vscode` em `C:\Users\Me\Code\repos\github\microsoft\vscode`
(sparse: `extensions/copilot` + `src/vs/workbench/contrib/chat`).

---

## Onda 1 — contexto no composer (2026-08-11)

**Ambiente:** `pnpm dev` (Electron real, `dangerouslyDisableSandbox`) + `playwright-cli` em `http://localhost:5173`;
`ENGRENACODE_USER_DATA` isolado em `%TEMP%\engrenacode_onda1_smoke`; `ANTHROPIC_API_KEY` unset.
Projeto `TodolistV1` com `marcador.ts` contendo `MARCADOR_SMOKE = "engrena-onda1-7788"`.
Provider Claude, modelo `claude-haiku-4-5`, access `Full access`.

| # | Cenário | Esperado | Resultado |
|---|---------|----------|-----------|
| 1 | Abrir arquivo no viewer | chip implícito no composer | **pass** — `📄 marcador.ts ×` |
| 2 | Fechar o viewer | chip implícito some | **pass** — tira vazia |
| 3 | Arrastar arquivo da árvore para o composer | vira chip explícito | **pass** |
| 4 | Colar imagem (Ctrl+V) no composer | miniatura entra na mesma tira | **pass** — 1 thumb ao lado do chip de arquivo |
| 5 | Turno real pedindo o valor da constante "sem usar ferramenta" | resposta traz o valor vindo do contexto | **pass** — resposta contém `engrena-onda1-7788` com **zero** tool calls (work log vazio) |
| 6 | Histórico | mensagem enviada mostra os chips do que foi anexado | **pass** |

**Coberto por unitário** (não reexercitado na UI): teto de 10 anexos, dedupe por path, recusa de seleção
acima de 20k chars, rejeição de payload malformado no HTTP (`attachment_invalid`), anexo com path inseguro
ou arquivo inexistente ignorado sem derrubar o turno.

**Nota de ambiente:** a pasta `TodolistV1` foi encontrada no início desta rodada apenas com `.git` e sem os
arquivos gerados na sessão anterior (`index.js`, `package.json`, `node_modules`) — reset externo a este
trabalho, não houve remoção por esta sessão.

---

## Onda 2 — gestão da conversa (2026-08-11)

**Ambiente:** mesmo da Onda 1, `ENGRENACODE_USER_DATA` em `%TEMP%\engrenacode_onda2_smoke`.

| # | Cenário | Esperado | Resultado |
|---|---------|----------|-----------|
| 1 | Fim de turno real | 3 sugestões de follow-up abaixo da resposta | **pass** — ex.: "Localize onde MARCADOR_SMOKE é usado no projeto" |
| 2 | Clicar numa sugestão | preenche o composer sem enviar | **pass** |
| 3 | 👍 numa resposta | fica marcado (`aria-pressed=true`) | **pass** |
| 4 | Recarregar o app e reabrir a thread | voto continua marcado | **pass** — veio do histórico persistido |
| 5 | Renomear conversa (✎, Enter) | título novo na sidebar | **pass** — "Conversa renomeada no smoke" |
| 6 | Buscar por conteúdo de mensagem (`marcador.ts`) | acha a conversa | **pass** (1 resultado) |
| 7 | Buscar por título (`renomeada`) | acha a conversa | **pass** (1 resultado) |
| 8 | Buscar termo inexistente | lista vazia | **pass** (0 resultados) |
| 9 | Exportar (⤓) | baixa markdown com nome derivado do título | **pass** — `conversa-renomeada-no-smoke-d67ae528.md` |

**Coberto por unitário:** título > 120 chars rejeitado, título vazio volta ao automático, `format` inválido
no export → 400, voto em mensagem de usuário → 400, voto inválido → 400, toggle do voto (mesmo voto limpa),
parsing de follow-up (bloco de código, duplicata, teto de 3, lixo → lista vazia).

---

## Onda 3 — contexto profundo e governança (2026-08-11)

**Ambiente:** mesmo das ondas anteriores, `ENGRENACODE_USER_DATA` em `%TEMP%\engrenacode_onda3_smoke`.
Fixtures no `TodolistV1`: `frete.ts` (indexável), `segredo.ts` (com `CHAVE_SECRETA`) e
`.engrenaignore` com `segredo.ts`.

| # | Cenário | Esperado | Resultado |
|---|---------|----------|-----------|
| 1 | Arquivo em `.engrenaignore` | some do explorer e da menção `@` | **pass** — `segredo.ts` 0 ocorrências, `frete.ts` presente |
| 2 | Leitura direta pela API do arquivo excluído | 403 explicando o motivo | **pass** — `403 file_ignored` |
| 3 | `#codebase` com o pedido "como o projeto calcula o frete?" | anexa o trecho certo como chip | **pass** — `✂ frete.ts:1-2` |
| 4 | Busca no índice por termo que só existe no arquivo excluído | nenhum resultado | **pass** — 0 hits para `CHAVE_SECRETA` |

**Coberto por unitário:** parser do `.engrenaignore` (negação, `**`, âncora `/`, diretório, precedência do
último padrão), cache por mtime, indexação incremental por mtime, remoção do arquivo apagado, isolamento
entre projetos, um trecho por arquivo no resultado, allowlist de ferramenta por projeto (grava, não duplica,
não vaza entre projetos, revoga, cascade ao apagar o projeto).

**Não exercitado ao vivo:** "Sempre neste projeto" sobrevivendo ao restart do app — exigiria um turno
supervised extra mais reinício; o caminho está coberto por unitário no repositório e no broker.

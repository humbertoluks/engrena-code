# Spec de UI: #principal (AskUserQuestion — card inline na timeline)

**Feature:** F21-askuserquestion
**Destino:** EngrenaCode
**Fonte de referência:** LionCodeLabs (`packages/renderer/src/components/QuestionPrompt.tsx`)
**Componente destino:** `src/renderer/components/workspace/AskUserQuestionCard.tsx`, montado em `ChatHistory.tsx`
**Última atualização:** 2026-08-08

> **Relação com F21 técnico:** backend, IPC de resposta e contrato de props já implementados (fases 1–11 do `plan.md`, commits `161bdbe`→`3c5a4f7`). Este doc fecha a fase visual, que o `plan.md` Fase 5 deixou explicitamente bloqueada até `ui.md`/`copy.md` existirem.

## Referência visual

| Artefato | Caminho | Papel |
|----------|---------|-------|
| Fixture da fonte (modal LionCodeLabs) | `docs/F21-askuserquestion/ui/ask-user-question-fixture.html` | Reprodução estática do `QuestionPrompt.tsx` para comparar anatomia |
| Fonte — light | `docs/F21-askuserquestion/ui/ask-user-question-light.png` | Render da fixture |
| Fonte — dark | `docs/F21-askuserquestion/ui/ask-user-question-dark.png` | Render da fixture |
| **Destino** — card inline no `#principal` | `docs/F21-askuserquestion/ui/ask-user-question-card-destino.png` | O que o EngrenaCode shipou (Electron real, 2026-08-08) |

> Os três primeiros mostram a **fonte** (modal, fila, radios com descrição, CTA `Responder`); o último mostra o **destino** (card inline, pills, CTA `Enviar`). A comparação lado a lado é o que justifica as divergências listadas no fim deste doc.

## Escopo

**Inclui:**
- Card inline na timeline do `#principal` quando `selectedThread.state === 'waiting_user'`
- Cabeçalho identificando que a pergunta é do agente, opções como botões, campo livre "Outra", CTA de envio
- Sinalização de escolha única vs múltipla, hint de bloqueio, estado enviando e erro de envio

**Exclui (visível na fonte, fora do contrato F21):**
- **Modal fullscreen** (`fixed inset-0`, `aria-modal`) — o PRD Engrena é explícito: *"Card inline na timeline com as opções como botões"*. A fonte usa modal porque lá o driver bloqueia globalmente; aqui a thread entra em `waiting_user` e o resto do app segue usável, então prender a tela contradiz o próprio estado
- **Múltiplas perguntas por pedido** (`request.questions.map`, fila `+N na fila`) — o contrato Engrena é uma pergunta por chamada (`prompt`, `options` ≤4, `multiSelect`); não existe fila
- **Descrição por opção** (`opt.description`) — `options` é `string[]`, sem descrição
- **`header` por pergunta** (pill de categoria) — não existe no schema da tool aqui

## Anatomia (topo → base)

Card ancorado como último item da timeline (`self-start`, `max-w-[42rem]`), depois dos `tool_calls` e antes do texto em streaming:

1. **Cabeçalho:** rótulo do agente (mesma escala dos rótulos de role da timeline, `text-[10px] uppercase tracking-wide text-muted`) — sem ele o card aparece na timeline sem dizer de quem é a pergunta, diferente de toda mensagem vizinha
2. **Pergunta:** `prompt` em `text-[13px] text-fg`
3. **Dica de seleção:** `escolha uma opção` ou `escolha uma ou mais` conforme `multiSelect` — a fonte comunica isso pela forma do controle (radio vs checkbox); aqui as opções são botões-pill, que não carregam esse sinal, então vai em texto
4. **Opções:** botões-pill em `flex-wrap`, `aria-pressed` refletindo seleção; selecionado em accent, não-selecionado em border/muted. Omitido quando `options` está vazio
5. **Campo livre:** `textarea` 2 linhas, placeholder `Outra…` — sempre presente (PRD: *"'Outra' sempre disponível como resposta livre"*)
6. **Rodapé:** hint à esquerda + CTA à direita
   - Hint `Marque uma opção ou escreva uma resposta.` enquanto o envio está bloqueado; some quando válido
   - CTA `Enviar` / `Enviando…` enquanto em voo
   - Erro de envio em `role="alert"` vermelho abaixo, preservando as seleções

**Alinhamento:** `self-start`, à esquerda como as mensagens do assistente.
**Largura máx.:** `max-w-[42rem]` — igual às bolhas de mensagem e ao `SubagentTimelineBlock`.

## Layout / tokens

| Região | Tokens / classes | Notas |
|--------|------------------|-------|
| Card | `rounded-lg border border-border bg-surface-2 p-sm text-[13px]` | mesma superfície das bolhas do assistente |
| Rótulo do cabeçalho | `text-[10px] uppercase tracking-wide text-muted` | idêntico ao `ROLE_LABEL` da timeline |
| Pergunta | `text-[13px] text-fg` | |
| Dica de seleção | `text-[11px] text-muted` | |
| Opção não-selecionada | `rounded-md border border-border px-sm py-[3px] text-[12px] text-muted hover:text-fg` | |
| Opção selecionada | `border-accent bg-accent/15 text-accent` | mesmo par accent do resto do app |
| Campo livre | `rounded-md border border-border bg-surface px-sm py-xs text-[12px] text-fg` | `resize-none`, `rows=2` |
| Hint de bloqueio | `text-[11px] text-muted` | |
| CTA | `rounded-md bg-accent px-sm py-xs text-[12px] font-medium text-white disabled:opacity-50` | |
| Erro | `text-[11.5px] text-red` + `role="alert"` | |
| Foco | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent` nas opções, campo e CTA | |

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| Opção | button `aria-pressed` | não (se houver texto livre) | `multiSelect=false` → clicar troca a seleção; clicar na já marcada desmarca. `multiSelect=true` → alterna cada uma |
| Campo livre | textarea | não (se houver opção marcada) | Conta como resposta quando `trim()` não é vazio |
| Enviar | button | sim | Desabilitado enquanto `validateAnswer()` for falso ou envio em voo |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `pending` | `state === 'waiting_user'` com tool call `running` | Card completo, CTA desabilitado até haver resposta |
| `answerable` | ≥1 opção marcada ou texto livre não-vazio | Hint some, CTA habilitado |
| `submitting` | POST `/answer` em voo | Controles desabilitados, CTA `Enviando…` — sem isso o duplo clique manda duas respostas |
| `error` | POST falhou (`thread_not_waiting` 409, `validation_error` 400, rede) | `role="alert"` com a mensagem; seleções preservadas para nova tentativa |
| ausente | thread não está `waiting_user` | Card não renderiza |

## Aceite visual

- [ ] Card aparece inline na timeline, alinhado como mensagem do assistente, largura igual às bolhas
- [ ] Cabeçalho identifica a pergunta como do agente
- [ ] `multiSelect` visível na dica de seleção (única vs múltipla)
- [ ] Opção marcada em accent com `aria-pressed` correto; escolha única troca em vez de acumular
- [ ] "Outra" presente mesmo com opções
- [ ] CTA bloqueado sem resposta, com hint explicando (não só cinza silencioso)
- [ ] Envio em voo desabilita e mostra `Enviando…`; duplo clique não manda duas respostas
- [ ] Falha de envio mostra `role="alert"` e preserva as seleções
- [ ] Foco visível em opções, campo e CTA
- [ ] Tema via tokens; light e dark verificados

## Divergências vs fonte (deliberadas)

| Item | Fonte | Destino Engrena | Motivo |
|------|-------|------------------|--------|
| Container | Modal `fixed inset-0` + `aria-modal` | Card inline na timeline | PRD explícito; `waiting_user` não bloqueia o app |
| Perguntas por pedido | N, com fila `+N na fila` | 1 | Contrato da tool aqui é pergunta única |
| Controle de opção | `<input radio/checkbox>` em label full-width | Botão-pill `aria-pressed` | PRD diz "opções como botões"; sem descrição por opção, pill basta — o sinal single/multi que o radio dava vira a dica textual |
| Descrição de opção | `opt.description` | — | `options: string[]`, sem descrição no schema |
| Validação | Exige todas as N perguntas respondidas | ≥1 opção **ou** texto livre | `validateAnswer()` já implementado assim, alinhado ao `POST /answer` |
| Rótulo do CTA | `Responder` | `Enviar` | Consistência com o composer do Workspace |

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F21-askuserquestion/spec.md` | Contratos técnicos (tool, loopback, `POST /answer`) |
| `docs/F21-askuserquestion/plan.md` | Ordem de implementação; Fase 5 registra a pendência que este doc fecha |
| `docs/F21-askuserquestion/copy.md` | Catálogo de microcopy |
| `docs/design-system/` | Tokens e superfícies |

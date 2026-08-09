# Smoke: F23. Providers GLM/Grok

**Data:** 2026-08-09
**Método:** app em dev (`pnpm dev`, Electron real) + `playwright-cli` apontando para `http://localhost:5173`, `ENGRENACODE_USER_DATA` isolado sob `%TEMP%\engrenacode_claude_d07smoke` (mesma sessão dos smokes de F20/F21). Vault e `userData` reais do usuário intocados. Sem key real de GLM nem de Grok disponível nesta sessão — mesma limitação já registrada no spec (§3.3 Assumption): item 5 (`Testar conexão` com key real) fica pendente de credencial do usuário, não bloqueante.

## Setup

- Reaproveitados os projetos fixture de F20/F21 (mesmo vault) só para o teste de picker/composer (itens 6–7); os itens 1–4 são só em `#configuracao`, sem projeto.

## Confirmado ao vivo

1. **Cards GLM/Grok em `#configuracao`**: aparecem no mesmo grupo visual do bloco de keys (F10) — campo vazio, badge "não configurada".
2. **GLM sem prefixo reconhecível, salva**: `glm-test-key-abc123.secretpart` (sem `xai-`, sem espaços) → `Salvar chave` aceita, badge vira "configurada", status "Chaves salvas localmente (não validadas com o provider)." — validador loose de GLM confirmado (não exige prefixo).
3. **Grok fora do formato**: `not-a-grok-key-12345` (sem `xai-`) → erro inline "Formato inválido. Esperado: xai-…", campo marcado inválido, badge continua "não configurada" — nada salvo.
4. **Testar conexão com key GLM fake (com internet real disponível neste ambiente)**: erro "Key do GLM inválida ou rejeitada pelo provider." — distinto da mensagem de formato inválido (item 3), confirma que `testGlm()` faz round-trip real ao provider em vez de só validar formato. Não deu pra reproduzir o cenário literal "sem internet" do item 4 sem desconectar a rede da máquina de smoke (fora de escopo seguro para esta sessão) — o *tipo* de erro (rede/API vs formato) já está confirmado como caminho distinto no código.
5. **Persistência real da key**: sessão de vault foi reaberta (unlock novo) entre os testes e o GLM continuou "configurada" — confirma que o save é persistido no vault, não só estado de UI.
6. **Picker de provider lista GLM/Grok mesmo sem key**: catálogo estático no composer (Workspace), consistente com F21.
7. **Selecionar Grok sem key salva**: aviso inline "Provider indisponível — Grok sem key salva — configure em #configuracao."; composer e botão de provider ficam desabilitados; thread não pode ser enviada.
8. **Light/dark**: cards GLM/Grok e estado de erro conferidos nos dois temas — tokens do Design Lock, sem hex solto, sem Lion*.

## Não exercitado neste smoke

- **Item 5** (`Testar conexão` com key GLM/Grok real) — pendente de credencial real do usuário, conforme já registrado no próprio `spec.md` (Assumption 3.3). Não bloqueante.
- **Item 8 do checklist original** (remover key de provider com threads antigas → thread abre somente leitura) — não reproduzido ao vivo porque nenhum turno real rodou com GLM/Grok nesta sessão (sem key válida). Spec já marca esse comportamento como herdado de F10 ("sem código novo, comportamento herdado"), não lógica nova de F23.

## Screenshots

- `smoke/f23_cards_dark.png` / `smoke/f23_cards_light.png` — visão geral de `#configuracao` com os cards
- `smoke/f23_glm_card_light.png` — card GLM configurado, tema claro
- `smoke/f23_grok_invalid_dark.png` — erro de formato inválido no Grok, tema escuro

# Plano de Implementação: F16. Composer Avançado

**Pré-requisitos:**
- Herdar stack/tooling de `docs/_shared/codebase-patterns.md` (Electron/Vite/React/Vitest/SQLite/`node:sqlite`, handlers HTTP loopback, validação manual).
- Dependências de produto já no repo: F01.1 (superfícies), F03 (workspace/composer base), F10 (providers/keys/status).
- **Bloqueio de UI visual:** `docs/F16-composer-avancado/ui.md` e `copy.md` ainda não existem. Contratos de dados/estado podem ser implementados e testados sem eles; composição visual e copy final exigem o processo Design · Processo (`CLAUDE.md`) **antes** de fechar a superfície do composer.
- Nenhuma variável de ambiente nova; imagens transitam no JSON do loopback com limites da spec.
- Delta de ficheiros: migração `006_composer_avancado`, handler de files, catálogo de provider, extensões de threads/dispatch/composer (ver spec §4).

---

### Fase 1: Catálogo, schema e APIs

**1. Catálogo de provider** - Adicionar o módulo de catálogo com models, defaults, reasoning levels e flag multimodal por provider, mais endpoint de leitura autenticado. Cobrir membership e defaults na suite unitária da spec.

**2. Persistência de reasoning na thread** - Criar a migração que adiciona reasoning à tabela de threads e estender o repositório/tipos espelhados no cliente HTTP. Garantir create/update/read do valor atual da thread.

**3. API de arquivos do projeto** - Implementar o handler de listagem com filtro, limite 50 e rejeição de escape fora do root do projeto; registrar no server loopback. Expor cliente no renderer para o menu `@`.

**4. Contratos de dispatch create/follow-up** - Estender bodies HTTP e `dispatch` para aceitar reasoning e imagens, validar contra o catálogo e regras de mime/tamanho/contagem, e rejeitar imagens em providers não multimodais. Persistir mensagem de utilizador com blocks de imagem quando houver anexos.

### Fase 2: Runner e prompt enriquecido

**5. ProviderTurnInput e drivers** - Propagar reasoning e imagens até os drivers; CLI materializa anexos de forma temporária quando multimodal; Minimax continua text-only e falha de forma tipada se receber imagens. Manter `--model` existente e encaminhar reasoning conforme o provider.

**6. Histórico e rehydrate** - Garantir que create/follow-up gravem content textual (com paths `@` já no texto) e blocks de imagem; history/WS continuam a servir as mensagens para o renderer.

### Fase 3: Composer no Workspace (contrato de estado; UI final após ui.md/copy.md)

**7. Estado do composer e fila** - Estender o draft e a fila local com reasoning e imagens; no send/follow-up enviar model/reasoning/images; ao enfileirar durante `running`, preservar snapshot de anexos e model/reasoning. Sincronizar selects com o provider locked da thread.

**8. Lógica de menção e anexos** - Extrair helpers testáveis para detecção da query `@`, debounce ≥ 150 ms, inserção de path relativo e validação client-side de imagens. Integrar menu e thumbnails no composer sem inventar anatomia final além do necessário para o contrato.

**9. Controles model/reasoning e CTA multimodal** - Ligar controles ao catálogo; desabilitar CTA de imagem com motivo quando `multimodal=false`; manter provider imutável após criar thread. Atualizar histórico para mostrar anexos/menções a partir dos blocks.

**10. Wiring PrincipalScreen** - Passar props/serviços novos ao composer e garantir que seleção de thread rehidrata model/reasoning atuais nos controles.

### Fase 4: Validação e fechamento

**11. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração HTTP + smoke §7.2). Confirmar critérios de aceitação PRD §9 F16 e o critério cross-feature Composer→Workspace. Sem `ui.md`/`copy.md`, o gate visual fica **adiado** ao processo de design; após esses ficheiros existirem, verificar light/dark, anatomia vs `ui.md` e strings vs `copy.md`. Gate técnico: suite e `pnpm build` verdes.

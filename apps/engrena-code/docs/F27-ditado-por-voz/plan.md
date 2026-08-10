# Plano de Implementação: F27. Ditado por Voz (STT)

**Pré-requisitos:**
- Herdar padrões de `docs/F27-ditado-por-voz/spec.md` §3.1 (vault por namespace, guard 423/401, roteamento por prefixo em `unlock-handler.ts`, payload binário via JSON base64 como F16, driver HTTP com key nunca exposta ao renderer, regra extraída para `*.logic.ts`)
- F01, F01.1, F03, F16 implementados (deps PRD)
- `docs/F27-ditado-por-voz/ui.md` e `copy.md` já existem — fonte de anatomia/copy
- Sem migração SQLite; sem dependência npm nova (Node 24 tem `FormData`/`Blob` nativos pro upload multipart aos providers)

---

### Fase 1: Keys e vault

**1. Namespace de vault e save de keys STT** - Adicionar `POST /api/config/voice/keys/save` em `config-handler.ts` salvando `voice:openai`/`voice:groq` (merge parcial, mesmo comportamento de `handleKeysSave`), e estender `computeConfigStatus()`/`ConfigStatus` com o campo `voice`.

**2. Card "Ditado por voz (transcrição)" em Configuração** - Montar `VoiceKeysCard` em `ConfiguracaoScreen.tsx` (2 campos, 1 CTA "Salvar chaves", copy de `voice.config.*`), sem CTA de teste de conexão.

### Fase 2: Transcrição server-side

**3. Validação de payload de áudio** - Criar `voice-audio.ts` com allowlist de MIME e estimativa de tamanho a partir do base64, mesmo padrão de `composer-images.ts` do F16.

**4. Cliente STT com fallback** - Criar `transcribe.ts` chamando OpenAI Whisper primeiro; em erro de rede/5xx com key Groq presente, tenta Groq; erro de auth nunca faz fallback. Erros tipados e mapeados pros códigos da spec §5.

**5. Endpoint de transcrição** - Criar `voice-handler.ts` com `POST /api/voice/transcribe` (guard, decodifica base64, valida, chama o cliente STT, mapeia erro pra status HTTP). Rotear o prefixo `/api/voice/` em `unlock-handler.ts` — atenção à lição de F25: prefixo não roteado no nível superior nunca chega ao guard e vaza `404` em vez de `423`.

### Fase 3: Permissão de mídia e captura no renderer

**6. Permissão de microfone no Electron** - Adicionar `session.setPermissionRequestHandler` em `src/main/index.ts` liberando `'media'` só pra origem da janela principal do app, nunca globalmente.

**7. Regras puras do ditado** - Criar `voiceInput.logic.ts` com a resolução de título do mic por estado (tabela do `ui.md`), inserção de texto na posição do cursor do textarea, e mapeamento de código de erro do backend pra id de copy.

**8. Hook de captura e state machine** - Criar `useVoiceInput.ts` orquestrando o ciclo do `MediaRecorder` (idle → requesting-permission → recording → transcribing → filling/error), timer de gravação, cancelamento por `Esc`, e a chamada ao serviço de transcrição — delegando toda decisão de copy/inserção ao módulo puro da Fase 3.7.

### Fase 4: Composer

**9. Botão mic no `TaskComposer`** - Montar o botão antes do `ComposerImageAttachments` (anatomia `ui.md` §A), consumindo estado/título/handlers do hook; feedback de erro/notice abaixo do composer conforme `ui.md`.

**10. Serviço HTTP no renderer** - Adicionar `voiceService.transcribe`/`voiceService.saveKeys` em `api-client.ts`, seguindo o padrão de fetch loopback autenticado já usado pelos demais serviços.

### Fase 5: Validação e fechamento

**11. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração + smoke). Confirmar os 4 ACs de F27 e o AC cross-feature com F16. UI: light/dark, anatomia vs `ui.md`, copy vs `copy.md`. Gate: suite e build verdes; regressão de roteamento `/api/voice/*` com vault travado devolvendo 423 (não 404).

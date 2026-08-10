# Smoke: F27. Ditado por Voz

**Data:** 2026-08-09
**Método:** app empacotado (`electron-builder --dir`) com `--remote-debugging-port=9222`, `ENGRENACODE_USER_DATA` isolado sob `%TEMP%\engrenacode_claude_d07smoke2`, CDP attach via `playwright-cli`. Vault e `userData` reais do usuário intocados. Necessário para F27 porque `getUserMedia`/permissão de microfone são geridos pelo `session.setPermissionRequestHandler` do Electron real — a janela de dev sem `contextBridge` não reflete esse comportamento. Sem key real de OpenAI/Groq disponível nesta sessão (mesma limitação de F23) — usada uma key sintaticamente válida mas falsa (`sk-fake-...`) para exercitar o fluxo de erro real ponta a ponta.

## Setup

- Reaproveitado o projeto fixture de F26 (`F26 Terminal Smoke`).
- Ambiente de automação forneceu um dispositivo de mídia (mic) utilizável pelo Chromium/Electron — a gravação real funcionou (rastro de áudio real capturado, ver item 3).

## Confirmado ao vivo

1. **Sem key salva → mic disabled**: com nenhuma key de voz salva, botão "Ditar por voz" no composer aparece `disabled`, `title="Configure a chave de transcrição (OpenAI/Groq) na Configuração"` (mensagem equivalente a `voice.title.noKey`).
2. **Salvar key habilita o mic sem reload**: key falsa da OpenAI salva em `#configuracao` (badge "configurada"); ao voltar para o Workspace **sem recarregar a página**, o botão "Ditar por voz" passa a `enabled` — confirma que o estado é reativo (evento/registro compartilhado), não depende de remount da tela.
3. **Gravação real ponta a ponta**: clique no mic → permissão concedida automaticamente pelo handler do Electron (`session.setPermissionRequestHandler` liberando `'media'` para a própria janela) → botão mostra timer contando (`00:06`, `00:17` em tentativas diferentes) → clique de novo para parar → `POST /api/voice/transcribe` disparado com o áudio real capturado.
4. **Key inválida → alerta correto, nada se perde**: como a key é falsa, o provider (real, via internet) rejeita — UI mostra `role="alert"` com o texto exato esperado: "Não foi possível transcrever. Tente novamente." (`voice.error.transcribe`); botão do mic volta a ficar clicável para nova tentativa, sem travar o composer.
5. **Light/dark**: card de configuração (`#configuracao`) e composer conferidos nos dois temas — tokens do Design Lock, sem hex solto, sem Lion*.

## Bug real encontrado e corrigido pelo smoke (🔴 severo)

O passo 4 acima, na primeira tentativa, **derrubou a sessão inteira do EngrenaCode** (voltou para a tela de unlock) em vez de só mostrar o alerta de erro. Causa: `voice-handler.ts` respondia `401` para o código `voice_auth_error` (key de provider de terceiro rejeitada). O cliente HTTP compartilhado do renderer (`api-client.ts:48`, usado por **todos** os `*-service.ts`) trata **qualquer** `401` de **qualquer** endpoint como "sessão do EngrenaCode inválida" e chama `window.electronAPI.vault.lock()` — um relock real, não só um redirect de UI. Como `401` já é reservado no app inteiro para "seu token de sessão expirou" (mesma convenção documentada no `CLAUDE.md`: guard 423 vault_locked antes de 401 unauthorized), reusar o mesmo código para "a OpenAI recusou sua key" quebra esse contrato — o usuário perde a sessão do app inteiro só por causa de uma credencial de terceiro errada.

Corrigido em `voice-handler.ts`: `voice_auth_error` agora responde `422` em vez de `401`. Confirmado seguro porque o mapeamento de copy no renderer (`voiceInput.logic.ts`, `mapTranscribeErrorCode`) já decide a mensagem pelo campo `error.code` do corpo JSON, não pelo status HTTP — nenhuma mudança necessária no renderer. Teste de regressão adicionado em `voice-handler.test.ts` (`returns 422 voice_auth_error (not 401)...`). `pnpm vitest run src/services/http/voice-handler.test.ts` — 8/8 verde; `api-client.test.ts` e `transcribe.test.ts` também verdes (18/18 no total). Rebuild (`vite build` + `electron-builder --dir`) + re-smoke confirmou: mesmo fluxo (key falsa, gravação real, parar, transcrever) agora resulta só no alerta de erro — sessão permanece autenticada, composer continua funcional.

## Não exercitado neste smoke

- **Item 3 (parcial)** — transcrição bem-sucedida com key real: sem credencial real disponível (mesma limitação de F23). O restante do item 3 (timer, spinner, inserção no textarea na posição do cursor) foi coberto pelo lado da gravação/erro; a inserção do texto transcrito em si depende de uma resposta `200` real do provider.
- **Item 4** (`Esc` durante gravação cancela sem chamar o endpoint) — tentativa ao vivo inconclusiva: o clique de iniciar gravação + `Esc` em sequência rápida via automação CDP correu risco de corrida com a etapa assíncrona de permissão/`getUserMedia`, e o teste não isolou de forma confiável se o `Esc` realmente interceptou antes do primeiro request. Lógica de cancelamento existe em `TaskComposer.tsx`, mas não tem teste unitário dedicado — recomendação: adicionar `*.logic.test.ts` cobrindo esse caminho antes de fechar como confirmado.
- **Item 6** (permissão de microfone negada pelo SO) — não reproduzido: o ambiente de smoke concedeu a permissão automaticamente (handler do Electron liberou `'media'` sem prompt interativo, e havia dispositivo de mídia disponível). Simular negação exigiria mockar `navigator.mediaDevices.getUserMedia` para rejeitar, o que também está fora do que dá pra forçar de fora do app nesta sessão.

## Screenshots

- `smoke/f27_config_card_light.png` / `smoke/f27_config_card_dark.png` — card "Ditado por voz" em `#configuracao`
- `smoke/f27_composer_light.png` — composer com mic habilitado

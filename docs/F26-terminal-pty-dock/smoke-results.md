# Smoke: F26. Terminal PTY Dock

**Data:** 2026-08-09
**Método:** app empacotado (`electron-builder --dir`) com `--remote-debugging-port=9222`, `ENGRENACODE_USER_DATA` isolado sob `%TEMP%\engrenacode_claude_d07smoke2`, CDP attach via `playwright-cli`. Vault e `userData` reais do usuário intocados. Necessário para F26 porque o PTY (`node-pty`) só existe no processo Electron real via IPC — a janela `pnpm dev` aberta como aba de browser comum (sem `window.electronAPI`, sem `contextBridge`) não expõe o dock de terminal; só o Electron empacotado tem a superfície completa.

## Setup

- 1 projeto fixture (`F26 Terminal Smoke`, `C:\d07smoke\engrenacode_claude_f26`, repo git real).

## Confirmado ao vivo

1. **Atalho `Ctrl+\`` abre o dock**: com o projeto selecionado, `Ctrl+Backquote` abre o dock inferior; "Terminal 1" aparece com prompt real do shell na cwd do projeto (`C:\d07smoke\engrenacode_claude_f26>`).
2. **`cd` imprime a cwd exata**: comando `cd` sem args ecoa `C:\d07smoke\engrenacode_claude_f26`, batendo com o path do projeto.
3. **2 abas independentes**: nova aba ("+ Nova aba") roda `echo SECOND_TAB_ONLY` só nela; ao voltar pra "Terminal 1", o histórico mostra só o `cd` anterior — sem vazamento entre sessões.
4. **Fechar aba mata o processo**: antes de fechar, `Get-CimInstance Win32_Process` (fora do app) mostrou 2 processos `cmd.exe` filhos do `EngrenaCode.exe`; ao clicar "Fechar aba" na 2ª aba, o PID correspondente some da lista (verificado via PowerShell, não só pela UI) — o outro PID (Terminal 1) continua vivo.
5. **Matar processo externamente**: `taskkill /PID <shell da Terminal 1> /F` fora do app → aba muda para "Sessão encerrada" / "Processo encerrado (código 1)." com botão "Reabrir"; clicar "Reabrir" cria sessão nova na mesma cwd (`C:\d07smoke\engrenacode_claude_f26>`).
6. **Light/dark**: dock conferido nos dois temas — cores do terminal seguem `xterm-theme.ts` (fundo escuro fixo, convenção comum de terminal, independente do tema do app); resto da UI segue tokens do Design Lock, sem hex solto, sem Lion*.

## Observação (não é bug do EngrenaCode)

Em um momento do smoke, um processo auxiliar interno do `node-pty` (`conpty_console_list_agent.js`, parte do backend ConPTY no Windows) lançou `Error: AttachConsole failed` no stderr do processo principal. O processo Electron principal **não** caiu — `Unlock server listening on :5174` continuou respondendo, a sessão continuou autenticada e o dock seguiu funcional após reconectar o CDP. É um comportamento interno de `node_modules/node-pty` (dependência de terceiros), não uma chamada do código do EngrenaCode — `pty-session-registry.ts` só chama `session.pty.kill()`, sem invocar esse agente diretamente. Registrado aqui como observação de robustez de dependência, não como achado acionável em `src/`.

## Não exercitado neste smoke

- **Item 5 do checklist** (`shell-resolver` sem `COMSPEC`/`SHELL` válido → erro `shell_not_found`): exigiria relançar o app inteiro com env manipulado (fora de escopo seguro nesta sessão, já que o app real do usuário roda na mesma máquina). Coberto por teste unitário real (`shell-resolver.test.ts`, `pty-session-registry.test.ts`).
- **Item 7 do checklist** (thread `executionMode='worktree'` → nova aba usa `worktreePath`): tentativa ao vivo interrompida por uma queda transitória da conexão CDP do `playwright-cli` (não do app — o app seguiu respondendo via HTTP loopback durante a queda) no meio do envio do turno que materializaria o worktree; não refeito por tempo. Coberto por teste unitário real (`pty-session-registry.test.ts`, resolução de `worktreePath` via `resolveThreadCwd`).

## Screenshots

- `smoke/f26_dock_dark.png` — dock aberto, tema escuro
- `smoke/f26_dock_light.png` — dock aberto, tema claro

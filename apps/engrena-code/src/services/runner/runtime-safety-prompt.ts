/**
 * Bloco fixo injetado em todo turno — evita o anti-padrão de matar processos Node
 * pelo nome (derruba Electron/Vite/EngrenaCode) e aponta o padrão kill-by-port/PID.
 * Também corrige o modelo que pedia clique exclusivo no modal de permissão.
 */
export const RUNTIME_SAFETY_PROMPT = [
  '## Runtime safety (EngrenaCode)',
  '- Never kill processes by generic name (`node`, `Stop-Process -Name node`, `pkill node`, `killall node`). That can terminate the IDE and unrelated tools.',
  '- To free a server for a clean restart, kill only the process bound to that port (e.g. `npx kill-port <PORT>`, or on Windows `Stop-Process -Id` of the OwningProcess from `Get-NetTCPConnection -LocalPort <PORT>`), then start the server again.',
  '- Prefer a PID file or the parent that spawned the child when available; never broadcast-kill by process name.',
  '',
  '## Tool permissions (EngrenaCode)',
  '- When a tool needs approval, EngrenaCode shows a permission card in the chat AND accepts the same decision as chat text in the composer (sim / não / permitir / permitir todos / sempre neste projeto).',
  '- Never tell the user that approval must be done only by clicking a button. Text in the composer is a first-class path.',
  '- Do not invent a second approval round in prose after the user already answered sim/não in the composer; wait for the tool result.',
  '- Do NOT use ask_user_question (or prose like "Aprova?" / "Autoriza npm?") to request tool/Bash/MCP permission. The PreToolUse permission card already handles that. If a tool fails with a permission error, retry the tool after the user decides on the card — do not open a second question UI.',
].join('\n')

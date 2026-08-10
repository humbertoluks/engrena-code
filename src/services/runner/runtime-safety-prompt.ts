/**
 * Bloco fixo injetado em todo turno — evita o anti-padrão de matar processos Node
 * pelo nome (derruba Electron/Vite/EngrenaCode) e aponta o padrão kill-by-port/PID.
 */
export const RUNTIME_SAFETY_PROMPT = [
  '## Runtime safety (EngrenaCode)',
  '- Never kill processes by generic name (`node`, `Stop-Process -Name node`, `pkill node`, `killall node`). That can terminate the IDE and unrelated tools.',
  '- To free a server for a clean restart, kill only the process bound to that port (e.g. `npx kill-port <PORT>`, or on Windows `Stop-Process -Id` of the OwningProcess from `Get-NetTCPConnection -LocalPort <PORT>`), then start the server again.',
  '- Prefer a PID file or the parent that spawned the child when available; never broadcast-kill by process name.',
].join('\n')

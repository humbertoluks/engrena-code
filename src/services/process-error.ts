/**
 * Redacts secrets and shortens absolute paths before process stderr reaches the UI.
 */
export function sanitizeProcessError(raw: string, max = 300): string {
  let text = raw
    .replace(/x-access-token:[^@\s]+@/gi, 'x-access-token:***@')
    .replace(/ghp_[A-Za-z0-9]+/g, 'ghp_***')
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, 'sk-ant-***')
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')

  // Windows and POSIX absolute paths → basename
  text = text.replace(/(?:[A-Za-z]:\\|\/)(?:[^\s:\\/]+[\\/])+([^\s:\\/]+)/g, '…/$1')

  const trimmed = text.trim()
  return trimmed.length > max ? trimmed.slice(-max) : trimmed
}

/** Cauda de stderr de erro de execFile/spawn, já sanitizada. */
export function stderrTail(err: unknown, max = 300): string {
  const raw =
    err && typeof err === 'object' && 'stderr' in err && typeof (err as { stderr?: unknown }).stderr === 'string'
      ? ((err as { stderr: string }).stderr as string)
      : err instanceof Error
        ? err.message
        : String(err)
  return sanitizeProcessError(raw, max)
}

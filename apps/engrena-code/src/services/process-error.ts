/**
 * Redacts secrets and shortens absolute paths before process stderr reaches the UI.
 */
export function sanitizeProcessError(raw: string, max = 300): string {
  // Windows and POSIX absolute paths → basename. Runs *before* secret redaction: once userinfo
  // like "oauth2:secret@" loses its ':' below, the leftover "***@host/org/repo.git" looks like a
  // plain path itself and this regex would eat the "***@" redaction marker along with it.
  let text = raw.replace(/(?:[A-Za-z]:\\|\/)(?:[^\s:\\/]+[\\/])+([^\s:\\/]+)/g, '…/$1')

  text = text
    .replace(/x-access-token:[^@\s]+@/gi, 'x-access-token:***@')
    .replace(/ghp_[A-Za-z0-9]+/g, 'ghp_***')
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, 'sk-ant-***')
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
    // Generic HTTPS userinfo — covers GitLab oauth2:/Bitbucket x-token-auth:/Azure :<token>@ (F24).
    // Password segment excludes a leading '*' so this doesn't re-match (and eat the label off of)
    // userinfo the x-access-token pattern above already redacted to "x-access-token:***@".
    .replace(/https:\/\/[^/@\s]*:[^*/@\s][^/@\s]*@/gi, 'https://***@')
    .replace(/xai-[A-Za-z0-9_-]+/g, 'xai-***')
    .replace(/gsk_[A-Za-z0-9_-]+/g, 'gsk_***')

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

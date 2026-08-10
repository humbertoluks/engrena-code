/**
 * Parse paths from `git status --porcelain` stdout (one entry per line).
 * Renames use the destination path after ` -> `.
 */
export function parseDirtyPathsFromPorcelain(statusOut: string): string[] {
  const paths: string[] = []
  for (const raw of statusOut.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (line.length < 4) continue
    let pathPart = line.slice(3)
    const arrow = pathPart.lastIndexOf(' -> ')
    if (arrow !== -1) pathPart = pathPart.slice(arrow + 4)
    if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
      try {
        pathPart = JSON.parse(pathPart) as string
      } catch {
        pathPart = pathPart.slice(1, -1)
      }
    }
    paths.push(pathPart.split('\\').join('/'))
  }
  return paths
}

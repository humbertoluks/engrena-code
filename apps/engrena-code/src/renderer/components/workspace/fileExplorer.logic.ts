/** Nested directory node built from flat relative paths. */
export interface FileTreeDir {
  name: string
  path: string
  dirs: Map<string, FileTreeDir>
  files: { name: string; path: string }[]
}

export function makeFileTreeDir(name: string, path: string): FileTreeDir {
  return { name, path, dirs: new Map(), files: [] }
}

/** Build a nested tree from posix-relative file paths. */
export function buildFileTree(paths: readonly string[]): FileTreeDir {
  const root = makeFileTreeDir('', '')
  for (const path of paths) {
    const parts = path.split('/').filter((p) => p.length > 0)
    if (parts.length === 0) continue
    let node = root
    for (let i = 0; i < parts.length - 1; i += 1) {
      const name = parts[i]
      const dirPath = parts.slice(0, i + 1).join('/')
      let child = node.dirs.get(name)
      if (!child) {
        child = makeFileTreeDir(name, dirPath)
        node.dirs.set(name, child)
      }
      node = child
    }
    const fileName = parts[parts.length - 1]
    node.files.push({ name: fileName, path })
  }
  return root
}

export function sortedFileTreeDirs(dir: FileTreeDir): FileTreeDir[] {
  return [...dir.dirs.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )
}

export function sortedFileTreeFiles(dir: FileTreeDir): { name: string; path: string }[] {
  return [...dir.files].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/** Ancestor directories of changed files (for orange highlight on folders). */
export function changedAncestorDirs(changedFiles: readonly string[]): Set<string> {
  const dirs = new Set<string>()
  for (const file of changedFiles) {
    const parts = file.split('/')
    for (let i = 1; i < parts.length; i += 1) {
      dirs.add(parts.slice(0, i).join('/'))
    }
  }
  return dirs
}

export const FILE_FILTER_MATCH_CAP = 200

/** Substring filter over full paths; empty needle means "no filter". */
export function filterProjectFilePaths(
  paths: readonly string[],
  needle: string,
  cap = FILE_FILTER_MATCH_CAP,
): string[] | null {
  const q = needle.trim().toLowerCase()
  if (q.length === 0) return null
  return paths.filter((p) => p.toLowerCase().includes(q)).slice(0, cap)
}

/** Explorer list request uses a high limit; mentions keep the F16 default of 50. */
export const FILE_EXPLORER_LIST_LIMIT = 5000

export type VcsKind = 'github' | 'gitlab' | 'bitbucket' | 'azure'

export interface ParsedVcsRemote {
  kind: VcsKind
  owner: string
  repo: string
  /** Azure DevOps só: organização (separada de `owner`/namespace dos demais hosts). */
  org?: string
}

/** Extrai kind + identidade do `origin` (spec §6) — clouds públicas apenas (github.com/gitlab.com/bitbucket.org/dev.azure.com/*.visualstudio.com). */
export function parseVcsRemote(url: string): ParsedVcsRemote | null {
  const github = /github\.com[/:]([^/]+)\/([^/.]+?)(\.git)?$/.exec(url)
  if (github) return { kind: 'github', owner: github[1], repo: github[2] }

  const gitlab = /gitlab\.com[/:](.+)\/([^/.]+?)(\.git)?$/.exec(url)
  if (gitlab) return { kind: 'gitlab', owner: gitlab[1], repo: gitlab[2] }

  const bitbucket = /bitbucket\.org[/:]([^/]+)\/([^/.]+?)(\.git)?$/.exec(url)
  if (bitbucket) return { kind: 'bitbucket', owner: bitbucket[1], repo: bitbucket[2] }

  const azureModern = /dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/.]+?)(\.git)?$/.exec(url)
  if (azureModern) return { kind: 'azure', org: azureModern[1], owner: azureModern[2], repo: azureModern[3] }

  const azureLegacy = /([^./]+)\.visualstudio\.com\/([^/]+)\/_git\/([^/.]+?)(\.git)?$/.exec(url)
  if (azureLegacy) return { kind: 'azure', org: azureLegacy[1], owner: azureLegacy[2], repo: azureLegacy[3] }

  return null
}

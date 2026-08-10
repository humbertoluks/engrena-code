import { describe, expect, it } from 'vitest'
import { parseVcsRemote } from './remote.js'

describe('parseVcsRemote', () => {
  it('parse_gitlab_https_and_ssh — kind=gitlab + path (incl. subgroups)', () => {
    expect(parseVcsRemote('https://gitlab.com/acme/app.git')).toEqual({ kind: 'gitlab', owner: 'acme', repo: 'app' })
    expect(parseVcsRemote('git@gitlab.com:acme/app.git')).toEqual({ kind: 'gitlab', owner: 'acme', repo: 'app' })
    expect(parseVcsRemote('https://gitlab.com/acme/team/app.git')).toEqual({ kind: 'gitlab', owner: 'acme/team', repo: 'app' })
  })

  it('parses github.com https and ssh', () => {
    expect(parseVcsRemote('https://github.com/acme/app.git')).toEqual({ kind: 'github', owner: 'acme', repo: 'app' })
    expect(parseVcsRemote('git@github.com:acme/app.git')).toEqual({ kind: 'github', owner: 'acme', repo: 'app' })
  })

  it('parses bitbucket.org https and ssh', () => {
    expect(parseVcsRemote('https://bitbucket.org/acme/app.git')).toEqual({ kind: 'bitbucket', owner: 'acme', repo: 'app' })
    expect(parseVcsRemote('git@bitbucket.org:acme/app.git')).toEqual({ kind: 'bitbucket', owner: 'acme', repo: 'app' })
  })

  it('parses dev.azure.com and the legacy *.visualstudio.com host', () => {
    expect(parseVcsRemote('https://dev.azure.com/acme/proj/_git/app')).toEqual({
      kind: 'azure',
      org: 'acme',
      owner: 'proj',
      repo: 'app',
    })
    expect(parseVcsRemote('https://acme.visualstudio.com/proj/_git/app')).toEqual({
      kind: 'azure',
      org: 'acme',
      owner: 'proj',
      repo: 'app',
    })
  })

  it('parse_unknown_host — null for unsupported hosts (self-hosted, others)', () => {
    expect(parseVcsRemote('https://git.internal.example.com/acme/app.git')).toBeNull()
    expect(parseVcsRemote('https://gitlab.example.com/acme/app.git')).toBeNull()
    expect(parseVcsRemote('not a url at all')).toBeNull()
  })
})

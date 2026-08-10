import { describe, expect, it } from 'vitest'
import { buildPtyEnv } from './pty-env.js'

describe('buildPtyEnv', () => {
  it('drops provider/vault secrets that are not on the allowlist', () => {
    const source = {
      PATH: '/usr/bin',
      ANTHROPIC_API_KEY: 'sk-ant-secretvalue',
      GITHUB_PAT: 'ghp_secretvalue',
      OPENAI_API_KEY: 'sk-secretvalue',
    }
    const env = buildPtyEnv(source)
    expect(env).toEqual({ PATH: '/usr/bin' })
  })

  it('keeps PATH/HOME/TERM/COMSPEC when present', () => {
    const source = {
      PATH: '/usr/bin',
      HOME: '/home/user',
      TERM: 'xterm-256color',
      COMSPEC: 'C:\\Windows\\System32\\cmd.exe',
    }
    expect(buildPtyEnv(source)).toEqual(source)
  })

  it('omits allowlisted keys that are absent from the source instead of setting them to undefined', () => {
    const env = buildPtyEnv({ PATH: '/usr/bin' })
    expect(env).toEqual({ PATH: '/usr/bin' })
    expect('HOME' in env).toBe(false)
  })

  it('returns an empty object for an empty source', () => {
    expect(buildPtyEnv({})).toEqual({})
  })
})

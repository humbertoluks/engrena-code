import { describe, expect, it } from 'vitest'
import { MCP_CATALOG, getMcpPreset, listMcpPresets } from './catalog.js'

describe('listMcpPresets', () => {
  it('returns the full static catalog', () => {
    expect(listMcpPresets()).toBe(MCP_CATALOG)
    expect(listMcpPresets().length).toBeGreaterThan(0)
  })

  it('every preset has a unique id and a shape consistent with its authMode/transport', () => {
    const ids = new Set<string>()
    for (const preset of MCP_CATALOG) {
      expect(ids.has(preset.id)).toBe(false)
      ids.add(preset.id)

      if (preset.authMode === 'oauth') {
        expect(preset.remoteUrl).toBeTruthy()
        expect(preset.transport === 'http' || preset.transport === 'sse').toBe(true)
      }
      if (preset.transport === 'stdio') {
        expect(preset.command).toBeTruthy()
      }
    }
  })
})

describe('getMcpPreset', () => {
  it('finds a known preset by id', () => {
    expect(getMcpPreset('github')?.name).toBe('github')
  })

  it('returns undefined for an unknown id', () => {
    expect(getMcpPreset('does-not-exist')).toBeUndefined()
  })
})

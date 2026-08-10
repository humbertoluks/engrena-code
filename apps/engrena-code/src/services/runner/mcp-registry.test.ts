import { describe, expect, it, vi } from 'vitest'
import type { Mcp } from '../db/repositories/mcps.js'

const resolveForProjectMock = vi.fn<(projectId: string) => Mcp[]>()

vi.mock('../db/repositories/mcps.js', () => ({
  resolveForProject: (projectId: string) => resolveForProjectMock(projectId),
}))

const { McpRegistry } = await import('./mcp-registry.js')

function makeMcp(overrides: Partial<Mcp> = {}): Mcp {
  return {
    id: 'mcp_1',
    name: 'linear',
    description: null,
    transport: 'stdio',
    command: 'linear-mcp',
    args: [],
    env: {},
    url: null,
    headers: {},
    category: null,
    enabled: true,
    presetId: null,
    authMode: 'none',
    oauthStatus: null,
    oauthClientId: null,
    ...overrides,
  } as Mcp
}

describe('McpRegistry.resolveForProject', () => {
  it('delegates straight to the repository resolveForProject with the given projectId', () => {
    const mcps = [makeMcp()]
    resolveForProjectMock.mockReturnValueOnce(mcps)

    const result = McpRegistry.resolveForProject('proj_1')

    expect(resolveForProjectMock).toHaveBeenCalledWith('proj_1')
    expect(result).toBe(mcps)
  })

  it('returns an empty list when the project has no linked/enabled MCPs', () => {
    resolveForProjectMock.mockReturnValueOnce([])
    expect(McpRegistry.resolveForProject('proj_empty')).toEqual([])
  })
})

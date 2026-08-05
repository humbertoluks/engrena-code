import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f09_mcps_'))
const projectDir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f09_project_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const {
  createMcp,
  updateMcp,
  deleteMcp,
  listMcps,
  setProjectMcpLink,
  unlinkProjectMcp,
  listProjectMcps,
  resolveForProject,
  reorderProjectMcp,
  McpError,
} = await import('./mcps.js')

beforeEach(() => {
  getDb().exec('DELETE FROM project_mcps')
  getDb().exec('DELETE FROM mcps')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(projectDir, { recursive: true, force: true })
})

describe('createMcp', () => {
  it('rejects_reserved_name', () => {
    expect(() => createMcp({ name: 'engrenacode', transport: 'stdio', command: 'npx' })).toThrow(McpError)
  })

  it('rejects_invalid_name_pattern', () => {
    expect(() => createMcp({ name: 'Github MCP', transport: 'stdio', command: 'npx' })).toThrow(McpError)
  })

  it('rejects_duplicate_name', () => {
    createMcp({ name: 'github', transport: 'stdio', command: 'npx' })
    try {
      createMcp({ name: 'github', transport: 'stdio', command: 'npx' })
      expect.unreachable()
    } catch (err) {
      expect((err as InstanceType<typeof McpError>).code).toBe('mcp_name_conflict')
    }
  })

  it('rejects_stdio_without_command', () => {
    expect(() => createMcp({ name: 'foo', transport: 'stdio' })).toThrow(McpError)
  })

  it('rejects_non_https_remote_url', () => {
    expect(() => createMcp({ name: 'foo', transport: 'http', url: 'http://mcp.example.com' })).toThrow(McpError)
  })

  it('accepts_http_loopback_url', () => {
    const mcp = createMcp({ name: 'foo', transport: 'http', url: 'http://127.0.0.1:9000/mcp' })
    expect(mcp.url).toBe('http://127.0.0.1:9000/mcp')
  })

  it('rejects_vault_ref_in_header', () => {
    expect(() =>
      createMcp({ name: 'foo', transport: 'http', url: 'https://mcp.example.com', headers: { Authorization: 'vault:token' } })
    ).toThrow(McpError)
  })

  it('creates_stdio_with_env_secret_ref', () => {
    const mcp = createMcp({ name: 'github', transport: 'stdio', command: 'npx', args: ['-y', 'server'], env: { TOKEN: 'vault:github_token' } })
    expect(mcp.env.TOKEN).toBe('vault:github_token')
    expect(mcp.args).toEqual(['-y', 'server'])
  })
})

describe('updateMcp / deleteMcp', () => {
  it('updates_fields_and_preserves_unset', () => {
    const created = createMcp({ name: 'github', transport: 'stdio', command: 'npx', description: 'desc' })
    const updated = updateMcp(created.id, { description: 'nova desc' })
    expect(updated?.description).toBe('nova desc')
    expect(updated?.command).toBe('npx')
  })

  it('deletes_and_removes_from_list', () => {
    const created = createMcp({ name: 'github', transport: 'stdio', command: 'npx' })
    expect(deleteMcp(created.id)).toBe(true)
    expect(listMcps().find((m) => m.id === created.id)).toBeUndefined()
  })
})

describe('project link', () => {
  it('links_unlinks_and_resolves_for_turn', () => {
    const project = createProject({ path: projectDir })
    const mcp = createMcp({ name: 'github', transport: 'stdio', command: 'npx' })

    let states = listProjectMcps(project.id)
    expect(states.find((m) => m.id === mcp.id)?.linked).toBe(false)

    setProjectMcpLink(project.id, mcp.id, { enabled: true })
    states = listProjectMcps(project.id)
    expect(states.find((m) => m.id === mcp.id)?.linked).toBe(true)
    expect(resolveForProject(project.id).map((m) => m.id)).toEqual([mcp.id])

    unlinkProjectMcp(project.id, mcp.id)
    expect(resolveForProject(project.id)).toEqual([])
  })

  it('excludes_disabled_global_mcp_from_resolve', () => {
    const project = createProject({ path: projectDir })
    const mcp = createMcp({ name: 'github', transport: 'stdio', command: 'npx', enabled: false })
    setProjectMcpLink(project.id, mcp.id, { enabled: true })
    expect(resolveForProject(project.id)).toEqual([])
  })

  it('reorders_linked_mcps', () => {
    const project = createProject({ path: projectDir })
    const a = createMcp({ name: 'aaa', transport: 'stdio', command: 'npx' })
    const b = createMcp({ name: 'bbb', transport: 'stdio', command: 'npx' })
    setProjectMcpLink(project.id, a.id, { enabled: true, sortOrder: 0 })
    setProjectMcpLink(project.id, b.id, { enabled: true, sortOrder: 1 })

    reorderProjectMcp(project.id, b.id, 'up')
    expect(resolveForProject(project.id).map((m) => m.id)).toEqual([b.id, a.id])
  })
})

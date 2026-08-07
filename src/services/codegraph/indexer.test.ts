import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const userData = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f19_indexer_'))
process.env.ENGRENACODE_USER_DATA = userData

const { buildIndex, reindexFile } = await import('./indexer.js')
const { findDefinition, findReferences, moduleDeps } = await import('./query.js')
const { getStatusPayload, loadIndex } = await import('./store.js')

function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f19_proj_'))
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content, 'utf-8')
  }
  return root
}

describe('codegraph indexer + query', () => {
  it('test_index_ts_finds_function_definition', () => {
    const root = makeProject({
      'src/foo.ts': 'export function Foo() {\n  return 1\n}\n',
    })
    const { index } = buildIndex('p-def', root)
    const { hits } = findDefinition(index, 'Foo')
    expect(hits.length).toBeGreaterThanOrEqual(1)
    expect(hits[0]?.file).toBe('src/foo.ts')
    expect(hits[0]?.line).toBe(1)
    expect(hits[0]?.kind).toBe('function')
    rmSync(root, { recursive: true, force: true })
  })

  it('test_find_references_lists_usages', () => {
    const root = makeProject({
      'src/a.ts': 'export function Foo() { return 1 }\n',
      'src/b.ts': "import { Foo } from './a'\nFoo()\nFoo()\n",
    })
    const { index } = buildIndex('p-refs', root)
    const { hits } = findReferences(index, 'Foo')
    expect(hits.length).toBeGreaterThanOrEqual(2)
    rmSync(root, { recursive: true, force: true })
  })

  it('test_module_deps_imports', () => {
    const root = makeProject({
      'src/a.ts': 'export const x = 1\n',
      'src/b.ts': "import { x } from './a'\nexport const y = x\n",
    })
    const { index } = buildIndex('p-deps', root)
    const { deps } = moduleDeps(index, 'src/b.ts')
    expect(deps.imports).toContain('./a')
    rmSync(root, { recursive: true, force: true })
  })

  it('test_python_file_textual_fallback', () => {
    const root = makeProject({
      'lib/util.py': 'def Foo():\n    return 1\n\nFoo()\n',
      'src/keep.ts': 'export const keep = 1\n',
    })
    const { index } = buildIndex('p-py', root)
    const { hits, text } = findDefinition(index, 'Foo')
    expect(text).not.toMatch(/throw/i)
    // textual hit or empty useful — must not throw
    expect(Array.isArray(hits)).toBe(true)
    if (hits.length > 0) {
      expect(hits[0]?.file).toBe('lib/util.py')
    }
    rmSync(root, { recursive: true, force: true })
  })

  it('test_unsupported_no_ts_js', () => {
    const root = makeProject({
      'README.md': '# hello\n',
    })
    const { meta } = buildIndex('p-unsup', root)
    expect(meta.status).toBe('unsupported')
    expect(getStatusPayload('p-unsup').status).toBe('unsupported')
    rmSync(root, { recursive: true, force: true })
  })

  it('test_accept_reindexes_changed_file', () => {
    const root = makeProject({
      'src/foo.ts': 'export function Foo() { return 1 }\n',
    })
    buildIndex('p-re', root)
    writeFileSync(join(root, 'src/foo.ts'), 'export function Foo() { return 1 }\nexport function Bar() { return 2 }\n')
    reindexFile('p-re', root, 'src/foo.ts')
    const index = loadIndex('p-re')
    expect(index).not.toBeNull()
    const { hits } = findDefinition(index!, 'Bar')
    expect(hits.length).toBeGreaterThanOrEqual(1)
    rmSync(root, { recursive: true, force: true })
  })
})

afterAll(() => {
  rmSync(userData, { recursive: true, force: true })
})

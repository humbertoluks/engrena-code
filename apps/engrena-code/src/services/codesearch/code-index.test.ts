import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_codesearch_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { clearIgnoreCache } = await import('../ignore/ignore-service.js')
const { indexProject, searchProject, clearProjectIndex } = await import('./code-index.js')

let root: string
let projectId: string

beforeEach(() => {
  getDb().exec('DELETE FROM code_chunks')
  getDb().exec('DELETE FROM code_chunk_files')
  getDb().exec('DELETE FROM projects')
  clearIgnoreCache()
  root = mkdtempSync(join(tmpdir(), 'engrenacode_claude_codesearch_proj_'))
  projectId = createProject({ path: root }).id
})

afterAll(() => closeDb())

describe('indexProject', () => {
  it('indexa arquivos de texto e ignora binário e lockfile', () => {
    writeFileSync(join(root, 'app.ts'), 'export function criarServidor() { return 1 }')
    writeFileSync(join(root, 'package-lock.json'), '{"lockfileVersion": 3}')
    writeFileSync(join(root, 'imagem.png'), Buffer.from([0, 1, 2, 3, 0]))

    const result = indexProject(projectId, root)
    expect(result.indexedFiles).toBe(1)
    expect(result.chunks).toBeGreaterThan(0)
  })

  it('reindexa só o que mudou', () => {
    writeFileSync(join(root, 'a.ts'), 'const a = 1')
    writeFileSync(join(root, 'b.ts'), 'const b = 2')
    expect(indexProject(projectId, root).indexedFiles).toBe(2)

    const again = indexProject(projectId, root)
    expect(again.indexedFiles).toBe(0)

    writeFileSync(join(root, 'a.ts'), 'const a = 99')
    const third = indexProject(projectId, root)
    expect(third.indexedFiles).toBe(1)
  })

  it('remove do índice o arquivo apagado', () => {
    writeFileSync(join(root, 'temp.ts'), 'const temporario = 1')
    indexProject(projectId, root)
    expect(searchProject(projectId, 'temporario')).toHaveLength(1)

    rmSync(join(root, 'temp.ts'))
    const result = indexProject(projectId, root)
    expect(result.removedFiles).toBe(1)
    expect(searchProject(projectId, 'temporario')).toHaveLength(0)
  })

  it('respeita .engrenaignore', () => {
    mkdirSync(join(root, 'secrets'))
    writeFileSync(join(root, 'secrets', 'chave.ts'), 'const segredoAbsoluto = 1')
    writeFileSync(join(root, 'publico.ts'), 'const segredoAbsoluto = 2')
    writeFileSync(join(root, '.engrenaignore'), 'secrets/')
    clearIgnoreCache()

    indexProject(projectId, root)
    const hits = searchProject(projectId, 'segredoAbsoluto')
    expect(hits.map((h) => h.path)).toEqual(['publico.ts'])
  })
})

describe('searchProject', () => {
  it('acha o arquivo pelo termo e devolve linhas do trecho', () => {
    writeFileSync(join(root, 'servidor.ts'), ['import express from "express"', '', 'const app = express()'].join('\n'))
    indexProject(projectId, root)

    const hits = searchProject(projectId, 'express')
    expect(hits).toHaveLength(1)
    expect(hits[0].path).toBe('servidor.ts')
    expect(hits[0].startLine).toBe(1)
    expect(hits[0].snippet).toContain('express')
  })

  it('devolve no máximo um trecho por arquivo e respeita o limite', () => {
    const longFile = Array.from({ length: 300 }, (_, i) => `const alvoRepetido${i} = 'alvoRepetido'`).join('\n')
    writeFileSync(join(root, 'grande.ts'), longFile)
    writeFileSync(join(root, 'outro.ts'), "const alvoRepetido = 'alvoRepetido'")
    indexProject(projectId, root)

    const hits = searchProject(projectId, 'alvoRepetido', 5)
    expect(hits).toHaveLength(2)
    expect(new Set(hits.map((h) => h.path)).size).toBe(2)
  })

  it('consulta vazia ou sem termo útil não devolve nada', () => {
    writeFileSync(join(root, 'a.ts'), 'const a = 1')
    indexProject(projectId, root)
    expect(searchProject(projectId, '')).toEqual([])
    expect(searchProject(projectId, 'a b')).toEqual([])
  })

  it('não vaza resultado entre projetos', () => {
    writeFileSync(join(root, 'unico.ts'), 'const marcadorExclusivo = 1')
    indexProject(projectId, root)

    const otherRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_codesearch_other_'))
    const otherId = createProject({ path: otherRoot }).id
    expect(searchProject(otherId, 'marcadorExclusivo')).toHaveLength(0)
    rmSync(otherRoot, { recursive: true, force: true })
  })

  it('clearProjectIndex esvazia o índice do projeto', () => {
    writeFileSync(join(root, 'a.ts'), 'const alvoDoClear = 1')
    indexProject(projectId, root)
    clearProjectIndex(projectId)
    expect(searchProject(projectId, 'alvoDoClear')).toHaveLength(0)
  })
})

import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { resolveAgainstRoot, resolveWithinRoot } from './project-path-scope.js'

// Raiz real no disco: metade do valor deste módulo está em `realpath`, e isso não dá para
// simular com string.
const base = mkdtempSync(path.join(tmpdir(), 'engrenacode_f31_scope_'))
const root = path.join(base, 'projeto')
mkdirSync(path.join(root, 'src'), { recursive: true })
writeFileSync(path.join(root, 'src', 'a.ts'), '// a\n')
mkdirSync(path.join(base, 'fora'), { recursive: true })
writeFileSync(path.join(base, 'fora', 'segredo.txt'), 'x\n')

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
})

describe('resolveWithinRoot — dentro', () => {
  it('caminho relativo simples', () => {
    expect(resolveWithinRoot(root, 'src/a.ts')).toBe('inside')
    expect(resolveWithinRoot(root, 'novo.txt')).toBe('inside')
  })

  it('arquivo que ainda não existe (o caso do mkdir/touch)', () => {
    expect(resolveWithinRoot(root, 'src/ainda/nao/existe.ts')).toBe('inside')
  })

  it('caminho absoluto dentro da raiz', () => {
    expect(resolveWithinRoot(root, path.join(root, 'src', 'a.ts'))).toBe('inside')
  })

  it('`..` que volta para dentro continua dentro', () => {
    expect(resolveWithinRoot(root, 'src/../outro.txt')).toBe('inside')
  })
})

describe('resolveWithinRoot — fora', () => {
  it('`..` que sai da raiz', () => {
    expect(resolveWithinRoot(root, '../fora.ts')).toBe('outside')
    // Comparação de string crua deixaria este passar: o prefixo bate.
    expect(resolveWithinRoot(root, '../../etc/x')).toBe('outside')
  })

  it('caminho absoluto de outro lugar', () => {
    expect(resolveWithinRoot(root, path.join(base, 'fora', 'segredo.txt'))).toBe('outside')
  })

  it('symlink dentro da raiz apontando para fora', () => {
    const link = path.join(root, 'atalho')
    try {
      symlinkSync(path.join(base, 'fora'), link, 'dir')
    } catch {
      // Windows sem privilégio de symlink: o caso não é testável nesta máquina.
      return
    }
    // Sem `realpath` este caminho "está dentro" por texto, e a escrita cai fora do projeto.
    expect(resolveWithinRoot(root, 'atalho/segredo.txt')).toBe('outside')
  })

  it('.git é protegido mesmo estando dentro da raiz', () => {
    // `.git/hooks/*` é código que o git executa no próximo commit: liberar escrita ali
    // transformaria "editar arquivo" em execução arbitrária, sem card nenhum.
    expect(resolveWithinRoot(root, '.git/hooks/pre-commit')).toBe('outside')
    expect(resolveWithinRoot(root, 'src/../.git/config')).toBe('outside')
  })
})

describe('resolveWithinRoot — indecidível', () => {
  it('glob, variável, substituição e til não têm destino antes da expansão', () => {
    for (const candidate of ['*.ts', 'src/*', '$HOME/x', '${HOME}/x', '~/x', '$(cat alvo)', '%APPDATA%/x']) {
      expect(resolveWithinRoot(root, candidate)).toBe('undecidable')
    }
  })

  it('raiz vazia ou relativa não julga nada', () => {
    expect(resolveWithinRoot('', 'a.txt')).toBe('undecidable')
    expect(resolveWithinRoot('   ', 'a.txt')).toBe('undecidable')
    expect(resolveWithinRoot('relativo/projeto', 'a.txt')).toBe('undecidable')
  })

  it('candidato vazio', () => {
    expect(resolveWithinRoot(root, '')).toBe('undecidable')
    expect(resolveWithinRoot(root, '   ')).toBe('undecidable')
  })
})

describe('resolveAgainstRoot', () => {
  it('devolve o absoluto resolvido para o log de auditoria', () => {
    expect(resolveAgainstRoot(root, 'src/a.ts')).toBe(path.join(root, 'src', 'a.ts'))
  })

  it('null quando não dá para resolver', () => {
    expect(resolveAgainstRoot(root, '$HOME/x')).toBeNull()
    expect(resolveAgainstRoot('', 'a.txt')).toBeNull()
  })
})

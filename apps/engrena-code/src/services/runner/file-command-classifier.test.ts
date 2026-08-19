import { describe, expect, it } from 'vitest'
import { cdTarget, classifyFileCommand, FILE_EDIT_VERBS } from './file-command-classifier.js'

/**
 * A tabela adversarial **faz parte** do critério de aceitação da F31, não é extra: o que este
 * classificador libera roda sem card e escreve em disco. Todo caso que não casa exatamente com uma
 * forma conhecida tem que sair como `unknown`.
 */
describe('classifyFileCommand — formas que sabemos ler', () => {
  it('mkdir com e sem -p', () => {
    expect(classifyFileCommand('mkdir src/novo')).toEqual({
      kind: 'file-edit',
      verb: 'mkdir',
      paths: ['src/novo'],
    })
    expect(classifyFileCommand('mkdir -p src/a/b')).toEqual({
      kind: 'file-edit',
      verb: 'mkdir',
      paths: ['src/a/b'],
    })
  })

  it('flags curtas agrupadas continuam sendo flags', () => {
    expect(classifyFileCommand('mkdir -pv src/a')).toMatchObject({ kind: 'file-edit', paths: ['src/a'] })
  })

  it('touch com vários arquivos', () => {
    expect(classifyFileCommand('touch a.txt b.txt')).toEqual({
      kind: 'file-edit',
      verb: 'touch',
      paths: ['a.txt', 'b.txt'],
    })
  })

  it('cp e mv leem origem e destino como caminhos', () => {
    expect(classifyFileCommand('cp a.ts b.ts')).toEqual({
      kind: 'file-edit',
      verb: 'cp',
      paths: ['a.ts', 'b.ts'],
    })
    expect(classifyFileCommand('mv -f a.ts dir/b.ts')).toEqual({
      kind: 'file-edit',
      verb: 'mv',
      paths: ['a.ts', 'dir/b.ts'],
    })
  })

  it('sed: o script não é caminho, o arquivo é', () => {
    // `-i` escreve no arquivo; sem `-i` o sed só imprime. Os dois passam porque em ambos os casos
    // o único arquivo tocado é o mesmo, e é ele que vai ser julgado contra a raiz.
    expect(classifyFileCommand('sed -i s/a/b/ a.txt')).toEqual({
      kind: 'file-edit',
      verb: 'sed',
      paths: ['a.txt'],
    })
    expect(classifyFileCommand('sed s/a/b/ a.txt')).toEqual({
      kind: 'file-edit',
      verb: 'sed',
      paths: ['a.txt'],
    })
  })

  it('sed -i.bak continua sendo a mesma flag', () => {
    expect(classifyFileCommand("sed -i.bak 's/a/b/' a.txt")).toMatchObject({
      kind: 'file-edit',
      paths: ['a.txt'],
    })
  })

  it('aspas viram um argumento só, com espaço dentro', () => {
    expect(classifyFileCommand('touch "meu arquivo.txt"')).toEqual({
      kind: 'file-edit',
      verb: 'touch',
      paths: ['meu arquivo.txt'],
    })
  })
})

describe('classifyFileCommand — o que precisa cair no card', () => {
  const adversarial: readonly [string, string][] = [
    ['rm -rf build', 'rm está fora da v1: apagar não gera diff para revisar'],
    ['rmdir build', 'rmdir idem'],
    ["printf 'x' > a.txt", 'redirecionamento está fora da v1'],
    ['cat a.txt >> b.txt', 'redirecionamento, mesmo append'],
    ['cp a.ts $(cat alvo)', 'substituição de comando'],
    ['mkdir "$HOME/x"', 'variável'],
    ['mkdir ~/x', 'til de home'],
    ['cp *.ts dir/', 'glob'],
    ['touch a.txt &', 'background'],
    ['mkdir %USERPROFILE%\\x', 'env do cmd.exe'],
    ['mkdir `whoami`', 'crase'],
    ['mkdir {a,b}', 'brace expansion'],
    ['sed -e s/a/b/ -i a.txt', 'flag que consome valor desalinha a posição do script'],
    ['sed -f script.sed a.txt', 'idem'],
    ['cp -X a.ts b.ts', 'flag desconhecida pode consumir valor'],
    ['cp a.ts', 'cp precisa de origem e destino'],
    ['mkdir', 'sem argumento'],
    ['touch "aberta', 'aspas não fechadas'],
    ['FOO=1 touch a.txt', 'atribuição de env antes do verbo'],
    ['./deploy.sh', 'não é verbo simples'],
    ['git status', 'verbo fora da lista'],
    ['node -e "require(\'fs\')"', 'verbo fora da lista'],
    ['', 'linha vazia'],
  ]

  for (const [command, why] of adversarial) {
    it(`${command || '(vazio)'} → unknown (${why})`, () => {
      expect(classifyFileCommand(command).kind).toBe('unknown')
    })
  }

  it('nenhum verbo fora da lista v1 é reconhecido, nem os que "parecem" seguros', () => {
    for (const verb of ['ls', 'echo', 'cat', 'chmod', 'ln', 'install', 'truncate', 'dd']) {
      expect(classifyFileCommand(`${verb} a.txt b.txt`).kind).toBe('unknown')
    }
  })

  it('a lista v1 é exatamente esta, e mudar exige mexer no teste', () => {
    expect([...FILE_EDIT_VERBS].sort()).toEqual(['cp', 'mkdir', 'mv', 'sed', 'touch'])
  })

  it('linha absurdamente longa não é comando de arquivo', () => {
    expect(classifyFileCommand(`touch ${'a'.repeat(2000)}`).kind).toBe('unknown')
  })

  it('nunca lança, mesmo com entrada esquisita', () => {
    for (const weird of ['   ', '\t\t', '"', "'", '-', '--', 'constructor a b', '__proto__ a b']) {
      expect(() => classifyFileCommand(weird)).not.toThrow()
      expect(classifyFileCommand(weird).kind).toBe('unknown')
    }
  })
})

describe('cdTarget', () => {
  it('lê o destino de um cd simples, com e sem aspas', () => {
    expect(cdTarget('cd src')).toBe('src')
    expect(cdTarget('cd "C:/Users/Me/proj"')).toBe('C:/Users/Me/proj')
  })

  it('recusa o que não é exatamente cd <dir>', () => {
    for (const segment of ['cd', 'cd a b', 'cd $HOME', 'cd ~', 'pushd src', 'cd -- src', '']) {
      expect(cdTarget(segment)).toBeNull()
    }
  })
})

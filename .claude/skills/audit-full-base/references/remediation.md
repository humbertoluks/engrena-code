# Protocolo de remediação e template de regra

Lido pela skill `audit-full-base` ao gravar `docs/AUDIT-CODE-REVIEW.md`.
Texto canônico: copie para o artefato; não duplique o corpo inteiro de volta no `SKILL.md`.

---

## Seção obrigatória no artefato — remediação

Grave **no início** do artefato (após cabeçalho/contagem, antes do resumo executivo), em PT-BR. Ajuste só ponteiros de § se a numeração mudar.

### Como a IA deve usar este documento (remediação)

Este arquivo é a **fonte de verdade** dos achados de código. Não é PRD de produto nem lista de tarefas soltas.

#### Interpretação

1. Leia o **cabeçalho** (data, contagens) e o **resumo executivo** (veredito + top bloqueadores).
2. Trabalhe pela tabela de **Achados abertos**: cada linha é um item acionável (`ID`, `Stack`, `Local`, `Regra`).
3. Para cada `ID`, abra a **âncora da Regra** (não conforme → conforme → exceções). A regra é o contrato de correção; o `Local` é o ponto de partida no código, não o único arquivo permitido se a correção exigir módulo vizinho (teste irmão, validação compartilhada, etc.).
4. Escolha a skill Coding Expert pela coluna **Stack** (leia `SKILL.md` + a regra em `rules/`; bindings do repo em `project.md`):
   - `Electron` → `.claude/skills/coding-electron`
   - `React` → `.claude/skills/coding-react`
   - `Node.js` → `.claude/skills/coding-nodejs`
   - `SQLite` → `.claude/skills/coding-sqlite`
   - `TypeScript` → `.claude/skills/coding-typescript` (+ skill da Stack do arquivo tocado)
   - `Vitest` → `.claude/skills/coding-vitest`
5. **Releia o código antes de agir.** O artefato é um retrato da última passagem: outro agente pode já ter corrigido o item. Se o problema não se reproduz, não "corrija" — feche o item pelo protocolo abaixo.
6. Vários `ID`s que apontam para a **mesma Regra** fecham juntos quando o tipo for o mesmo (ex.: dois dead-exports). Não misture Stacks num único commit sem pedido do usuário.
7. Itens em **Fora de escopo / dívida consciente** não são lote de fix — só toque se o usuário pedir explicitamente.
8. Prefira a ordem do **Fatiamento sugerido** (🔴 antes de 🟡; segurança/segredo antes de hygiene).

#### Como fechar um apontamento corrigido

Só mova o item de **Abertos → Corrigidos** quando **tudo** abaixo for verdade:

1. **Código** — o problema descrito na regra não se reproduz mais nos paths citados nem nos consumidores óbvios (ex.: a UI que exibe `stderrTail`).
2. **Teste / evidência** — se a regra ou a Stack `Vitest` exigir: `*.test.ts` irmão verde, ou `docs/F<ID>-*/smoke-results.md` escrito com o que foi exercitado. Narrativa no `PROGRESS.md` **não** substitui smoke-results.
3. **Gates da área** — `pnpm test` nos testes tocados + regressão óbvia. Falha pré-existente ou flaky conhecido: registre como tal, não como fechamento.
4. **Commit** — Conventional Commit alinhado ao fatiamento (`fix(F24): …`, `test(…)`, `docs(F20): …`). Só commit se o usuário pediu.
5. **Atualize o artefato** na mesma mudança de docs (ou junto do commit de fix, se o usuário quiser):
   - Remova a linha do `ID` da tabela de **Achados abertos**.
   - Se nenhum outro aberto restar naquela **Regra**, remova a subseção correspondente.
   - Acrescente linha em **Problemas corrigidos** com novo `Cxx`, mesma `Stack`, `Tipo` estável, evidência e link `RC-…`.
   - **Evidência aceita:** hash de commit, ou `working tree (sem commit) + <teste que cobre>`. Nunca "verificado visualmente".
   - Se o tipo é novo, copie o template de regra (abaixo) para corrigidos com âncora `RC-…`.
   - Atualize **contagens** do cabeçalho e a nota do resumo; veredito coerente com os abertos restantes.
6. **Coding Expert** — mova o `ID` de “Achados abertos” para “Já corrigidos — não regrida” em `coding-*/project.md` da Stack (não edite `rules/` por causa de um fix).
7. **Não** feche por “parece ok” nem por linter verde. Não delete histórico de corrigidos antigos.

#### O que a auditoria full-base não faz

`audit-full-base` **não** corrige `src/`. Ela registra achados no artefato **e** sincroniza as Coding Experts. Correção de código é sessão/pedido separado. Reauditoria após lote grande confirma se os `Cxx` novos ainda batem no código.

---

## Template de regra (aberto ou corrigido)

Uma vez por **tipo** por Stack. Âncora aberta: `r-<tipo>`. Âncora corrigida: `rc-<tipo>`.

### [Titulo]
Esforço: [estimativa]
Classificação: [Crítico | Alto | Médio | Baixo]
Stack: [Electron | React | Node.js | SQLite | TypeScript | Vitest]
Tipo: `<slug-estavel>`

#### Por que isso é um problema?
[2–4 frases: o efeito no produto, não a teoria.]

Não conforme:

    // exemplo genérico do problema

Correção: [uma frase + ação concreta.]

Conforme:

    // exemplo genérico corrigido

#### Exceções
[Descrição, ou “Nenhuma.”]

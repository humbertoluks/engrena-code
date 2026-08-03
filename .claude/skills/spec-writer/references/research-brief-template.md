# Template: Research Brief (Phase A)

Artefato compartilhado do **Two-phase batch** do `spec-writer`. Gerado **uma vez** pelo agente Research (B.5a) antes dos writers. Writers são **somente leitura** neste arquivo.

**Caminho de saída:** `docs/_shared/codebase-patterns.md`

**Schema:** use exatamente as seções abaixo. Caps são obrigatórios.

---

## Header (obrigatório)

```markdown
# Codebase Patterns Brief

| Campo | Valor |
|-------|-------|
| wave | <N ou "IDs: F0x,F0y"> |
| generated_at | <ISO-8601> |
| git_sha | <HEAD curto ou "n/a"> |
| foundation_state | greenfield \| partial \| complete |
| features_in_batch | F0x, F0y, … |
| status | fresh |
```

**Freshness:** regenerar se `git_sha` ≠ HEAD atual, se o estado de Fundação mudou, ou se o usuário pediu refresh. Brief stale → orquestrador **não** despacha writers; reexecuta Research.

---

## 1. Camada 1 — Baseline (checklist fixo)

Uma linha (ou bullet curto) por categoria. Paths canônicos quando existirem. Sem colar arquivos inteiros.

| Categoria | Achado | Path exemplo |
|-----------|--------|--------------|
| Runtime e linguagem | | |
| Framework e layout do projeto | | |
| Banco de dados e acesso a dados | | |
| Autenticação | | |
| Estilo de API / ponto de entrada | | |
| Validação | | |
| Framework e estilo de testes | | |
| Tratamento de erros | | |
| Estrutura de pastas e nomenclatura | | |

Se o codebase estiver vazio/só scaffolding: marque cada linha como `bootstrap — industry default` e documente a escolha em **Conflitos resolvidos**.

---

## 2. Camada 2 — Padrões amplos (máx. 15 bullets)

Cada bullet: padrão + 1 path de exemplo. Não exceder 15.

```markdown
- [Padrão]: [1 frase]. Ex.: `path/to/example`
```

---

## 3. Conflitos resolvidos

Quando múltiplos padrões conflitam, o Research aplica a heurística do Auto-Aceitar (mais frequente; se empate, mais recente) e **fixa** aqui. Writers **não** reescolhem.

| Conflito | Escolha | Regra aplicada |
|----------|---------|----------------|
| | | mais frequente / mais recente / industry default |

---

## 4. Docs canônicos (preferir antes de explorar)

Lista de docs do repo que já codificam padrões. Writers e Research devem lê-los antes de reexplorar disco. No EngrenaCode, isto inclui `docs/DEVELOPMENT.md`, `docs/design-system/`, e — quando a feature em questão tem UI — `docs/<feature-id>-*/ui.md` e `docs/<feature-id>-*/copy.md` já existentes.

```markdown
- `docs/DEVELOPMENT.md` — …
- `docs/design-system/…` — …
```

---

## 5. Specs existentes

Uma linha por `docs/F*/spec.md` já presente (anti-redundância para writers). Marque também, por feature, se `ui.md`/`copy.md` existem — isso poupa os writers de perguntar sobre UI/copy já documentados.

| Feature | Path | Uma linha de decisão / escopo | ui.md / copy.md |
|---------|------|-------------------------------|------------------|
| F01 | `docs/F01-…/spec.md` | | sim / sim |

---

## 6. Onda — Consome/Provê (opcional, compacto)

Só o necessário para peers do lote. Extraído do PRD; sem reexplorar código.

| Feature | Consome | Provê |
|---------|---------|-------|
| F0x | | |

---

## Regras do Research (Phase A)

**FAÇA:**
1. Executar Passo 1.3 completo (Camada 1 + Camada 2) **uma vez** por lote/onda
2. Preferir docs canônicos e specs existentes antes de varredura ampla
3. Fixar conflitos de padrão neste brief
4. Respeitar caps (Camada 2 ≤ 15; sem dumps de arquivo)
5. Escrever apenas em `docs/_shared/codebase-patterns.md`
6. Registrar quais features do lote já têm `ui.md`/`copy.md` na seção 5

**NÃO FAÇA:**
1. Despachar writers se o brief falhar ou ficar incompleto
2. Colar conteúdo inteiro de arquivos-fonte
3. Incluir decisões específicas de uma feature (isso é do writer)
4. Deixar writers escreverem neste arquivo

---

## Contrato para Writers (Phase B)

Ao consumir este brief:

1. Tratar Camada 1/2 como autoridade de stack/convenções
2. Na spec: **citar** o path do brief; **não** recopiar o checklist Camada 1
3. Exploração = **delta** só no escopo da feature-alvo
4. **Proibido** reexecutar Camada 2 ampla “para confirmar”
5. Se brief ausente/stale: **não** improvisar Camada 2; falhar e devolver ao orquestrador
6. Se a seção 5 indica `ui.md`/`copy.md` existentes para a feature-alvo, ler os dois arquivos e tratá-los como fonte de verdade de UX/copy — nunca redefinir anatomia ou strings já documentadas

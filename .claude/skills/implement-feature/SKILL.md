---
name: implement-feature
description: Implementa uma feature de forma autônoma com base na spec e no plan, fazendo um Conventional Commit por fase e reportando resultados contra os critérios de aceitação da feature. Adaptada ao EngrenaCode — trata docs/<feature-id>-*/ui.md e copy.md como fonte de verdade para fases de UI e exige Conventional Commits.
---

# Implement Feature

Implementa de forma autônoma uma feature a partir dos `spec.md` + `plan.md` existentes. A skill lê a especificação técnica e o plano de implementação, escreve o código fase a fase, valida cada fase, faz commit e reporta os resultados contra os critérios de aceitação declarados no PRD.

**Idioma:** toda comunicação com o usuário (perguntas, status, relatório final, aborts) é em **português do Brasil**. Artefatos técnicos permanecem em inglês: mensagens de commit (Conventional Commits), nomes de arquivos/símbolos, logs de ferramentas e termos consagrados (`hard fail`, `soft fail`, etc. podem aparecer em inglês no relatório quando forem rótulos estáveis).

## Adaptação ao EngrenaCode

- `docs/PRD.md` já existe neste repositório (PT-BR, features F01–F11); use-o diretamente como fonte do PRD — sem auto-descoberta necessária.
- Pastas de feature (`docs/F<ID>-<kebab-name>/`) costumam incluir `ui.md` (anatomia, tokens, checklist de aceite visual) e `copy.md` (strings literais por id) junto com `spec.md`/`plan.md`. Esses arquivos são escritos por um processo de design separado (ver `CLAUDE.md` → "Design · Processo") e são a **fonte de verdade** para qualquer fase que toque UI — nunca invente copy ou layout que divirja deles.
- Mensagens de commit neste repositório seguem **Conventional Commits** em inglês (ver 5.4 abaixo e o `git log` recente: `feat(F02): ...`, `fix(login): ...`, `docs: ...`), independentemente dos docs em PT-BR. Não escreva subjects de commit em português.
- `docs/PROGRESS.md` é a fonte autoritativa do status real de implementação F01–F11 neste repositório — consulte-o, não as actions `_reversa_forward`, ao julgar se uma dependência está de fato pronta.

## ENTRADA

Formato livre. A skill descobre o que foi passado. Qualquer combinação funciona:

- Um identificador de feature: `F09`, `Video Upload`, ou similar.
- Uma pasta de feature: `docs/F09-in-video-transcription-search/`, `./F09/`, etc.
- Um arquivo dentro da pasta da feature: `docs/F09-in-video-transcription-search/spec.md`.
- Um caminho de PRD: `@docs/PRD.md`, `docs/PRD.md`, `@PRD.md`.
- Instruções extras em linguagem natural em qualquer lugar (ver **Overrides**).

A skill só precisa localizar dois arquivos e uma fonte de referência:

1. **`spec.md` e `plan.md`** da feature-alvo. Se a entrada aponta para uma pasta, olhe dentro. Se aponta para um arquivo, olhe na pasta pai. Se aponta para um ID ou nome, busque em `docs/` por uma pasta que bata com `<ID>-*` ou cujo nome em kebab-case corresponda ao nome dado.
2. **O PRD**. Se passado explicitamente, use-o. Caso contrário, auto-descubra: `docs/PRD.md` → `PRD.md` → qualquer `*.md` de topo cujo conteúdo pareça uma especificação de produto. Se nenhum for encontrado, aborte. Se vários forem plausíveis, aborte e liste-os. Neste repositório espera-se que `docs/PRD.md` já exista.

## SAÍDA

- **Commits**: um Conventional Commit por fase do `plan.md`, no branch atual (sem criar branch, sem trocar de branch).
- **`docs/PROGRESS.md` + checkboxes do PRD**: atualizados no Passo 6.6, só quando a execução fecha com status `success` e o arquivo existe no repositório-alvo.
- **Relatório no chat** ao final: checklist de critérios de aceitação da feature marcada ✓ / ✗ / — contra os resultados reais dos testes, mais seções para Desvios, Soft-fails, Falhas pré-existentes, Overrides aplicados, Overrides ignorados e Status das fases.

Nenhum outro arquivo é escrito além das mudanças de código, `docs/PROGRESS.md`/PRD no fechamento (Passo 6.6) e dos objetos de commit. O relatório no chat é efêmero.

---

## PASSOS DE EXECUÇÃO

### Passo 1: Resolver Entrada

Parseie a entrada inteira como formato livre. Extraia:

- **Referência da feature**: o primeiro token que resolve para uma pasta contendo `spec.md` + `plan.md`. Matches: padrões de ID como `F\d+`, caminhos de pasta, caminhos de arquivo (pasta pai = alvo), nomes de feature (kebab-case + fuzzy match com nomes de pasta em `docs/`).
- **Referência do PRD**: um caminho `*.md` explícito prefixado com `@` ou escrito literalmente; se parecer um PRD (conteúdo de especificação de produto no topo), aceite. Caso contrário auto-descubra (`docs/PRD.md` neste repositório).
- **Instruções extras**: qualquer texto restante que não seja caminho/ID/nome — trate como overrides em linguagem natural (Passo 3).

Se a resolução falhar:

- Sem `spec.md` ou `plan.md` na pasta resolvida → aborte: "spec.md/plan.md ausentes em `<pasta>`."
- Sem PRD encontrado → aborte: "Nenhum PRD encontrado. Passe o caminho explicitamente."
- Múltiplos PRDs plausíveis → aborte e liste candidatos.
- Referência de feature ambígua (múltiplas pastas batem) → aborte e liste candidatos.

### Passo 2: Carregar Contexto

Leia por completo:

- `spec.md` da feature-alvo — Component Overview, Data Model, API Contracts, Business Rules, UX Flows, Error Handling, Testing Strategy, Assumptions/Decisions.
- `plan.md` — fases e passos em ordem.
- **`ui.md` e `copy.md` da feature-alvo, se existirem** (`docs/<feature-id>-*/ui.md`, `docs/<feature-id>-*/copy.md`). Quando presentes, são a fonte de verdade para qualquer fase que toque UI: `ui.md` traz anatomia, ordem de layout, tokens/classes, estados e o checklist de aceite visual; `copy.md` traz as strings literais por id. Leia ambos antes de implementar qualquer fase que renderize UI. Se não existirem para uma feature que claramente tem UI (conforme UX Flows do spec.md), prossiga mas registre em Soft-fails — implementar UI sem `ui.md`/`copy.md` arrisca a lacuna de fidelidade visual que este projeto guarda explicitamente (ver `CLAUDE.md` → "Design · Processo").
- **O conteúdo de critérios de aceitação do PRD para esta feature** — localize semanticamente, não por número de seção. Cabeçalhos típicos: "Acceptance Criteria", "Critérios de Aceitação", "AC". Forma típica: lista de checkbox `- [ ]` escopada à feature (por ID ou nome). Localize também qualquer checklist cross-feature/integração que referencie esta feature. NÃO assuma número fixo de seção — encontre o conteúdo pela forma.

Se o PRD não tiver conteúdo de critérios de aceitação para esta feature, prossiga com checklist AC vazia e anote em soft-fails.

NÃO explore o codebase com ânsia. Abra arquivos sob demanda conforme cada fase exigir.

### Passo 3: Aplicar Overrides

Interprete instruções extras como overrides em linguagem natural sobre os defaults:

| Default | Exemplos de override |
|---|---|
| Limite de retry de hard-fail = 3 | "sem limite de retry", "máximo 5 tentativas" |
| Totalmente autônomo | "pause entre fases" — a skill espera no chat uma resposta contendo `ok`, `continue`, `segue`, `yes` ou similar |
| 1 commit por fase | "um único commit no final", "sem commits, só implemente" |
| Rodar lint + typecheck + testes | "pule testes", "pule lint", "pule typecheck" |
| Implementar todas as fases | "só fases 1 e 2", "pule a fase 3" — posições de fase são ordinais; rótulos como `A/B/C` mapeiam para `1/2/3` |
| Abortar testes se dep externa faltar | "stub serviços faltantes", "assumir resposta vazia para APIs faltantes" — substitui stubs **SOMENTE em código de teste**, nunca em módulos de produção |

Para cada override reconhecido, registre before/after para a seção "Overrides aplicados" do relatório final.

**Núcleo imutável (não pode ser sobrescrito):** o checklist final de AC e sua rastreabilidade ao PRD. Instruções que desabilitariam o relatório são logadas em "Overrides ignorados" com o motivo.

Instruções ambíguas ou contraditórias → o default vence; logado em "Overrides ignorados" com "ambíguo, manteve default".

### Passo 4: Pré-voo de Dependências

Localize o conteúdo de dependências no PRD semanticamente (cabeçalhos típicos: "Dependency Graph", "Dependencies", "Grafo de Dependências"; forma típica: tabela ou lista pareando cada feature com seus pré-requisitos). Para cada dependência listada da feature-alvo, verifique se ela aparece implementada no codebase (procure pelos arquivos característicos descritos no Component Overview do `spec.md` dessa dependência, ou marcadores óbvios em nível de fonte; cruze com `docs/PROGRESS.md` quando presente).

- Qualquer dependência faltando → **aborte antes de qualquer implementação**. Reporte: "F<alvo> depende de F<N>, que ainda não está implementada."
- Todas as dependências presentes → prossiga para o Passo 5.

Se o PRD não tiver conteúdo de dependências, pule este passo.

### Passo 5: Executar Fases

Para cada fase do `plan.md`, em ordem:

**5.1 — Pular se já estiver feita**

Inspecione os últimos ~20 commits do branch atual. Se alguma mensagem de commit indicar que esta fase exata já rodou (mesmo ID de feature + nome ou ordinal da fase), pule a fase com status `— already committed` e siga. A detecção é best-effort: match no ID da feature mais nome normalizado da fase ou índice da fase.

**5.2 — Implementar**

Leia as seções do spec.md relevantes à fase. Edite/crie arquivos para cumprir os passos da fase.

**O que conta como "feito" para uma fase** — tudo abaixo, não só "eu escrevi o código":

- Todo arquivo listado para esta fase no Component Overview do spec.md existe e contém o conteúdo descrito.
- Todo contrato (API, schema, assinatura de função) descrito para esta fase bate com o que foi escrito.
- **Se a fase toca UI:** a implementação segue a ordem de anatomia, tokens/classes e estados do `ui.md`, e usa as strings literais do `copy.md` por id — sem copy inventada, sem anatomia reordenada, sem tokens ad-hoc quando o `ui.md` documenta um.
- A validação em 5.3 passa (hard fails resolvidos).
- Se a fase produz comportamento em runtime não coberto por testes unitários (páginas UI, rotas de servidor, migrations, comandos CLI), exercite de fato antes de declarar feito: rode o dev server / build / migration / comando contra um ambiente local e confirme o comportamento. Se o ambiente não puder ser levantado nesta execução, registre o runtime-check em `Soft-fails` — NÃO declare silenciosamente que a fase está feita.

Escrever código sem rodá-lo não é "feito". Declarar conclusão sem cumprir o checklist acima viola o contrato da skill.

Adapte quando a realidade divergir da spec (coluna `pinned` no DB vs `isPinned` na spec, nome de arquivo de componente diferente, caminho ligeiramente diferente, tipos estruturalmente compatíveis). Specs nunca são 100% fiéis à realidade — adaptação é esperada. Registre cada adaptação numa lista `Deviations` para o relatório final. NÃO aborte por divergências menores.

**Aborte a execução inteira apenas em:**

- Feature de dependência faltando (em geral pego no Passo 4; se descoberta no meio da fase, aborte aqui).
- Hard fail além do limite de retry no Passo 5.3 abaixo.

Dependências externas faltantes necessárias apenas por *testes* (ex.: `OPENAI_API_KEY` indisponível) NÃO abortam a execução — soft-failam o teste afetado. O código de implementação que chama o serviço ainda é escrito.

**5.3 — Validar**

Descubra comandos de validação em runtime: inspecione `scripts` do `package.json`, ou para stacks não-Node inspecione o equivalente (`Makefile`, `pyproject.toml`, `Cargo.toml`, `vitest.config.*`, `jest.config.*`). Rode os disponíveis. Neste repositório isso significa `pnpm test` para código de produção coberto por Vitest, mais lint/typecheck via `pnpm build`.

- **Hard fail** = exit não-zero de lint, typecheck ou testes unitários, onde a falha é atribuível a código que esta execução mudou. Retry até o limite configurado (default 3). Cada retry lê o erro, ajusta o código, re-roda. Após o limite, aborte a execução inteira e vá ao Passo 6.
- **Soft fail** = validação não pode executar neste ambiente (e2e exigindo browser/server ausente; teste de integração exigindo credencial externa não setada; suite marcada explicitamente como não-executável; comando não encontrado). Pule, registre em `Soft-fails`, prossiga.
- **Falha pré-existente** = validação falha mas a falha não é atribuível a código que esta execução mudou (tocou arquivos não relacionados, já existia no branch antes desta execução). Registre em `Pre-existing failures`, NÃO conte contra o orçamento de retry, prossiga.

Warnings sem exit não-zero nunca são falhas.

**5.4 — Commit**

Se a validação passou (todos os hard fails resolvidos; só soft fails e falhas pré-existentes restam), faça stage apenas dos arquivos que esta fase tocou e commit seguindo **Conventional Commits** (`<type>(<scope>): <description>`), alinhado ao que este repositório já faz (`feat(F02): implement Configuração MVP with vault-backed settings`, `fix(login): restore #login layout fidelity`, `docs: expand CLAUDE harness and F03/F06 specs`):

- **Type** — infira do que a fase realmente fez; nunca default para `feat` sem checar o conteúdo real da fase:
  - `feat` — nova capacidade voltada ao usuário ou ao sistema
  - `fix` — correção de bug
  - `refactor` — reestruturação sem mudança de comportamento
  - `docs` — mudanças só de documentação
  - `test` — mudanças só de teste
  - `chore` — mudanças de build/config/dependência
  - `style` — formatação sem mudança de lógica
  - `perf` — melhoria de performance
- **Scope** — siga a convenção existente do projeto (inspecione os últimos ~10 commits primeiro): o ID da feature exatamente como aparece no nome da pasta de docs (`F06`, sem lowercasing) para fases escopadas a essa feature, ou um nome curto de componente em minúsculas (`login`, `vault`) para fixes transversais não ligados a um único ID de feature. Omita o scope só quando a mudança for genuinamente de todo o repositório (bate com commits existentes `docs: ...` sem scope).
- **Description** — modo imperativo, presente, minúsculas, sem ponto final. Em inglês.
- **Body** (opcional) — só o "porquê" quando não for óbvio a partir do diff. Em inglês.

Alinhe o estilo de commit do projeto inspecionando as últimas ~10 mensagens; se o histórico for ambíguo ou este for o primeiro commit do repositório, aplique Conventional Commits puro pelas regras acima — nunca caia num commit genérico e sem inferência `feat(F<ID>): <phase name>` que pula a inferência de tipo. O tipo deve refletir o que a fase realmente fez, mesmo no caminho de fallback.

Faça stage de arquivos específicos apenas (sem `git add -A` / `git add .`). Commit no branch atual. Não pule hooks.

Se um override desabilitou commits, pule este subpasso e mantenha as mudanças na working tree.

**5.5 — Prosseguir**

Vá para a próxima fase. Um abort em nível de execução (hard fail além do limite de retry, dependência faltando no meio da fase) para a execução e vai ao Passo 6 com as fases já commitadas.

### Passo 6: Verificação Final

Após o commit da última fase (ou quando a execução abortou), rode uma passagem independente de verificação sobre a feature inteira antes de escrever o relatório. Este passo existe porque checagens por fase podem perder regressões, e porque a IA costuma declarar "feito" quando não está.

Execute tudo abaixo — nenhum passo é opcional:

**6.1 — Validação da suite completa**

Rode a suite completa de validação no repositório inteiro (não só arquivos tocados): lint, typecheck e a suite completa de testes conforme definida pelo projeto (`pnpm test`, `pnpm build`). NÃO filtre aos arquivos que esta execução mudou.

- Se aparecerem falhas que não foram sinalizadas por fase → contam como **regressões**. Tente corrigir até o limite de retry (mesma política de hard-fail). Se ainda falhar, NÃO declare sucesso — o status vira `completed with regressions` e as falhas são listadas em `Regressions` no relatório.
- Falhas pré-existentes já logadas no Passo 5.3 permanecem categorizadas como pré-existentes; não viram regressões.

**6.2 — Walk-through do Component Overview**

Leia o Component Overview do spec.md (ou seção equivalente de lista de arquivos) e, para cada arquivo listado, verifique: o arquivo existe, seu papel descrito é visível no conteúdo, e seus contratos (exports, rotas, schemas) batem com a spec dentro das regras de adaptação do Passo 5.2. Para arquivos de UI, verifique também que batem com anatomia/tokens do `ui.md` e strings literais do `copy.md` quando esses arquivos existem.

Qualquer arquivo faltando, export faltando, contrato faltando ou divergência de UI vs `ui.md`/`copy.md` → adicione a `Missing from spec` no relatório. NÃO declare sucesso se esta lista estiver não-vazia.

**6.3 — Re-checagem de AC**

Para cada critério de aceitação carregado no Passo 2, localize o(s) teste(s) mapeado(s) a ele via Testing Strategy do spec.md (ou equivalente). Rode esses testes frescos agora (não só confiando que passaram numa fase anterior). Marque o AC ✓ só se o teste passar nesta re-checagem final. Se o teste não passar mais → marque ✗, adicione a `Regressions`, e não declare sucesso.

ACs sem testes mapeados permanecem `—` (sem teste).

**6.4 — Smoke check de ambiente (quando aplicável)**

Se a feature produz superfícies de runtime que a validação por fase não pôde exercitar (página UI, endpoint HTTP, migration, comando CLI), faça um exercício final de cada uma contra um ambiente local (dev server, DB efêmero, etc.) — conforme `CLAUDE.md`, isso significa Vite dev server + Electron com o unlock loopback em `127.0.0.1:5174` quando a tela exigir sessão. Um load-and-interact rápido basta — o objetivo é pegar o que testes unitários não pegam. Para features de UI, esta passagem também confirma theming light/dark e copy contra `ui.md`/`copy.md` quando existirem.

Se o ambiente não puder ser levantado nesta execução, registre cada smoke check pulado em `Soft-fails` — NÃO eleve o status para `success` a menos que todo smoke check tenha passado ou sido honestamente soft-failed.

**6.5 — Decisão de status**

O status final da execução é determinado por este passo, não por se as fases commitaram:

- `success` — suite completa verde, todo item do Component Overview presente (incluindo fidelidade de UI vs `ui.md`/`copy.md` quando aplicável), todo teste de AC passa em 6.3, todo smoke check passou ou soft-failed.
- `completed with regressions` — fases commitadas mas 6.1 ou 6.3 descobriram falhas que a skill não conseguiu resolver.
- `incomplete` — `Missing from spec` (6.2) está não-vazia.
- `aborted at phase <N>` — execução parou durante o Passo 5 antes de chegar aqui.

Nunca reporte `success` quando qualquer das checagens acima tiver falha não resolvida, mesmo que cada fase tenha commitado limpo individualmente.

**6.6 — Fechar docs de progresso (só se status = `success`)**

`docs/PROGRESS.md`, quando existir, é a fonte autoritativa de status real do repositório (ver `CLAUDE.md` → "Adaptação ao EngrenaCode") e sua própria nota de topo instrui: "Atualizar ao fechar cada feature" + "Ao fechar uma feature: marcar `[x]` lá [no PRD] **e** atualizar a tabela acima na mesma mudança." Os Passos 1–6 desta skill *leem* `PROGRESS.md` (Passo 4) mas nunca o escrevem — sem este passo o arquivo fica sistematicamente desatualizado mesmo em execuções `success`.

Quando o Passo 6.5 resultar em `success`:

- Atualize a linha da feita-feature na tabela "Resumo por feature" de `docs/PROGRESS.md` (status, evidência, próximo passo) e a linha de Onda correspondente, se existir.
- No PRD, marque `[x]` nos itens de "Critérios de Aceitação" desta feature que passaram na re-checagem do Passo 6.3 (não marque os que ficaram `—` sem teste, nem os cobertos só por soft-fail/smoke pulado).
- Faça stage só de `docs/PROGRESS.md` + `docs/PRD.md` e inclua num commit `docs(F<ID>): ...` separado dos commits de fase (ou junto do commit da última fase, se nenhum override desabilitou commits) — nunca misture com commits de código de outra fase.
- Se `docs/PROGRESS.md` não existir neste repositório, pule silenciosamente (não é universal a todo projeto-alvo desta skill).

Quando o status for `completed with regressions`, `incomplete` ou `aborted at phase <N>`, NÃO toque em `PROGRESS.md`/PRD — deixe-os refletindo o último estado fechado real.

### Passo 7: Relatório Final

Saída do relatório no chat, em **português do Brasil** (rótulos de status e seções técnicas podem permanecer em inglês para estabilidade). O status vem do Passo 6.5, nunca de "acho que terminei":

```
Feature F<ID> — <nome>

Status: success | completed with regressions | incomplete | aborted at phase <N>
Phases: <N> committed / <M> total
Branch: <current-branch>

Acceptance Criteria (re-checked in Step 6.3):
✓ <texto do AC> (coberto por <nome do teste>)
✗ <texto do AC> (teste falhou após <K> retries: <resumo do erro>)
— <texto do AC> (nenhum teste cobre este AC)

Cross-feature integration (se houver):
✓ <critério> (coberto por <nome do teste>)
...

Missing from spec (from Step 6.2):
- <arquivo/export/contrato que a spec exigia e está faltando>
...

Regressions (from Step 6.1 or 6.3):
- <nome do teste> começou a falhar durante esta execução: <erro>
...

Deviations:
- <o que foi adaptado e por quê>
...

Soft-fails:
- <o que foi pulado e por quê, incluindo runtime smoke checks não exercitados>
...

Pre-existing failures:
- <nome do teste>: falhou na entrada desta execução; deixado como está
...

Overrides applied:
- Retry limit: 3 → unlimited
...

Overrides ignored:
- "<texto>" (motivo)
...

Abort reason (se status for aborted): <erro>
```

Se abortado, o relatório ainda lista o que as fases commitadas alcançaram e marca claramente qual fase falhou e por quê. Se `completed with regressions` ou `incomplete`, o relatório deixa claro quais checagens falharam para o usuário saber o que corrigir.

---

## REGRAS

**Sempre:**
- Exigir `spec.md` + `plan.md` na pasta-alvo; abortar sem eles.
- Localizar conteúdo de AC e dependências no PRD semanticamente, nunca por número fixo de seção.
- Ler `ui.md`/`copy.md` da feature quando existirem, antes de implementar qualquer fase que toque UI.
- Commitar 1 por fase (default), fazendo stage só dos arquivos que a fase tocou, no formato Conventional Commits com tipo inferido do conteúdo real da fase.
- Alinhar o estilo recente de mensagens de commit do projeto dentro da tipagem Conventional Commits (nunca default cego para `feat`).
- Adaptar a divergências menores spec/código; registrar cada adaptação em `Deviations`.
- Rodar validação após cada fase; diferenciar hard-fail (retry ≤ limite) de soft-fail (pular + log) de falha pré-existente (log, sem retry).
- Antes de declarar uma fase "feita": confirmar que todo arquivo listado para aquela fase existe com o conteúdo descrito E que a validação passou. Escrever código sem rodá-lo nunca é "feito".
- Para fases que produzem superfícies de runtime (UI, rota HTTP, migration, CLI), exercitá-las de fato contra um ambiente local antes de declarar feito, ou soft-failar o runtime check.
- Para fases que tocam UI, verificar anatomia/tokens contra `ui.md` e strings literais contra `copy.md` antes de declarar feito.
- Executar o Passo 6 (Verificação Final) por completo antes de reportar — re-run da suite completa, walk-through do Component Overview, re-checagem de AC, smoke check de ambiente.
- Derivar o status final exclusivamente do Passo 6.5. Reportar `success` só quando toda checagem do Passo 6 estiver verde.
- Quando o status final for `success` e `docs/PROGRESS.md` existir no repositório-alvo, executar o Passo 6.6 (atualizar a tabela de progresso + `[x]` no PRD) antes do relatório — nunca deixar o fechamento só no chat.
- Comunicar com o usuário em português do Brasil.

**Nunca:**
- Declarar a execução como `success` quando o Passo 6 encontrou regressões, itens missing-from-spec ou falhas não resolvidas — mesmo que cada fase tenha commitado limpo individualmente.
- Pular o relatório de AC ou sua rastreabilidade (núcleo imutável).
- Pular o Passo 6 (Verificação Final).
- Criar ou trocar de branches.
- Abortar por divergências cosméticas de nome/caminho/tipo.
- Abortar por dependência externa faltando para um teste — soft-failar o teste, continuar implementando.
- Usar `git add -A` ou `git add .`.
- Pular git hooks.
- Contar falhas pré-existentes de teste contra o orçamento de retry.
- Re-rodar fases já commitadas no branch (detectadas por match de mensagem de commit).
- Inserir stubs de serviço em módulos de produção — stubs só são permitidos em arquivos de teste.
- Explorar o codebase de antemão com varredura ampla — ler arquivos sob demanda conforme as fases exigirem.
- Declarar uma fase completa só com base em "eu escrevi os arquivos". O checklist de conclusão em 5.2 deve valer.
- Inventar copy ou layout para uma fase de UI quando `ui.md`/`copy.md` existem e dizem o contrário.
- Commitar com mensagem genérica e sem inferência `feat(F<ID>): <phase name>` — sempre inferir o tipo real de Conventional Commits primeiro.
- Responder ao usuário em inglês (exceto trechos técnicos inevitáveis: nomes de arquivo, comandos, mensagens de commit, logs brutos).

---

## Overrides

Instruções em formato livre no final da invocação sobrescrevem defaults. Exemplos:

- **Limite de retry**: `no retry limit`, `max 5 tries`, `sem limite de retry`, `máximo 5 tentativas`.
- **Autonomia**: `pause between phases` / `pause entre fases` — espera resposta do usuário (`ok`, `continue`, `segue`, `yes`, etc.) após cada fase.
- **Estratégia de commit**: `no commits, just implement` / `sem commits, só implemente`; `single commit at the end` / `um único commit no final`.
- **Validação**: `skip tests` / `pule testes`, `skip lint` / `pule lint`, `skip typecheck` / `pule typecheck`.
- **Seleção de fases**: `only phases 1 and 2` / `só fases 1 e 2`, `skip phase 3` / `pule a fase 3` — posições de fase são ordinais; rótulos `A/B/C` mapeiam para `1/2/3`.
- **Serviços externos**: `stub OpenAI`, `assume empty response for missing APIs` / `assumir resposta vazia para APIs faltantes` — stubs aplicam-se SOMENTE em código de teste; módulos de produção mantêm a chamada real.

Overrides não reconhecidos ou contraditórios: o default vence; logados em `Overrides ignored`.

**Núcleo imutável**: o checklist de AC e sua rastreabilidade ao PRD não podem ser sobrescritos.

---

## Casos de Borda

**Nenhum PRD encontrado**: aborte antes de começar.

**Sem spec.md ou plan.md**: aborte antes de começar.

**Feature de dependência não implementada**: aborte no Passo 4 com mensagem clara.

**Referência de feature ambígua**: liste candidatos, aborte pedindo qual.

**Working tree tem mudanças não relacionadas no início**: prossiga mesmo assim — a skill é desenhada para ser invocável em qualquer lugar (tipicamente a partir de um worktree). Commits fazem stage só dos arquivos específicos que cada fase tocou.

**Nome da fase contém caracteres especiais**: sanitize o subject (remova caracteres inseguros para uma linha de commit git) mas ainda rode inferência completa de tipo Conventional Commits no conteúdo real da fase — não default para `feat`. Só use `feat(F<ID>): implement phase <N>` se a fase genuinamente adiciona uma nova capacidade; caso contrário use o tipo que realmente cabe (`fix`, `refactor`, `docs`, etc.).

**Re-invocação após execução parcial**: o Passo 5.1 detecta fases já commitadas por match de mensagem de commit e as pula. Mudanças não commitadas na working tree de uma execução anterior interrompida ficam como estão; a skill não as limpa.

**Hard fail além do limite de retry num passo que não faz parte de nenhum AC**: aborte mesmo assim — a skill não pode julgar quais falhas são "aceitáveis". O usuário pode sobrescrever com `skip tests` ou similar.

**Ferramenta externa emite warnings, não errors**: warnings não são falhas. Só exit codes não-zero contam.

**Override contradiz o contrato central** (ex.: `simplify the spec, drop requirements`): ignore, registre em `Overrides ignored`, prossiga com a spec completa.

**Comandos de validação não descobertos**: se `package.json` / arquivos de config não revelarem comandos de lint/typecheck/test, registre cada comando faltante em `Soft-fails` e prossiga.

**PRD sem conteúdo de AC para esta feature**: prossiga com checklist AC vazia e anote em soft-fails.

**PRD sem conteúdo de dependências**: pule o Passo 4 e prossiga.

**Estilo de mensagem de commit inconsistente no histórico recente**: aplique Conventional Commits puro — infira o tipo do conteúdo real da fase e escolha o scope pelas regras em 5.4 — em vez de defaultar para um genérico `feat(F<ID>): <phase name>`.

**Feature tem UI mas `ui.md`/`copy.md` ainda não existem**: prossiga com implementação só a partir do `spec.md`, mas registre em `Soft-fails` que a fidelidade visual não pôde ser verificada contra um doc de design, e sinalize claramente no relatório final para o usuário saber que ainda falta um passe de design-review.

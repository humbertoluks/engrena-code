# Auditoria de código — EngrenaCode

Artefato vivo das revisões full-base (`audit-full-base` → `review-architecture` → `review-robustness` → `review-delivery`).  
**Não** substitui [`docs/AUDIT-PRD-S9-MIGRATION.md`](AUDIT-PRD-S9-MIGRATION.md) (matriz de produto §9).

| Campo | Valor |
|-------|--------|
| **Passagem atual** | 2026-08-12 (auditoria) + **2026-08-13 (remediação)** — branch `fix/f03-audit-close` |
| **Escopo** | working tree não commitado sob `apps/engrena-code/src/` (+ docs F03/PROGRESS tocados); **não** full-base `src/` |
| **Método** | Auditoria: skill `.claude/skills/audit-full-base` + 3 subagentes sequenciais (leitura). Remediação 2026-08-13: 3 agentes de fix sobre o mesmo lote |
| **Correção de código nesta passagem** | 2026-08-12: nenhuma. 2026-08-13: **17 achados fechados** em `src/` (R01–R06, A01, A03, A04, A05 parcial, D01–D07) — ver C58–C69 |
| **Gates 2026-08-13** | `pnpm --filter engrena-code exec tsc -b` exit 0; `pnpm --filter engrena-code test` **1500 testes / 151 arquivos** verdes (baseline antes das correções: 1443 / 148) |
| **Histórico** | 2026-08-07 — Lotes 1–2; 2026-08-08 — C18–C30; 2026-08-09 — C31–C45; 2026-08-10 — C46–C57 (base zerada); 2026-08-12 — reauditoria **uncommitted**; 2026-08-13 — remediação C58–C69 (este documento) |


### Taxonomia de Stack (esta passagem)

| Stack | Uso |
|-------|-----|
| `Electron` | main, preload, IPC, PTY |
| `React` | renderer |
| `Node.js` | services HTTP, vault, runner, git, mcps, codegraph, vcs |
| `SQLite` | `src/services/db/` |
| `TypeScript` | tipagem pura (raro; prefira Stack do arquivo) |
| `Vitest` | testes, smoke, gates de entrega |

### Contagem (após remediação 2026-08-13)

| | 🔴 | 🟡 | Tipos de regra (abertos) |
|--|----|----|-----------------|
| Achados abertos | 0 | 0 | 0 |
| Problemas corrigidos (tipos / linhas C) | — | — | 69 (C01–C57 intactos + C58–C69 novos) |

Abertura da contagem de 2026-08-12 (7 🔴 / 12 🟡) para hoje: 17 fechados (C58–C69), 2 **deferidos por decisão** (A02 e a parte `hasInflight` do A05), 1 continua aberto e foi estreitado pelo smoke ao vivo de 2026-08-13 (D08) e 2 achados **novos** registrados (R07 na remediação, R08 no smoke).

**Atualização de 2026-08-17.** O **R09 fechou** e com ele a passagem inteira: **zero achados abertos**. A correção trocou o booleano do broker por uma decisão nomeada e fez log e faixa âmbar lerem a mesma partição de casos, que é o que o R08 já tinha ensinado a não duplicar. Gates: `tsc -b` exit 0, **1855/1855** testes em 161 arquivos (verde em duas rodadas), `vite build` ok.

**Atualização de 2026-08-16.** O smoke ao vivo previsto rodou e **fechou A09 e D08 de uma vez**: as quatro formas de Bash passaram pelo `PreToolUse` contra `claude` 2.1.233, e o Parar em turno bloqueado por servidor em foreground cancelou a tool, matou o processo e assentou a thread. Resta **um** 🟡 aberto, **novo, achado nesse mesmo smoke**: **R09** — negar pelo card faz o log e a faixa âmbar dizerem que o CLI negou "sem consultar o broker".

Fecharam neste dia: **A05** (`5f6b1c7`, o `resyncThread` consome `hasInflight` via `shouldRefetchHistoryOnResync`), **R08** (`da022fa`, com validação ao vivo), **A02 na parte dos validadores** (`2a6d112`, o gate antes do spawn) e **R07**, que na verdade já estava morto desde `ed17966` e só não tinha sido registrado — `turnProcessCount` foi substituído pelo par `recordProviderProcessSpawned`/`recordProviderProcessExited`.

A fatia **D3** entrou no mesmo dia e **não fecha achado**: dá visibilidade à faixa de versão do Claude CLI em que o contrato de permissão foi conferido (2.1.226 a 2.1.231, com evidência por versão em `PERMISSION_CONTRACT_VALIDATED_VERSIONS`). Versão fora da faixa, ou `--version` ilegível, vira aviso na faixa âmbar e uma linha de log, no máximo uma vez por processo — nunca bloqueio. O gate fail-closed continua sendo só o `assertPermissionContract` do D1: bloquear o turno por versão nova custaria mais que avisar, já que o contrato provavelmente segue valendo. Um teste de coerência impede a lista de versões e os limites `MIN`/`MAX` de se desencontrarem.

O smoke da Fase C rendeu um achado 🔴 novo, também já fechado (`63a60ea`): thread presa em "Agente trabalhando" quando o `state.change` de assentamento se perdia numa queda de socket. Rendeu ainda dois 🟡 fechados no mesmo dia (a copy da negação nativa e o erro de decisão em dobro, `628442d`) e uma suspeita **retificada**: os "dois WebSockets por thread" não existem, eram artefato da instrumentação do próprio smoke (`8eb9b51`). Detalhes em `docs/F03-workspace/smoke-results.md`.

---

## Como a IA deve usar este documento (remediação)

Este arquivo é a **fonte de verdade** dos achados de código. Não é PRD de produto nem lista de tarefas soltas.

### Interpretação

1. Leia o **cabeçalho** (data, contagens) e o **resumo executivo** (§1: veredito + top bloqueadores).
2. Trabalhe pela tabela de **Achados abertos** (§2): cada linha é um item acionável (`ID`, `Stack`, `Local`, `Regra`).
3. Para cada `ID`, abra a **âncora da Regra** em §3 (não conforme → conforme → exceções). A regra é o contrato de correção; o `Local` é o ponto de partida no código, não o único arquivo permitido se a correção exigir módulo vizinho (teste irmão, shared validate, etc.).
4. Escolha a skill Coding Expert pela coluna **Stack** (leia `SKILL.md` + a regra em `rules/`; bindings do repo em `project.md`):
   - `Electron` → `.claude/skills/coding-electron`
   - `React` → `.claude/skills/coding-react`
   - `Node.js` → `.claude/skills/coding-nodejs`
   - `SQLite` → `.claude/skills/coding-sqlite`
   - `TypeScript` → `.claude/skills/coding-typescript` (+ skill da Stack do arquivo tocado)
   - `Vitest` → `.claude/skills/coding-vitest`
5. Vários `ID`s que apontam para a **mesma Regra** fecham juntos quando o tipo for o mesmo (ex.: A02+A03 dead-export). Não misture Stacks num único commit sem pedido do usuário.
6. Itens em **Fora de escopo / dívida consciente** (§5) não são lote de fix — só toque se o usuário pedir explicitamente.
7. Prefira a ordem do **Fatiamento sugerido** no fim da §5 (🔴 antes de 🟡; segurança/segredo antes de hygiene).

### Como fechar um apontamento corrigido

Só mova o item de **Abertos → Corrigidos** quando **tudo** abaixo for verdade:

1. **Código** — o problema descrito na regra não se reproduz mais nos paths citados (e nos consumidores óbvios, ex.: UI que mostra `stderrTail`).
2. **Teste / evidência** — se a regra ou a Stack `Vitest` exigir: `*.test.ts` irmão verde, ou `docs/F<ID>-*/smoke-results.md` escrito com o que foi exercitado. Narrativa no `PROGRESS.md` **não** substitui smoke-results.
3. **Gates da área** — `pnpm test` na suíte (ou pelo menos nos testes tocados + regressão óbvia). Não declare fechado com teste falhando.
4. **Commit** — Conventional Commit alinhado ao fatiamento (`fix(F24): …`, `test(…)`, `docs(F20): …`). Só commit se o usuário pediu.
5. **Atualize este artefato** na mesma mudança de docs (ou no commit de fix, se o usuário quiser docs junto):
   - Remova a linha do `ID` da tabela de **Achados abertos** (§2).
   - Se nenhum outro aberto restar naquela **Regra**, remova a subseção correspondente em §3.
   - Acrescente linha na tabela de **Problemas corrigidos** (§4) com novo `Cxx`, mesma `Stack`, `Tipo` estável da regra, evidência (`commit` hash ou “working tree + teste X”), link para regra `RC-…`.
   - Se o tipo é novo, copie o template de regra para §4 (corrigidos) com âncora `RC-…`.
   - Atualize **contagens** do cabeçalho e uma nota no resumo (“corrigido nesta passagem: R01, …”); se ainda houver abertos, mantenha o veredito coerente.
6. **Coding Expert** — ao fechar, mova o `ID` de “Achados abertos” para “Já corrigidos — não regrida” em `.claude/skills/coding-*/project.md` da Stack (não edite `rules/` por causa de um fix), para a próxima sessão não reintroduzir o bug.
7. **Não** marque fechado só porque “parece ok” ou porque o linter passou. Não delete histórico de corrigidos antigos (C01…).

### O que a auditoria full-base não faz

`audit-full-base` **não** corrige `src/`. Ela registra achados neste artefato **e** sincroniza as Coding Experts (`.claude/skills/coding-*/project.md`) com o aprendizado. Correção de código é sessão/pedido separado. Depois de um lote grande, rode de novo a full-base para confirmar se os `Cxx` novos ainda batem no código.

---

## 1. Resumo executivo

**Veredito:** o lote **deixou de estar bloqueado por 🔴**, mas **não está liberado**. Todos os 7 🔴 e 10 dos 12 🟡 de 2026-08-12 foram fechados no código desta branch (C58–C69), com `tsc -b` exit 0 e suíte completa verde. Restam 5 🟡 abertos: dois **deferidos de propósito** (A02, `hasInflight` do A05), dois achados **novos** (R07 na remediação, R08 encontrado no smoke ao vivo) e **D08**, agora estreitado. O smoke Electron real rodou em 2026-08-13 contra `claude` 2.1.231 e passou em permissão inline, allowlist, resume, export e Bash background sem órfão; falta apenas o Cancel explícito em turno foreground. O critério de UI de F03 deixou de estar sem evidência. C01–C57 permanecem válidos.

**Atualização do veredito (2026-08-17):** com o R09 fechado, não resta achado aberto desta passagem. O que segurava o "liberado" era a falta de evidência ao vivo (D08/A09) e a copy que mentia sobre quem negou (R08/R09); os dois grupos fecharam com smoke real e com a partição de casos única.

**Corrigido nesta passagem (2026-08-13)**

- **Segurança de parse:** R01 + D05 — `stream-json-parse.ts` itera com `isRecord` por elemento (cast `as ContentBlock[]` e a interface órfã sumiram); o loop de parse/dispatch em `cli-driver.ts` ganhou `try/catch` próprio que **não** loga a linha crua (podia ecoar `tool_input`) e passa o erro por `sanitizeProcessError`.
- **Binding de permissão:** R02 — `resolvePermissionRequest` recebe `threadId` e valida `entry.threadId` **antes** de consumir a entrada; `threads-handler` mapeia `thread_mismatch` → 409 `permission_thread_mismatch`.
- **Superfície do broker:** R04 (teto de 1 MiB fail-closed, 413 + `destroy`) e R06 (`res.ok` antes do `res.json()` no hook).
- **UX testável:** D01 + D02 — `chatSurface.logic.ts` novo, com `deriveChatSurface` chamando `routeComposerSend` internamente (a regra de roteamento nunca é reimplementada). Corrigiu de quebra uma divergência real: `waiting_user` sem pergunta pendente rotulava "Enviar resposta" enquanto o envio enfileirava.
- **Negação nativa visível:** R03 — `streamNotices.logic.ts` novo; `permission.native_denial` vira aviso PT-BR nomeando a tool, com teto `MAX_WORKSPACE_NOTICES = 20` (antes a lista crescia sem limite).
- **Hygiene:** A01, A03, A04, A05 (parcial), R05 e os gaps de teste D03/D04/D06/D07.

**Ainda aberto (por que o veredito não é "liberado")**

Nenhum. Todos os achados desta passagem estão fechados: D08, R07, A02/A05 e A09 até 2026-08-16, e o R09 em 2026-08-17. A linha de cada um em §2 diz onde e com que evidência.

### Por Stack (abertos)

| Stack | 🔴 | 🟡 |
|-------|----|----|
| `Node.js` | 0 | 2 |
| `React` | 0 | 1 |
| `Vitest` | 0 | 1 |
| `TypeScript` | 0 | 0 |
| `SQLite` | 0 | 0 |
| `Electron` | 0 | 0 |

---

## 2. Achados abertos

| ID | Stack | Sev | Frente | Local | Problema | Regra |
|----|--------|-----|--------|-------|----------|-------|
| A02 | `Node.js` | 🟡 | arch | `providers/permission-contract.ts` | **FECHADO PARCIALMENTE em 2026-08-16** (`2a6d112`, fatia D1). `checkSupervisedPermissionArgs` e `validatePermissionSettingsShape` ganharam consumidor de produção: `assertPermissionContract` roda antes do spawn e aborta o turno com erro visível. Fica aberto só o pedaço da matriz, agora rastreado como A09 | [R-export-should-be-local](#r-export-should-be-local) |
| A09 | `Node.js` | 🟡 | arch | `providers/permission-contract.ts` (`BASH_PERMISSION_MATRIX`) | **FECHADO em 2026-08-16** pelo smoke ao vivo das quatro formas de Bash contra `claude` 2.1.233. `expectsPreToolUseGate` valeu nas quatro (`ls`, `pwd && ls -1`, `python -m http.server 8931` em foreground, `sleep 20 && echo caso4-ok` com `run_in_background: true`) e nenhuma exigiu `requiresNativeDenialEventIfUngated`, porque nenhuma ficou sem gate. A nota pessimista da linha `run-in-background` **não se materializa** nesta versão: o card aparece igual às outras três. Evidência em `docs/F03-workspace/smoke-results.md` | [R-export-should-be-local](#r-export-should-be-local) |
| A05 | `React` | 🟡 | arch | `historyMerge.logic.ts:263` | **FECHADO em `5f6b1c7`**: o `hasInflight` ganhou consumidor de produção quando o resync do socket passou a serializar o refetch (`shouldRefetchHistoryOnResync`). A parte `stableJson` já tinha fechado em C69 | [R-export-should-be-local](#r-export-should-be-local) |
| R07 | `Node.js` | 🟡 | rob | `runtime-metrics.ts` | **FECHADO em `ed17966`** (fatia B2), e o registro só não tinha sido atualizado. `turnProcessCount` não existe mais: a métrica virou o par honesto `recordProviderProcessSpawned` / `recordProviderProcessExited`, junto com a `TurnSession` única | [R-metric-setter-semantic-drift](#r-metric-setter-semantic-drift) |
| D08 | `Vitest` | 🟡 | del | `docs/F03-workspace/smoke-results.md` | **FECHADO em 2026-08-16**. O que faltava era o Cancel explícito em turno longo **em foreground**, e o palco veio do caso `foreground-server` do A09: com `python -m http.server 8931` bloqueando a tool, o Parar produziu `Bash (cancelled)` no mesmo segundo, matou o processo e liberou a porta em menos de 2 s, assentou a thread em `cancelled` e não deixou gate aberto | [R-missing-smoke-evidence](#r-missing-smoke-evidence) |
| R08 | `React` | 🟡 | rob | `renderer/hooks/streamNotices.logic.ts` | **FECHADO em 2026-08-16** (`da022fa`). O broker registra o que concedeu no turno e o evento `permission.native_denial` carrega `brokerGranted`, que separa "o CLI negou sem consultar o broker" de "o broker concedeu e outro hook `PreToolUse` negou depois" — no segundo caso a copy deixou de mandar revisar o accessLevel, que não manda em hook de terceiro. O diagnóstico saiu do parser para o `dispatch`, único ponto com as duas metades. Sobre o `systemMessage` citado no achado: **esse campo não existe** no payload; o equivalente com evidência in-repo é `decision_reason`, agora propagado. Validado ao vivo (negação de `git log` por hook global do usuário) | [R-native-denial-copy-overreach](#r-native-denial-copy-overreach) |
| R09 | `Node.js` | 🟡 | rob | `providers/permission-contract.ts` + `permission-broker.ts` + `gate.ts` | **FECHADO em 2026-08-17.** O booleano `brokerGranted` virou `BrokerPermissionOutcome` (`granted`/`denied`/`expired`/`unavailable`/`never-requested`), produzido pelo broker e propagado até as duas copies por uma partição única (`nativeDenialCase`), importada pelo renderer em vez de reescrita. Para distinguir "o usuário negou" de "ninguém respondeu", a continuação do gate passou a entregar `{allow, reason}` — o motivo vem do próprio `closeGate`, não de uma releitura da linha depois do fato. Nada mudou de política: a resposta ao hook continua sendo o mesmo `allow`. As três limitações que a correção deixou foram tratadas em seguida, no mesmo dia: `cancelled` virou caso próprio (Parar com card aberto não é mais lido como "ninguém respondeu"); decisões opostas para a mesma tool no turno viram `ambiguous`, que admite não saber a qual chamada a negação pertence em vez de afirmar a errada; e a rejeição por tamanho (413), que responde antes de existir `toolName`, passa a marcar o turno e a ressalvar a frase de "nunca consultou o broker". O que **permanece** irredutível é a atribuição em si: o CLI manda `tool_use_id` na negação e o hook manda `toolName` no pedido, e não há chave comum entre os dois | [R-native-denial-copy-overreach](#r-native-denial-copy-overreach) |

### Notas de deferimento (resolvidas em 2026-08-16)

Os dois itens abaixo foram mantidos abertos por decisão deliberada em 2026-08-13, com consumidor de produção previsto numa fase seguinte deste mesmo trabalho. **Ambos chegaram lá**, e ficam registrados aqui porque a decisão de esperar foi correta: torná-los locais e reabrir depois teria sido trabalho jogado fora.

- **A02 — `providers/permission-contract.ts`.** Cumprido na fatia D1 (`2a6d112`): `checkSupervisedPermissionArgs` e `validatePermissionSettingsShape` rodam **antes do spawn do CLI**, dentro de `assertPermissionContract`, e uma regressão de contrato (grupo `PermissionRequest` faltando no `--settings`, comando do hook errado para a plataforma, `--permission-mode` divergente, `ELECTRON_RUN_AS_NODE` ausente) vira erro visível antes do turno começar. O sintoma que isso atacava era o agente pedir aprovação em prosa referindo um botão que nunca apareceu na tela. Sobrou só a matriz de Bash, que virou **A09** por não ter consumidor honesto do mesmo tipo.
- **A05 (parcial) — `hasInflight`.** Cumprido em `5f6b1c7`: o resync do socket serializa o refetch de histórico por ele.

---

## 3. Regras — achados abertos (1× por tipo × Stack)

<a id="r-export-should-be-local"></a>

### Export que deveria ser local
Esforço: baixo  
Classificação: Baixo  
Stack: `Node.js` / `React`  
Tipo: `export-should-be-local`  
Reabre contrato de [RC-export-should-be-local](#rc-export-should-be-local).

#### Por que isso é um problema?
Helper só de teste ou só interno exportado amplia API sem necessidade e atrasa refactors.

Correção: `export` só se houver consumidor de produção; senão local ou mover para o `*.test.ts` / fixture.

#### Exceções
Símbolo usado por mais de um arquivo de produção. Símbolo com consumidor de produção **planejado e nomeado** numa fase seguinte do mesmo trabalho pode ficar aberto com nota de deferimento (A02, `hasInflight`), em vez de virar local e ser reaberto depois.

---

<a id="r-metric-setter-semantic-drift"></a>

### Contador cujo setter sobrescreve não é contagem
Esforço: baixo (mas exige call site + setter no mesmo commit)  
Classificação: Médio  
Stack: `Node.js`  
Tipo: `metric-setter-semantic-drift`

#### Por que isso é um problema?
`recordTurnProcessCount` faz `counters.turnProcessCount = count` (sobrescreve, não soma) e o único call site passa `typeof child.pid === 'number' ? 1 : 0`. O campo chamado `turnProcessCount` é, na prática, um booleano "o último turno tinha PID", nunca uma contagem de processos do turno. Quem ler o snapshot para diagnosticar vazamento de processo vai concluir o oposto do que o dado significa.

Não conforme:

```ts
// runtime-metrics.ts
export function recordTurnProcessCount(count: number): void {
  counters.turnProcessCount = count   // sobrescreve
}

// providers/cli-driver.ts
recordTurnProcessCount(typeof child.pid === 'number' ? 1 : 0)   // sempre 0 ou 1
```

Correção: decidir a semântica e mudar **os dois lados juntos**. Ou o setter acumula (`+= count`) e o call site reporta processos reais do turno (incluindo a árvore de filhos), ou o campo é renomeado para o que ele de fato mede (ex.: `turnHadProcess`, booleano). O teste atual em `runtime-metrics.test.ts` trava o comportamento vigente **de propósito**, então ele muda no mesmo commit.

#### Exceções
Nenhuma. Se a decisão for manter o booleano, o rename é obrigatório: um nome `*Count` que não conta é o bug.

---

<a id="r-missing-smoke-evidence"></a>

### Smoke E2E incompleto no critério UI
Esforço: médio  
Classificação: Médio  
Stack: `Vitest`  
Tipo: `missing-smoke-evidence`  
Reabre contrato de [RC-missing-smoke-evidence](#rc-missing-smoke-evidence) para lacuna residual F03.

#### Por que isso é um problema?
Permission Recovery depende de DOM (Cancel + export + Bash background). Unitário dos sprints não fecha o AC visual.

Correção: uma passagem Electron + playwright-cli; registrar em `docs/F03-workspace/smoke-results.md` (não só “recomendado”).

#### Exceções
AC estritamente API/crypto sem superfície UI.

---

## 4. Problemas corrigidos

Fonte: auditoria 2026-08-07 (Lotes 1–2) + follow-ups + remediação 2026-08-08 (C18–C30) + fechamento 2026-08-09 (C31–C32) + remediação 2026-08-13 (C58–C69).  
Cada tipo aparece **uma vez** com evidência. Itens da matriz §9 de produto não entram aqui.  
**Nota:** C14 (`sanitize-stderr`) cobre a base `x-access-token`/`sk-*`; C31 estende para os schemes F24 e os prefixos `xai-`/`gsk_`. Os dois permanecem válidos e não voltam para abertos.

| ID | Stack | Tipo | Evidência | Regra |
|----|--------|------|-----------|-------|
| C01 | `Node.js` | `guard-423-before-401` | `1075879`, `_transport.ts` guard | [RC-guard-423](#rc-guard-423) |
| C02 | `Node.js` | `handler-route-overclaim` | `85e5e07` skills-handler | [RC-route-claim](#rc-route-claim) |
| C03 | `Node.js` | `unlock-payload-validation` | `28ea298` | [RC-unlock-validate](#rc-unlock-validate) |
| C04 | `Node.js` | `oauth-https-allowlist` | `b8b79d1` | [RC-oauth-https](#rc-oauth-https) |
| C05 | `Node.js` | `vault-corrupted-422` | `60d5fb6`, `4d343d2` | [RC-vault-corrupted](#rc-vault-corrupted) |
| C06 | `Node.js` | `cors-wildcard-loopback` | `95d1662` | [RC-cors-local](#rc-cors-local) |
| C07 | `React` | `silent-catch` | `83465ed` | [RC-no-silent-catch](#rc-no-silent-catch) |
| C08 | `React` | `duplicated-fetch-client` | `4fba3a4` `api-client` | [RC-shared-api-request](#rc-shared-api-request) |
| C09 | `Node.js` | `duplicated-http-boilerplate` | `0a3d627` `_transport` | [RC-shared-transport](#rc-shared-transport) |
| C10 | `Electron` | `preload-generic-passthrough` | `787c281` | [RC-named-preload](#rc-named-preload) |
| C11 | `Electron` | `hardcoded-vite-url` | `cf4f013` | [RC-vite-env-url](#rc-vite-env-url) |
| C12 | `Electron` | `dead-scaffold` | `00674ea` | [RC-no-dead-scaffold](#rc-no-dead-scaffold) |
| C13 | `Node.js` | `non-atomic-vault-write` | `bee58cc` | [RC-atomic-vault](#rc-atomic-vault) |
| C14 | `Node.js` | `raw-stderr-to-ui` | `eb716d5` | [RC-sanitize-stderr](#rc-sanitize-stderr) |
| C15 | `Electron` | `electron-spawn-as-node` | F15 / PROGRESS (`ELECTRON_RUN_AS_NODE=1`) | [RC-electron-run-as-node](#rc-electron-run-as-node) |
| C16 | `SQLite` | `premature-repo-factory` | `ade3286` | [RC-module-repo](#rc-module-repo) |
| C17 | `Node.js` | `artifacts-outside-userdata` | `2061cf2` | [RC-artifacts-userdata](#rc-artifacts-userdata) |
| C18 | `Node.js` | `http-body-type-trust` | working tree 2026-08-08 (sem commit); `skills-handler.ts`, `config-handler.ts`, `rules-handler.ts` | [RC-http-body-type-trust](#rc-http-body-type-trust) |
| C19 | `Node.js` | `error-message-path-leak` | working tree 2026-08-08 (sem commit); `codegraph-handler.ts` | [RC-error-message-path-leak](#rc-error-message-path-leak) |
| C20 | `Node.js` | `http-unhandled-hang` | working tree 2026-08-08 (sem commit); `memory-handler.ts`, `codegraph-handler.ts`, `unlock-handler.ts` | [RC-http-unhandled-hang](#rc-http-unhandled-hang) |
| C21 | `Node.js` | `ws-auth-status-collapse` | working tree 2026-08-08 (sem commit); `ws-upgrade.ts` | [RC-ws-auth-status-collapse](#rc-ws-auth-status-collapse) |
| C22 | `Electron` | `ipc-numeric-bounds` | working tree 2026-08-08 (sem commit); `main/index.ts` | [RC-ipc-numeric-bounds](#rc-ipc-numeric-bounds) |
| C23 | `Node.js` | `error-code-vocabulary-drift` | working tree 2026-08-08 (sem commit); `skills-handler.ts`, `config-handler.ts` | [RC-error-code-vocabulary-drift](#rc-error-code-vocabulary-drift) |
| C24 | `Node.js` | `http-body-size-unbounded` | working tree 2026-08-08 (sem commit); `_transport.ts` (`MAX_BODY_BYTES`, `PayloadTooLargeError`) | [RC-http-body-size-unbounded](#rc-http-body-size-unbounded) |
| C25 | `Node.js` | `partial-destructive-effect` | working tree 2026-08-08 (sem commit); `apply-diff.ts` reject tudo-ou-nada | [RC-partial-destructive-effect](#rc-partial-destructive-effect) |
| C26 | `Node.js` | `error-message-locale` | working tree 2026-08-08 (sem commit); `unlock-handler.ts` 404 PT-BR | [RC-error-message-locale](#rc-error-message-locale) |
| C27 | `Node.js` | `layer-inversion` | working tree 2026-08-08 (sem commit); `services/config/defaults.ts` novo, `dispatch.ts` importa de lá | [RC-layer-inversion](#rc-layer-inversion) |
| C28 | `Node.js` | `export-should-be-local` | working tree 2026-08-08 (sem commit); `composer-images.ts` `estimateBase64ByteLength` local | [RC-export-should-be-local](#rc-export-should-be-local) |
| C29 | `React` | `business-rule-in-tsx` | working tree 2026-08-08 (sem commit); 8 telas/componentes → `*.logic.ts` + `*.logic.test.ts` | [RC-business-rule-in-tsx](#rc-business-rule-in-tsx) |
| C30 | `Vitest` | `missing-sibling-test` | working tree 2026-08-08 (sem commit); `messages.test.ts`, `_transport.test.ts`, `store.test.ts`, `vault-service.test.ts`, `git-client.test.ts` (785/785 `pnpm test`) | [RC-missing-sibling-test](#rc-missing-sibling-test) |
| C31 | `Node.js` | `incomplete-vcs-url-redaction` | `055807d`; `process-error.ts` userinfo HTTPS genérico + `xai-`/`gsk_`, com um caso por scheme em `process-error.test.ts` (fecha R01 e R07) | [RC-vcs-url-redaction](#rc-vcs-url-redaction) |
| C32 | `React` | `duplicated-client-server-validation` | `40037d8`; `configuracaoScreen.logic.ts` importa `provider-keys.js` / `github-token.js`, coberto por `configuracaoScreen.logic.test.ts` | [RC-shared-validation](#rc-shared-validation) |
| C33 | `Vitest` | `missing-smoke-evidence` | working tree 2026-08-09; `docs/F20\|F21\|F23\|F26\|F27-*/smoke-results.md` (fatia prioritária, smoke real via `playwright-cli` + Electron) | [RC-missing-smoke-evidence](#rc-missing-smoke-evidence) |
| C34 | `Node.js` | `cors-methods-allowlist-gap` | working tree 2026-08-09; `unlock-handler.ts` (`Access-Control-Allow-Methods` sem `PATCH`), achado ao vivo no smoke de F20, teste em `unlock-handler.test.ts` | [RC-cors-methods-allowlist-gap](#rc-cors-methods-allowlist-gap) |
| C35 | `Node.js` | `http-status-code-collision` | working tree 2026-08-09; `voice-handler.ts` (`voice_auth_error` de 401→422), achado ao vivo no smoke de F27, teste em `voice-handler.test.ts` | [RC-http-status-code-collision](#rc-http-status-code-collision) |
| C36 | `Vitest` | `missing-smoke-evidence` | working tree 2026-08-09; `docs/F04\|F05\|F08\|F10\|F14\|F16\|F17-*/smoke-results.md` — **D07 fechado por completo**; F04/F08/F10/F14/F16/F17 formalizados a partir da narrativa real já existente em `PROGRESS.md`, F05 rodado ao vivo pela primeira vez | [RC-missing-smoke-evidence](#rc-missing-smoke-evidence) |
| C37 | `React` | `harness-count-stale-after-modal-close` | working tree 2026-08-09; `WorkspaceSidebar.tsx` (`refreshHarnessCounts` chamado no `onClose` dos 4 modais de vínculo), achado ao vivo no smoke de F05, `pnpm test` 1012/1012 | [RC-harness-count-stale-after-modal-close](#rc-harness-count-stale-after-modal-close) |
| C38 | `SQLite` | `skills-json-outside-sqlite` | working tree 2026-08-09; migration `012_skills`, `repositories/skills.ts` reescrito como funções de módulo sobre `getDb()`, migração automática do `skills.json` legado + 6 consumidores/6 arquivos de teste atualizados, confirmado ao vivo com app real + `skills.json` legado semeado, `pnpm test` 1013/1013 | [RC-skills-json-outside-sqlite](#rc-skills-json-outside-sqlite) |
| C39 | `Node.js` | `dead-export` | `52cf9cc`; `git-client.ts` `injectTokenIntoHttpsUrl` e `vcs/oauth.ts` `getTokens` sem `export` (fecha A02+A03) | [RC-dead-export](#rc-dead-export) |
| C40 | `Node.js` | `error-message-locale-residual` | `6490437`; `unlock-handler.ts` `cors_denied` em PT-BR (fecha R03) | [RC-error-message-locale-residual](#rc-error-message-locale-residual) |
| C41 | `Node.js` | `ws-query-token-legacy` | `e0c5672`; `ws-upgrade.ts` autentica só por subprotocol, sem fallback `?token=` (fecha R04) | [RC-ws-query-token-legacy](#rc-ws-query-token-legacy) |
| C42 | `Node.js` | `http-body-narrowing-gap` | `9ac433e`; `subagents-handler.ts` narrowing de `model`/`reasoningLevel`/`category`/`tools`/`enabled` antes do cast (fecha R05) | [RC-http-body-narrowing-gap](#rc-http-body-narrowing-gap) |
| C43 | `Electron` | `pty-env-inheritance` | `4daaafe`; `pty-session-registry.ts` `buildPtyEnv` allowlist no spawn do terminal dock (fecha R06) | [RC-pty-env-inheritance](#rc-pty-env-inheritance) |
| C44 | `Vitest` | `missing-sibling-coverage` | `730c552`; `codegraph/ensure.test.ts` + `query.test.ts` (fecha D01 por completo) e `runner/mcp-registry.test.ts`/`rule-registry.test.ts`/`thread-cwd.test.ts`/`turn-control.test.ts` (fecha parte de D02) | [RC-missing-sibling-coverage](#rc-missing-sibling-coverage) |
| C45 | `Vitest` | `missing-sibling-coverage` | working tree 2026-08-09; `vcs/oauth-config.test.ts`, `mcps/catalog.test.ts`, `config/defaults.test.ts` — **D02 fechado por completo**, `pnpm test` 1022/1022 | [RC-missing-sibling-coverage](#rc-missing-sibling-coverage) |
| C46 | `Node.js` | `http-body-narrowing-gap` | working tree 2026-08-10; PUT link `subagents-handler`/`mcps-handler` + `git-handler` body string + `consumo-handler` approximate boolean; testes 400 (fecha R01/R02/R08/R09) | [RC-http-body-narrowing-gap](#rc-http-body-narrowing-gap) |
| C47 | `Node.js` | `spawn-failed-unsanitized` | working tree 2026-08-10; `cli-driver.ts` `sanitizeProcessError` em `provider_spawn_failed` (fecha R03) | [RC-spawn-failed-unsanitized](#rc-spawn-failed-unsanitized) |
| C48 | `React` | `silent-catch-regression` | working tree 2026-08-10; harness/`McpsScreen` catalog/`McpOauthControls`/`VcsOauthCard` (fecha R04/R05/R10) | [RC-silent-catch-regression](#rc-silent-catch-regression) |
| C49 | `React` | `business-rule-in-tsx` | working tree 2026-08-10; `codegraphSection.logic.ts` + `loginScreen.logic.ts` + testes (fecha D01/D02) | [RC-business-rule-in-tsx](#rc-business-rule-in-tsx) |
| C50 | `SQLite` | `dead-export` | working tree 2026-08-10; remove `getProjectByPath`; `getLogEntry`/`getUsageEvent` locais; remove `countAllPending` (fecha A01/A04–A06) | [RC-dead-export](#rc-dead-export) |
| C51 | `Vitest` | `missing-link-body-regression` | working tree 2026-08-10; PUT 400 em `skills-handler.test.ts`/`rules-handler.test.ts` (fecha D03) | [RC-missing-link-body-regression](#rc-missing-link-body-regression) |
| C52 | `Vitest` | `flaky-process-timeout` | working tree 2026-08-10; `delegate.test.ts` parallel batch `testTimeout: 30_000` (fecha D04) | [RC-flaky-process-timeout](#rc-flaky-process-timeout) |
| C53 | `Node.js` | `unlock-body-unbounded` | working tree 2026-08-10; unlock usa `readBody` + 413; `readBody` pausa em vez de destroy (fecha R06) | [RC-unlock-body-unbounded](#rc-unlock-body-unbounded) |
| C54 | `Node.js` | `cli-env-inheritance` | working tree 2026-08-10; `cli-driver.ts` `buildPtyEnv` + key do provider (fecha R07) | [RC-cli-env-inheritance](#rc-cli-env-inheritance) |
| C55 | `Node.js` | `spawn-cleanup-gap` | working tree 2026-08-10; catch síncrono chama `cleanupPermissionSettings` (fecha R11) | [RC-spawn-cleanup-gap](#rc-spawn-cleanup-gap) |
| C56 | `Node.js` | `error-message-locale-residual` | working tree 2026-08-10; `repositories/subagents.ts` `Subagente …` (fecha R12) | [RC-error-message-locale-residual](#rc-error-message-locale-residual) |
| C57 | `Node.js` | `dead-export` | working tree 2026-08-10; `getTokens` local; `parseOauthMetadata` em `oauth-metadata.ts` com consumidor (fecha A02/A03) | [RC-dead-export](#rc-dead-export) |
| C58 | `Node.js` | `stream-json-content-narrow` | working tree 2026-08-13 (branch `fix/f03-audit-close`); `providers/stream-json-parse.ts` sem cast `as ContentBlock[]` nos branches `assistant`/`user` (iteração filtra por `isRecord`, interface `ContentBlock` removida por ficar órfã) + `providers/cli-driver.ts` com `try/catch` próprio no loop de parse/dispatch, sem logar a linha crua, erro por `sanitizeProcessError` (fecha R01) | [RC-stream-json-content-narrow](#rc-stream-json-content-narrow) |
| C59 | `Vitest` | `missing-sibling-coverage` | working tree 2026-08-13; `stream-json-parse.test.ts` (+4 `it`: `content: [null, 1, "x"]` em `assistant` e `user`, mais dois mistos provando que item inválido não aborta o loop), `runtime-metrics.test.ts` novo (9 `it`), `git-handler.test.ts` (+2 `it`: `waiting_permission` e `stopping` → 409 `thread_busy`), `executionGraph.logic.test.ts` (+2 `it` nos **dois** chamadores de `mapThreadState`), `threads-handler.test.ts` (+2 `it` em `GET …/permissions`: 401 com assert de que o handler reivindica a rota, e 423 provando a ordem) — fecha D03/D04/D05/D06/D07 | [RC-missing-sibling-coverage](#rc-missing-sibling-coverage) |
| C60 | `React` | `business-rule-in-tsx` | working tree 2026-08-13; `workspace/chatSurface.logic.ts` + teste (26 `it`) — `deriveChatSurface` chama `routeComposerSend` internamente (`route` nunca reimplementado) e um `it` percorre 9 estados × 4 booleanos × 7 textos comparando contra a chamada direta; `TaskComposer.tsx` e `ChatHistory.tsx` não derivam mais regra do estado cru da thread. Corrigiu de quebra uma divergência real de rótulo (`waiting_user` sem pergunta pendente rotulava "Enviar resposta" enquanto o envio enfileirava) — fecha D01/D02 | [RC-business-rule-in-tsx](#rc-business-rule-in-tsx) |
| C61 | `Node.js` | `dead-export` | working tree 2026-08-13; `runtime-metrics.ts` com `isRuntimeMetricsEnabled` **removido por inteiro** (wrapper de uma linha sobre o `enabled()` interno, zero consumidores); `getRuntimeMetricsSnapshot` e `resetRuntimeMetricsForTesting` ganharam consumidor no teste novo (fecha A01) | [RC-dead-export](#rc-dead-export) |
| C62 | `Node.js` | `permission-thread-binding` | working tree 2026-08-13; `permission-broker.ts` com `resolvePermissionRequest(threadId, requestId, allow, always?, scope?)` validando `entry.threadId === threadId` **antes** de consumir a entrada, retorno `{ok:true;toolName}` \| `{ok:false;code:'not_found'\|'thread_mismatch'}`; `threads-handler.ts` passa o threadId do path e mapeia `thread_mismatch` → 409 `permission_thread_mismatch`; testes em `permission-broker.test.ts` e `threads-handler.test.ts` (fecha R02) | [RC-permission-thread-binding](#rc-permission-thread-binding) |
| C63 | `Node.js` | `broker-body-unbounded` | working tree 2026-08-13; `buffer-cap.ts` `PERMISSION_BODY_MAX_BYTES` (1 MiB) + `permission-broker.ts` com contador por chunk, 413 e `req.destroy()` no estouro, `overCap` cortando o `on('end')` e nenhum pending criado (fail-closed); teste com `testTimeout` explícito (fecha R04) | [RC-broker-body-unbounded](#rc-broker-body-unbounded) |
| C64 | `Node.js` | `hook-http-status-check` | working tree 2026-08-13; `permission-hook.ts` (dentro de `SCRIPT_SOURCE`) checa `if (!res.ok)` antes do `res.json()` e nega com o status na mensagem; teste com servidor fake devolvendo 403 (fecha R06) | [RC-hook-http-status-check](#rc-hook-http-status-check) |
| C65 | `React` | `native-denial-ui-gap` | working tree 2026-08-13; `hooks/streamNotices.logic.ts` + teste (9 `it`) — `mcpNotices` virou união discriminada `WorkspaceNotice` (`kind: 'mcp' \| 'native_denial'`), branch novo em `handleStreamEvent` traduz `permission.native_denial` em aviso PT-BR nomeando a tool, e o teto `MAX_WORKSPACE_NOTICES = 20` passou a ser aplicado (antes a lista crescia sem limite) (fecha R03) | [RC-native-denial-ui-gap](#rc-native-denial-ui-gap) |
| C66 | `TypeScript` | `non-null-assertion-mask` | working tree 2026-08-13; `usePrincipalWorkspace.ts` sem `pendingPermission!` (via `const recovered` local) e com o branch seguinte endurecido: `resolve_permission` sem permissão faz early-return com erro visível em vez de cair em silêncio nos branches de baixo e virar turno novo (fecha R05) | [RC-non-null-assertion-mask](#rc-non-null-assertion-mask) |
| C67 | `Node.js` | `permission-mode-constant-drift` | working tree 2026-08-13; `providers/cli-driver.ts` `permissionModeFlag` retorna `SUPERVISED_PERMISSION_MODE` em vez do literal `'auto'` (fecha A03) | [RC-permission-mode-constant-drift](#rc-permission-mode-constant-drift) |
| C68 | `Node.js` | `export-should-be-local` | working tree 2026-08-13; `buffer-cap.ts` `truncateStringWithMarker` virou local e o teste passou a exercitá-la via `truncateToolResultPayload` (fecha A04) | [RC-export-should-be-local](#rc-export-should-be-local) |
| C69 | `React` | `export-should-be-local` | working tree 2026-08-13; `historyMerge.logic.ts:15` `stableJson` perdeu o `export` (zero consumidor fora do módulo); fecha **só a parte `stableJson`** do A05; `hasInflight` segue aberto com nota de deferimento em §2 | [RC-export-should-be-local](#rc-export-should-be-local) |

### Regras — problemas corrigidos

<a id="rc-guard-423"></a>

### Guard HTTP: vault locked antes de sessão
Esforço: 30 minutos  
Classificação: Crítico  
Stack: `Node.js`  
Tipo corrigido: `guard-423-before-401`

#### Por que isso é um problema?
Checar só o token com o cofre travado devolve 401 e pode fazer um handler reivindicar a rota, sombreando o 423 correto de outro handler na cadeia.

```
// Não conforme
if (req.headers['x-engrenacode-session'] !== token) {
  sendError(res, 401, 'unauthorized', '...')
  return true // reivindica a rota
}
```

```
// Conforme
if (vaultService.isLocked()) {
  sendError(res, 423, 'vault_locked', '...')
  return false // ou return após send, sem engolir rotas alheias
}
if (!isAuthorized(req)) {
  sendError(res, 401, 'unauthorized', '...')
}
```

#### Exceções
Rotas públicas (unlock/health) declaradas sem `guard`.

---

<a id="rc-route-claim"></a>

### Handler só reivindica paths do seu domínio
Esforço: 45 minutos  
Classificação: Alto  
Stack: `Node.js`  
Tipo corrigido: `handler-route-overclaim`

#### Por que isso é um problema?
Prefixo largo (`/api/projects/`) + falha de auth faz o handler responder 401/404 para rotas de outro domínio (ex.: MCPs), antes da cadeia chegar ao dono.

```
// Não conforme
if (url.startsWith('/api/projects/')) {
  if (!auth) { sendError(401); return true }
}
```

```
// Conforme
if (!isSkillsProjectShape(url)) return false
```

#### Exceções
Router central único (se um dia existir) que despacha por tabela — não a cadeia atual de `return false`.

---

<a id="rc-unlock-validate"></a>

### Unlock valida typeof e JSON; erros no envelope padrão
Esforço: 30 minutos  
Classificação: Crítico  
Stack: `Node.js`  
Tipo corrigido: `unlock-payload-validation`

#### Por que isso é um problema?
JSON malformado ou `password` não-string virava 500 ou resposta fora de `{ error: { code, message } }`, quebrando a LoginScreen.

```
// Não conforme
const body = JSON.parse(raw) // throw → 500
await unlock(body.password)
```

```
// Conforme
const data = parseBody(raw)
if (data === null || typeof data.password !== 'string') {
  return sendError(res, 400, 'invalid_request', '...')
}
```

#### Exceções
Resposta de unlock bem-sucedida continua no contrato `{ unlocked, sessionToken? }` documentado na F01.

---

<a id="rc-oauth-https"></a>

### Endpoint OAuth remoto só via https
Esforço: 20 minutos  
Classificação: Crítico  
Stack: `Node.js`  
Tipo corrigido: `oauth-https-allowlist`

#### Por que isso é um problema?
Abrir `http://` ou esquema arbitrário no fluxo OAuth permite interceptação ou handlers locais perigosos.

```
// Não conforme
openExternal(authorizationEndpoint) // qualquer string
```

```
// Conforme
if (typeof url !== 'string' || !url.startsWith('https://')) return false
```

#### Exceções
Nenhuma para autorização/token endpoint remoto.

---

<a id="rc-vault-corrupted"></a>

### Envelope estruturalmente ilegível → 422 vault_corrupted
Esforço: 1 hora  
Classificação: Crítico  
Stack: `Node.js`  
Tipo corrigido: `vault-corrupted-422`

#### Por que isso é um problema?
A spec F01 exige distinguir cofre corrompido de senha errada. Senha errada permanece `unlocked: false`; arquivo ilegível precisa de 422 sem backoff de auth.

```
// Não conforme
catch { return { unlocked: false } } // mascara corrupção
```

```
// Conforme
catch (e) {
  if (isCorruptEnvelope(e)) {
    return sendError(res, 422, 'vault_corrupted', 'O cofre local está danificado...')
  }
}
```

#### Exceções
Falha de auth tag (senha errada) **não** é `vault_corrupted`.

---

<a id="rc-cors-local"></a>

### CORS do loopback só origens locais
Esforço: 30 minutos  
Classificação: Crítico  
Stack: `Node.js`  
Tipo corrigido: `cors-wildcard-loopback`

#### Por que isso é um problema?
`Access-Control-Allow-Origin: *` no unlock server permite que uma página estrangeira no browser do usuário chame a API local (com as limitações de browser), ampliando a superfície.

```
// Não conforme
res.setHeader('Access-Control-Allow-Origin', '*')
```

```
// Conforme
// permitir só 127.0.0.1 / localhost (Vite) e null (file://)
```

#### Exceções
Origin ausente em clientes não-browser (curl/smoke) conforme política já testada.

---

<a id="rc-no-silent-catch"></a>

### Não engula rejeição de fetch com catch vazio
Esforço: 15 minutos  
Classificação: Médio  
Stack: `React`  
Tipo corrigido: `silent-catch`

#### Por que isso é um problema?
`.catch(() => {})` esconde falha de status/catálogo; o usuário vê UI stale sem feedback.

```
// Não conforme
loadStatus().catch(() => {})
```

```
// Conforme
loadStatus().catch((err) => console.error('[workspace]', err))
// + estado de erro na UI quando aplicável
```

#### Exceções
Cancelamento deliberado (AbortError) pode ser silencioso se o unmount for a causa.

---

<a id="rc-shared-api-request"></a>

### Um cliente HTTP no renderer para o loopback
Esforço: 1 hora  
Classificação: Médio  
Stack: `React`  
Tipo corrigido: `duplicated-fetch-client`

#### Por que isso é um problema?
N cópias de `fetch` + header de sessão divergem no tratamento de 401/423 e duplicam bugs.

```
// Não conforme
// cada *-service.ts com seu próprio fetch + headers
```

```
// Conforme
// api-client.ts → apiRequest(); services só montam path/body
```

#### Exceções
Unlock pré-sessão em `LoginScreen` (rota pública) pode usar `fetch` direto.

---

<a id="rc-shared-transport"></a>

### Handlers compartilham guard/parseBody/sendJson
Esforço: 1–2 horas  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `duplicated-http-boilerplate`

#### Por que isso é um problema?
Copiar `guard`/`parseBody` em 12 arquivos garante drift (um esquece 423, outro formata erro diferente).

```
// Não conforme
// cada handler reimplementa parseBody e sendError
```

```
// Conforme
import { guard, parseBody, sendJson, sendError, readBody } from './_transport.js'
```

#### Exceções
Nenhuma para novos handlers no loopback 5174.

---

<a id="rc-named-preload"></a>

### Preload só expõe APIs nomeadas
Esforço: 45 minutos  
Classificação: Alto  
Stack: `Electron`  
Tipo corrigido: `preload-generic-passthrough`

#### Por que isso é um problema?
`invoke`/`send`/`on` genéricos permitem ao renderer falar qualquer canal IPC, furando o princípio de superfície mínima.

```
// Não conforme
contextBridge.exposeInMainWorld('electronAPI', { invoke, send, on })
```

```
// Conforme
contextBridge.exposeInMainWorld('electronAPI', {
  vault: { getSessionToken, isLocked, lock },
  dialog: { openFolder },
  shell: { openExternal },
})
```

#### Exceções
Nenhuma para canais novos — sempre método nomeado + `ipcMain.handle` correspondente.

---

<a id="rc-vite-env-url"></a>

### loadURL de dev lê VITE_DEV_SERVER_URL
Esforço: 10 minutos  
Classificação: Médio  
Stack: `Electron`  
Tipo corrigido: `hardcoded-vite-url`

#### Por que isso é um problema?
Porta 5173 costuma estar ocupada; hardcode desalinha `.env.local` e o Electron carrega a URL errada.

```
// Não conforme
mainWindow.loadURL('http://localhost:5173')
```

```
// Conforme
mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173')
```

#### Exceções
Produção usa `loadFile` do `dist/index.html`, não esta URL.

---

<a id="rc-no-dead-scaffold"></a>

### Remova scaffold/middleware sem consumidor
Esforço: 15 minutos  
Classificação: Baixo  
Stack: `Electron`  
Tipo corrigido: `dead-scaffold`

#### Por que isso é um problema?
Arquivos órfãos (`session-middleware`, `App.tsx` raiz de scaffold) confundem agentes e humanos sobre a fronteira real.

```
// Não conforme
// session-middleware.ts estilo Express sem importadores
```

Delete o módulo ou ligue-o a um uso concreto na mesma mudança.

#### Exceções
Fixtures de teste sob tmpdir / `.playwright-cli/` gitignored.

---

<a id="rc-atomic-vault"></a>

### Escrita de vault.enc é atômica (tmp + rename)
Esforço: 30 minutos  
Classificação: Alto  
Stack: `Node.js`  
Tipo corrigido: `non-atomic-vault-write`

#### Por que isso é um problema?
Write in-place pode deixar `vault.enc` truncado se o processo cair no meio → corrupção real.

```
// Não conforme
writeFileSync(vaultPath, ciphertext)
```

```
// Conforme
writeFileSync(tmpPath, ciphertext)
renameSync(tmpPath, vaultPath)
```

#### Exceções
Nenhuma para o blob principal do cofre.

---

<a id="rc-sanitize-stderr"></a>

### Sanitise stderr de processo antes da UI
Esforço: 30 minutos  
Classificação: Alto  
Stack: `Node.js`  
Tipo corrigido: `raw-stderr-to-ui`

#### Por que isso é um problema?
Stderr de CLI/provider pode conter paths, tokens parciais ou ruído; mostrar cru na timeline vaza detalhe e assusta o usuário.

```
// Não conforme
appendTimeline(err.stderr)
```

```
// Conforme
appendTimeline(sanitizeProcessError(err.stderr))
```

#### Exceções
Logs de desenvolvedor no console do main (não na UI).

---

<a id="rc-electron-run-as-node"></a>

### Spawn de script Node a partir do Electron usa ELECTRON_RUN_AS_NODE
Esforço: 30 minutos  
Classificação: Crítico  
Stack: `Electron`  
Tipo corrigido: `electron-spawn-as-node`

#### Por que isso é um problema?
`process.execPath` no main é o binário Electron. Sem `ELECTRON_RUN_AS_NODE=1`, MCP interno / bridges falham em produção e passam nos unitários (que usam Node).

```
// Não conforme
spawn(process.execPath, [script], { env: process.env })
```

```
// Conforme
spawn(process.execPath, [script], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
})
```

#### Exceções
Spawn do CLI `claude`/`codex` instalado no PATH (não o `execPath` do Electron).

---

<a id="rc-module-repo"></a>

### Prefira funções de módulo a factory sem polimorfismo
Esforço: 1 hora  
Classificação: Baixo  
Stack: `SQLite`  
Tipo corrigido: `premature-repo-factory`

#### Por que isso é um problema?
`createSubagentsRepository()` sem implementações alternativas é abstração sem uso concreto (KISS).

```
// Não conforme
export function createSubagentsRepository() { return { list, create, ... } }
```

```
// Conforme
export function listSubagents() { ... }
export function createSubagent(...) { ... }
```

#### Exceções
Factory justificada por fake injetável em teste **e** segunda implementação real.

---

<a id="rc-artifacts-userdata"></a>

### Artefatos de turno ficam sob userData
Esforço: 45 minutos  
Classificação: Alto  
Stack: `Node.js`  
Tipo corrigido: `artifacts-outside-userdata`

#### Por que isso é um problema?
Escrever anexos/worktree fora de `app.getPath('userData')` (ou vazar para `project.path` em modo worktree) quebra o contrato F13 e polui o repo do usuário.

```
// Não conforme
writeFileSync(join(project.path, '.engrenacode-tmp', file), data)
```

```
// Conforme
writeFileSync(join(userData, 'turns', threadId, file), data)
```

#### Exceções
Diffs aplicados de propósito no working tree / worktree do projeto após Accept.

---

<a id="rc-http-body-type-trust"></a>

### Estreite cada campo do JSON na fronteira HTTP
Esforço: 1–2 horas (handlers afetados + testes)  
Classificação: Alto / Crítico  
Stack: `Node.js`  
Tipo corrigido: `http-body-type-trust`

#### Por que isso é um problema?
`parseBody<T>` só tipa em compile-time. Em runtime o body é `unknown`. Confiar em `data.name` como `string` e chamar `.trim()` no repositório transforma payload malicioso/malformado em `TypeError` → 500, em vez de 400 `invalid_request`.

```
// Não conforme
const data = parseBody<SkillCreateInput>(await readBody(req))
if (data === null) return sendError(...)
skillsRepository.create(data) // data.name pode ser number
```

Valide `typeof` (e enums/limites) no handler antes do repositório, no padrão de `rules-handler` create.

```
// Conforme
if (typeof data.name !== 'string' || typeof data.content !== 'string') {
  return sendError(res, 400, 'invalid_request', '...')
}
```

#### Exceções
Rotas públicas deliberadas (unlock) ainda validam tipos, só dispensam `guard`. Campos opcionais ausentes (`undefined`) diferem de presentes com tipo errado — aceite ausência; rejeite tipo errado.

---

<a id="rc-error-message-path-leak"></a>

### Não propague Error.message cru ao cliente HTTP
Esforço: 20 minutos  
Classificação: Alto / Crítico  
Stack: `Node.js`  
Tipo corrigido: `error-message-path-leak`

#### Por que isso é um problema?
Mensagens de FS/`renameSync`/`ENOENT` costumam carregar paths absolutos do usuário. Expor isso no JSON viola privacidade e o contrato de erro estável (`{ error: { code, message } }` com copy PT-BR controlada).

```
// Não conforme
sendError(res, 500, 'codegraph_index_failed', `Falha: ${err.message}`)
```

Logue o erro no console do main; responda mensagem genérica (ou passe por sanitizer).

```
// Conforme
console.error('[codegraph]', err)
sendError(res, 500, 'codegraph_index_failed', 'Falha ao indexar o CodeGraph.')
```

#### Exceções
Erros de domínio já mapeados com `code` + mensagem canônica (ex.: `rule_not_found`) podem ir ao cliente. Nunca interpolar `err.message` de Node/`fs`/`child_process` sem sanitização.

---

<a id="rc-http-unhandled-hang"></a>

### Todo handler async precisa catch que fecha a resposta
Esforço: 45 minutos  
Classificação: Alto / Crítico  
Stack: `Node.js`  
Tipo corrigido: `http-unhandled-hang`

#### Por que isso é um problema?
Se a Promise do handler rejeita sem `try/catch` e sem catch no `createServer`, headers podem nunca ser enviados e o cliente fica pendurado. Outros handlers do repo já usam catch + 500.

```
// Não conforme
async function handleStatus(req, res) {
  sendJson(res, 200, getStatus()) // getStatus() pode throw
}
```

Envolva o corpo em try/catch (local e/ou no topo do server) e chame `sendError` se `!res.headersSent`.

```
// Conforme
try {
  sendJson(res, 200, getStatus())
} catch (err) {
  console.error('[memory]', err)
  if (!res.headersSent) sendError(res, 500, 'internal_error', '...')
}
```

#### Exceções
Nenhuma para handlers registrados no loopback 5174.

---

<a id="rc-ws-auth-status-collapse"></a>

### Distinga vault_locked (423) de unauthorized (401) no upgrade WS
Esforço: 20 minutos  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `ws-auth-status-collapse`

#### Por que isso é um problema?
O `guard` HTTP emite 423 com cofre travado e 401 com sessão inválida. Colapsar ambos em 401 no WS impede o renderer de redirecionar/tratar lock de forma coerente com o resto da API.

```
// Não conforme
if (vaultService.isLocked() || !tokenOk) {
  socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
}
```

Espelhe a ordem do `guard`: locked → 423; token inválido → 401.

```
// Conforme
if (vaultService.isLocked()) { /* 423 */ return }
if (!tokenOk) { /* 401 */ return }
```

#### Exceções
Nenhuma; mesmo que o cliente WS ignore body, o status HTTP do handshake importa.

---

<a id="rc-ipc-numeric-bounds"></a>

### Números IPC perigosos precisam de faixa finita
Esforço: 20 minutos  
Classificação: Médio  
Stack: `Electron`  
Tipo corrigido: `ipc-numeric-bounds`

#### Por que isso é um problema?
`typeof x === 'number'` aceita `NaN`, `Infinity` e negativos. Dimensões de PTY inválidas quebram o host ou o driver nativo.

```
// Não conforme
if (typeof cols !== 'number' || typeof rows !== 'number') return { ok: false }
```

Exija `Number.isFinite`, inteiro e faixa (ex. 1–500).

```
// Conforme
function validDim(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 500 && Number.isInteger(n)
}
```

#### Exceções
Flags booleanas e enums string não usam esta regra; continuam com narrowing próprio.

---

<a id="rc-error-code-vocabulary-drift"></a>

### Um caso semântico, um error.code
Esforço: 45 minutos  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `error-code-vocabulary-drift`

#### Por que isso é um problema?
O renderer e os testes acoplam-se a `error.code`. Body JSON inválido como `invalid_json` num handler e `invalid_request` noutro quebra contratos e complica agentes/UI.

```
// Não conforme
sendError(res, 400, 'invalid_json', '...')   // skills
sendError(res, 400, 'invalid_request', '...') // rules
```

Padronize o código canônico do repo (`invalid_request` para body/campos inválidos) e alinhe testes.

```
// Conforme
sendError(res, 400, 'invalid_request', 'Corpo inválido.')
```

#### Exceções
Códigos de domínio específicos (`rule_name_conflict`, `vault_corrupted`) permanecem distintos — a regra cobre sinônimos do mesmo caso genérico.

---

<a id="rc-http-body-size-unbounded"></a>

### Limite o tamanho do body no transport compartilhado
Esforço: 30 minutos  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `http-body-size-unbounded`

#### Por que isso é um problema?
`readBody` que concatena o stream inteiro sem teto permite pressão de memória (ex.: base64 enorme), mesmo em loopback.

```
// Não conforme
for await (const chunk of req) chunks.push(chunk)
return Buffer.concat(chunks).toString('utf8')
```

Aborte acima de um teto alinhado aos limites de imagem/composer; responda 413/`payload_too_large`.

```
// Conforme
if (total > MAX_BODY_BYTES) { /* destroy + 413 */ }
```

#### Exceções
Nenhuma no transport compartilhado; rotas que precisem de upload maior devem ter teto explícito e documentado.

---

<a id="rc-partial-destructive-effect"></a>

### Efeito destrutivo em lote: tudo-ou-nada ou compensação
Esforço: 1 hora  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `partial-destructive-effect`

#### Por que isso é um problema?
Marcar itens no DB como rejeitados enquanto `discardFile` ainda pode falhar deixa estado inconsistente (DB diz rejected, arquivo ainda no working tree).

```
// Não conforme
for (const id of ids) {
  discardFile(path)
  markRejected(id) // se o próximo discard falhar, já houve efeito parcial
}
```

Descarte todos os arquivos primeiro; só então persista status — ou use transação/compensação explícita.

```
// Conforme
for (const f of files) discardFile(f)
for (const id of ids) markRejected(id)
```

#### Exceções
Operações idempotentes onde retentar o restante é seguro e o status parcial é documentado na API.

---

<a id="rc-error-message-locale"></a>

### Mensagens de erro ao usuário em PT-BR
Esforço: 5 minutos  
Classificação: Baixo  
Stack: `Node.js`  
Tipo corrigido: `error-message-locale`

#### Por que isso é um problema?
O produto contrato copy em português. Envelope `Not found` em inglês quebra consistência da UI e de `copy.md`.

```
// Não conforme
sendError(res, 404, 'not_found', 'Not found')
```

```
// Conforme
sendError(res, 404, 'not_found', 'Rota não encontrada.')
```

#### Exceções
Logs de console do processo main podem permanecer em inglês. Códigos (`not_found`) permanecem em inglês.

---

<a id="rc-layer-inversion"></a>

### Módulo de domínio não importa handler HTTP
Esforço: 30 minutos  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `layer-inversion`

#### Por que isso é um problema?
Handlers HTTP são a borda do loopback. Um módulo de domínio/runner que importa um handler puxa a fronteira para dentro da lógica de turno (ESM avalia o módulo inteiro) e inverte a direção esperada handler → serviço.

```
// Não conforme
// runner/dispatch.ts
import { DEFAULT_PROMPT } from '../http/config-handler.js'
```

Mova constantes compartilhadas para um módulo neutro de domínio (sem `IncomingMessage`/`ServerResponse`) e importe dos dois lados.

```
// Conforme
// services/config/defaults.ts
export const DEFAULT_PROMPT = '...'

// http/config-handler.ts e runner/dispatch.ts
import { DEFAULT_PROMPT } from '../config/defaults.js'
```

#### Exceções
`import type` de tipos compartilhados colocados de propósito num arquivo de contrato (sem side effects) é aceitável. Import de valor de `*-handler.ts` a partir de runner/db/git não é.

---

<a id="rc-export-should-be-local"></a>

### Não exporte símbolo sem consumidor de produção
Esforço: 10 minutos  
Classificação: Baixo  
Stack: `Node.js`  
Tipo corrigido: `export-should-be-local`

#### Por que isso é um problema?
Export público amplia a superfície da API interna e congela nomes/assinaturas sem necessidade. Se só o próprio módulo (e testes via API pública) usam a função, ela deve ser local.

```
// Não conforme
export function estimateBase64ByteLength(s: string): number { ... }
// só chamada no mesmo arquivo em produção
```

Remova o `export` ou extraia para módulo compartilhado só quando um segundo consumidor de produção existir.

```
// Conforme
function estimateBase64ByteLength(s: string): number { ... }
```

#### Exceções
Export usado apenas por testes irmãos via a API pública do módulo (testando comportamento observável) pode permanecer se a função for parte do contrato documentado. Preferência: testar via função pública que a encapsula.

---

<a id="rc-business-rule-in-tsx"></a>

### Extraia regra de `.tsx` para `*.logic.ts` testável
Esforço: 1–2 horas por tela  
Classificação: Alto  
Stack: `React`  
Tipo corrigido: `business-rule-in-tsx`

#### Por que isso é um problema?
`vitest.config.ts` só inclui `src/**/*.test.ts`. Validação, filtro e formatação vivos no `.tsx` nascem sem cobertura possível e forçam smoke para regressão trivial.

```
// Não conforme — ConfiguracaoScreen.tsx
function validateGithubToken(token: string) { return token.startsWith('ghp_') }
```

Extraia para `*.logic.ts` + `*.logic.test.ts`; o `.tsx` só renderiza e chama.

```
// Conforme — configuracaoScreen.logic.ts
export function validateGithubToken(token: string): boolean { ... }
```

#### Exceções
Wiring puro de evento (`onClick={() => service.save()}`), JSX e composição visual. Formatação one-liner já coberta por lógica compartilhada importada conta como conforme.

---

<a id="rc-missing-sibling-test"></a>

### Módulo que exige teste precisa de `*.test.ts` irmão
Esforço: 1–3 horas por módulo  
Classificação: Alto  
Stack: `Vitest` (cobre testes de Node.js / SQLite / React logic)  
Tipo corrigido: `missing-sibling-test`

#### Por que isso é um problema?
Cobertura só “de fora” (handler exercita repo) deixa gaps em constraints, ordenação e erros do módulo. Regressões locais passam despercebidas.

```
// Não conforme
// messages.ts existe; messages.test.ts não
```

Adicione irmão cobrindo happy path + conflitos/`code` de erro relevantes.

```
// Conforme
// messages.ts + messages.test.ts
```

#### Exceções
Arquivos só de tipos (`provider-types.ts`), wrappers de uma linha já cobertos pelo consumidor com asserção direta, e `main`/`preload` (viram smoke). Infra `client.ts` pode viver via testes de repositório se o schema for exercitado.

---

<a id="rc-vcs-url-redaction"></a>

### Redija todo userinfo HTTPS e prefixo de provider no stderr
Esforço: 45–90 minutos  
Classificação: Crítico  
Stack: `Node.js`  
Tipo corrigido: `incomplete-vcs-url-redaction`

#### Por que isso é um problema?
F24 injeta `oauth2:`, `x-token-auth:` e `https://:<token>@` na URL do `git push`; a falha passa por `stderrTail` → `GitError('git_push_failed', …)` → UI (`GitActions`). Cobrir só `x-access-token:` deixava o segredo dos outros hosts chegar à tela.

```
// Não conforme
.replace(/x-access-token:[^@\s]+@/gi, 'x-access-token:***@')
// oauth2:SECRET@ / x-token-auth:SECRET@ / https://:SECRET@ passam intactos
```

Redija userinfo HTTPS genérico e os prefixos de provider, com um caso de teste por scheme.

```
// Conforme
.replace(/https:\/\/[^/@\s]*:[^*/@\s][^/@\s]*@/gi, 'https://***@')
.replace(/xai-[A-Za-z0-9_-]+/g, 'xai-***')
.replace(/gsk_[A-Za-z0-9_-]+/g, 'gsk_***')
```

Duas sutilezas do código atual que **não** podem ser "simplificadas": o encurtamento de path roda **antes** da redação (senão `***@host/org/repo.git` vira alvo do regex de path e come o marcador), e o primeiro caractere da senha exclui `*` (senão o padrão genérico re-casa o `x-access-token:***@` já redigido e apaga o rótulo).

#### Exceções
Nenhuma para URL autenticada passada a `git` ou stderr que possa chegar à UI. Scheme ou prefixo novo entra no sanitizer **e** no teste no mesmo diff.

---

<a id="rc-shared-validation"></a>

### Uma fonte de verdade para regra de validação compartilhada
Esforço: 1–2 horas  
Classificação: Alto  
Stack: `React`  
Tipo corrigido: `duplicated-client-server-validation`

#### Por que isso é um problema?
Regra de negócio duplicada é 🔴 neste repo. O renderer re-declarava `MIN_KEY_LENGTH`, prefixos e mensagens que já viviam em `provider-keys.ts` / `github-token.ts`; o drift aceita no cliente o que o servidor rejeita (ou o inverso). Precedente do mesmo tipo: `composer.logic.ts` importa constantes de `composer-images.ts`.

```
// Não conforme
// configuracaoScreen.logic.ts — literals espelhados
export function validateGrokKeyLocal(v: string): string | null { ... }
```

Importe a função pura do servidor e adapte só o retorno à UX.

```
// Conforme
import { validateGrokKey } from '../../services/vault/provider-keys.js'
export function validateGrokKeyLocal(v: string): string | null {
  const r = validateGrokKey(v)
  return r.ok ? null : r.message
}
```

O módulo importado precisa ser puro (sem `fs`/`electron`/SQLite) para o renderer poder importar valor sem quebrar o isolamento.

#### Exceções
Validação só-UX que não existe no servidor (ex.: hint de campo vazio) pode ficar local. Formato de key/token que o handler também valida **não**.

---

<a id="rc-cors-methods-allowlist-gap"></a>

### CORS `Access-Control-Allow-Methods` cobre todo método usado por algum handler
Esforço: 15 minutos  
Classificação: Alto (achado ao vivo — quebra funcionalidade real, não só teste)  
Stack: `Node.js` · Tipo: `cors-methods-allowlist-gap`

#### Por que isso é um problema?
`applyCors` em `unlock-handler.ts` hardcodava `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS` — sem `PATCH`, o único método usado por `memory-handler.ts` (toggle da Memória, F20). Como a Electron renderer window é um contexto de browser sujeito a preflight CORS igual a qualquer `fetch`, isso quebrava o toggle em produção, não só em teste — achado ao vivo no smoke de F20 (`docs/F20-memoria-persistente/smoke-results.md`).

```
// Não conforme
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
// memory-handler.ts usa PATCH /api/projects/:id/memory/status → preflight falha no browser real
```

Liste todo método HTTP que qualquer handler roteado por `createUnlockServer` realmente usa.

```
// Conforme
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
```

#### Exceções
Nenhuma. Ao adicionar um handler novo com método HTTP ainda não presente no allowlist (ex.: um futuro `PATCH`/`PUT` adicional), atualizar `applyCors` no mesmo diff — o preflight só existe se o browser vir um método fora do allowlist, então testes que chamam o handler direto (sem preflight real) não pegam essa classe de bug; precisa de teste de preflight (`OPTIONS` + `Access-Control-Allow-Methods`) como o adicionado em `unlock-handler.test.ts`.

---

<a id="rc-http-status-code-collision"></a>

### Status HTTP reservado (401/423 = sessão do vault) não pode ser reusado por outro domínio de erro
Esforço: 20 minutos  
Classificação: Crítico (achado ao vivo — derruba a sessão do usuário)  
Stack: `Node.js` · Tipo: `http-status-code-collision`

#### Por que isso é um problema?
`api-client.ts` (`apiRequest`, compartilhado por **todos** os `*-service.ts` do renderer) trata `res.status === 401` (ou `423`) como "sessão do EngrenaCode inválida" e chama `window.electronAPI.vault.lock()` — um relock real do vault, não só um redirect de UI. `voice-handler.ts` respondia `401` para `voice_auth_error` (key de OpenAI/Groq rejeitada pelo *provider*, nada a ver com a sessão do EngrenaCode). Resultado: uma key de terceiro errada derrubava a sessão inteira do app — achado ao vivo no smoke de F27 ao testar o fluxo de erro de transcrição (`docs/F27-ditado-por-voz/smoke-results.md`).

```
// Não conforme
// voice-handler.ts
const status = err.code === 'voice_key_missing' ? 400 : err.code === 'voice_auth_error' ? 401 : 502
// api-client.ts trata QUALQUER 401 (de qualquer endpoint) como sessão inválida → relock real
```

Reserve `401`/`423` exclusivamente para "sessão/token do EngrenaCode inválido" ou "vault travado" em qualquer handler novo; erros de credencial de provider terceiro usam outro status (ex.: `422`).

```
// Conforme
const status = err.code === 'voice_key_missing' ? 400 : err.code === 'voice_auth_error' ? 422 : 502
```

#### Exceções
Nenhuma dentro de `createUnlockServer` — `401`/`423` são vocabulário reservado app-wide (mesmo espírito de [RC-guard-423](#rc-guard-423)). Ao mapear erro de provider externo (GLM/Grok/OpenAI/Groq/Minimax) para HTTP, nunca usar `401`/`423`; siga o precedente de `handleGlmTest`/`handleGrokTest` (200 com `success:false` no corpo) quando o endpoint for um "test connection", ou um 4xx não reservado (`422`) quando for uma ação que pode falhar por credencial (como `voice/transcribe`).

---

<a id="rc-missing-smoke-evidence"></a>

### Critério de UI Feito exige `smoke-results.md`
Esforço: 1–2 horas por feature (smoke real)  
Classificação: fechado — era Alto/Médio  
Stack: `Vitest` · Tipo: `missing-smoke-evidence`

#### Por que isso é um problema?
PROGRESS/PRD `[x]` sem artefato de smoke torna o fechamento não auditável. Critérios "usuário vê/clica/toggle/dock" dependem de DOM — unitário não basta (`CLAUDE.md` TESTE). **D07 fechado por completo em 2026-08-09** (2 sessões): F20/F21/F23/F26/F27 primeiro (C33), depois F04/F05/F08/F10/F14/F16/F17 (C36). Todas as 12 features com UI Feito têm `docs/F<ID>-*/smoke-results.md` agora — F01, F02, F03, F04, F05, F06, F07, F08, F09, F10, F11, F12, F13, F14, F15, F16, F17, F18, F20, F21, F22, F23, F24, F25, F26, F27. F19 segue exempto (smoke "opcional" declarado na própria spec).

```
// Não conforme
// docs/F26-*/ sem smoke-results.md; PROGRESS diz Feito com UI
```

Rode smoke via `playwright-cli` + Electron real e grave `docs/F<ID>-*/smoke-results.md` com o que foi exercitado. Se já existir narrativa real detalhada em `PROGRESS.md` de uma sessão anterior (não é o caso comum — a maioria das features não tem essa narrativa), formalizar no arquivo dedicado citando a proveniência é aceitável; não é preciso reexecutar o smoke ao vivo só para gerar o arquivo quando a evidência real já existe em outro lugar do repo.

```
// Conforme
// docs/F26-terminal-pty-dock/smoke-results.md com passos light/dark e copy
```

#### Exceções
Features só de vault/crypto/API sem superfície UI; features ainda `Pendente` no PROGRESS. Smoke "opcional" declarado na spec (ex.: F19) não bloqueia se o AC de UI não estiver `[x]` sem evidência. Feature nova: escreva o smoke antes de marcar `[x]` — não deixe a dívida se acumular de novo.

---

<a id="rc-harness-count-stale-after-modal-close"></a>

### Contador derivado de um vínculo N:N some/atrasa se o `useEffect` só reage à entidade pai
Esforço: 20 minutos  
Classificação: Médio (achado ao vivo — dado certo no servidor, errado na tela)  
Stack: `React` · Tipo: `harness-count-stale-after-modal-close`

#### Por que isso é um problema?
`WorkspaceSidebar.tsx` buscava as 4 contagens do Repo Harness (Rules/Skills/SubAgents/MCPs) num `useEffect` disparado só por `[project]`. Os 4 modais de vínculo (`ProjectRulesModal`/`ProjectSkillsModal`/`ProjectSubagentsModal`/`ProjectMcpsModal`) só chamavam `setOpenModal(null)` no `onClose`, nunca refazendo a busca — o card do harness ficava com a contagem antiga (ex.: "0 vinculados" depois de vincular 1) até o usuário reselecionar o projeto (remount). O dado estava correto no servidor o tempo todo (confirmado via `GET /api/projects/:id/skills` direto) — só a tela não refletia, achado ao vivo no smoke de F05 (`docs/F05-skills/smoke-results.md`).

```
// Não conforme
useEffect(() => {
  if (!project) { /* reset */ return }
  skillsService.listForProject(project.id).then(...)
  // ...outras 3 fetches
}, [project])
// ...
<ProjectSkillsModal projectId={project.id} onClose={() => setOpenModal(null)} />
```

Extraia a busca para uma função reutilizável e chame-a tanto na troca de entidade pai quanto no `onClose` de qualquer modal que possa ter mudado o vínculo.

```
// Conforme
const refreshHarnessCounts = useCallback((projectId: string) => { /* as 4 fetches */ }, [])
useEffect(() => {
  if (!project) { /* reset */ return }
  refreshHarnessCounts(project.id)
}, [project, refreshHarnessCounts])
// ...
<ProjectSkillsModal
  projectId={project.id}
  onClose={() => { setOpenModal(null); refreshHarnessCounts(project.id) }}
/>
```

#### Exceções
Nenhuma quando o modal pode alterar o dado que alimenta o contador. Se o modal for só leitura (nunca muta vínculo), o refresh no `onClose` é desnecessário — mas os 4 modais deste harness (Rules/Skills/SubAgents/MCPs) sempre podem mutar.

---

<a id="rc-skills-json-outside-sqlite"></a>

### Persistência de catálogo alinhada ao store do domínio
Esforço: 4–8 horas  
Classificação: fechado — era Médio  
Stack: `SQLite` · Tipo: `skills-json-outside-sqlite`

#### Por que isso é um problema?
`repositories/skills.ts` vivia sob `db/` mas gravava `skills.json` via `fs` + `app` do Electron, sem migration/tabela — skills era a única exceção operacional (backup, lock, query) entre os peers (rules/subagents/mcps), todos já SQLite.

```
// Não conforme
// path join(userData, 'skills.json') + writeFileSync
```

Migration `012_skills` (`skills` + `project_skills`, `ON DELETE CASCADE`) + repositório reescrito como funções de módulo sobre `getDb()` (não uma classe/singleton — `RC-module-repo` já pedia isso pra todo repositório sob `db/repositories/`). Migração do JSON legado é automática e transparente: na primeira query de cada processo, se `skills.json` existir e a tabela `skills` estiver vazia, os dados são importados e o arquivo renomeado para `skills.json.migrated` (idempotente — reimport não acontece de novo, mesmo que o usuário volte a deletar todos os skills depois).

```
// Conforme
// migrations/012_skills.ts: CREATE TABLE skills (...); CREATE TABLE project_skills (...)
// repositories/skills.ts: export function listSkills() { return getDb().prepare(...).all() }
```

#### Exceções
Nenhuma. Ao tocar `skills.ts` de novo, use as funções de módulo (`listSkills`/`createSkill`/`updateSkill`/`deleteSkill`/`getSkillCounts`/`listProjectSkills`/`linkSkill`/`unlinkSkill`/`reorderProjectSkills`/`resolveSkillsForProject`) — não reintroduza uma classe/objeto agregador. Teste que precisa espiar uma função exportada (`vi.spyOn`) importa o módulo como namespace (`import * as skillsRepo from '...'`), não destructura — precedente em `apply-catalog.test.ts`/`unlock-handler.test.ts`.

---

<a id="rc-dead-export"></a>

### Não exporte símbolo sem consumidor de produção
Esforço: 10–20 minutos  
Classificação: fechado — era Baixo  
Stack: `Node.js` · Tipo: `dead-export`

#### Por que isso é um problema?
API interna inflada. `injectTokenIntoHttpsUrl` ficou órfã após F24 (`ByKind`); `getTokens` só era chamado no próprio `vcs/oauth.ts`.

```
// Não conforme
export function injectTokenIntoHttpsUrl(...) { ... } // só teste
```

```
// Conforme
function injectTokenIntoHttpsUrl(...) { ... } // módulo-local, ByKind delega
function getTokens(...) { ... } // módulo-local
```

#### Exceções
Export usado só por teste irmão via API pública documentada — preferível testar via função que a encapsula.

---

<a id="rc-error-message-locale-residual"></a>

### Messages de erro HTTP voltadas ao usuário em PT-BR
Esforço: 5 minutos  
Classificação: fechado — era Baixo  
Stack: `Node.js` · Tipo: `error-message-locale-residual`

#### Por que isso é um problema?
C26 fechou o 404 do unlock; residual: `cors_denied` respondia `Origin not allowed.`. Contrato do produto: message acionável em PT-BR.

```
// Não conforme
message: 'Origin not allowed.'
```

```
// Conforme
message: 'Origem não permitida.'
```

#### Exceções
Logs internos / `console.error` podem permanecer em inglês.

---

<a id="rc-ws-query-token-legacy"></a>

### Autenticação WS sem token na query string
Esforço: 30–60 minutos  
Classificação: fechado — era Médio  
Stack: `Node.js` · Tipo: `ws-query-token-legacy`

#### Por que isso é um problema?
Cliente usa subprotocol; `?token=` na query pode vazar em logs de proxy/histórico de URL.

```
// Não conforme
const token = url.searchParams.get('token') ?? subprotocol
```

```
// Conforme
// só Sec-WebSocket-Protocol / subprotocol nomeado
```

#### Exceções
Nenhuma — não reintroduza o fallback de query.

---

<a id="rc-http-body-narrowing-gap"></a>

### Narrowing de body no handler antes do repositório
Esforço: 30–60 minutos  
Classificação: fechado — era Médio  
Stack: `Node.js` · Tipo: `http-body-narrowing-gap`

#### Por que isso é um problema?
C18 endureceu skills/rules/config; `subagents-handler` fazia `createSubagent(data as SubagentInput)` sem checar `model`/`reasoningLevel`/`category`/`tools`/`enabled` antes do cast — tipo errado não virava 400 e podia derrubar o bind do SQLite.

```
// Não conforme
const subagent = createSubagent(data as SubagentInput) // sem narrowing de model/reasoningLevel/category/tools/enabled
```

```
// Conforme
const invalidField = invalidSubagentInputField(data) // typeof/enum antes do cast
if (invalidField !== null) return sendError(res, 400, 'invalid_request', ...)
const subagent = createSubagent(data as SubagentInput)
```

#### Exceções
Nenhuma em rota que aceita JSON do renderer.

---

<a id="rc-pty-env-inheritance"></a>

### PTY com allowlist mínima de env
Esforço: 1–2 horas  
Classificação: fechado — era Médio  
Stack: `Electron` · Tipo: `pty-env-inheritance`

#### Por que isso é um problema?
Herdar `process.env` inteiro podia expor keys de provider / tokens do host ao shell do terminal dock (F26).

```
// Não conforme
spawn(shell, [], { env: process.env })
```

```
// Conforme
env: buildPtyEnv(process.env) // allowlist (PATH, HOME, USERPROFILE, TERM, locale, COMSPEC no Windows)
```

#### Exceções
Var explicitamente necessária ao shell do usuário e sem segredo — documentar na allowlist.

---

<a id="rc-missing-sibling-coverage"></a>

### Módulos de lógica com teste irmão (ou justificativa)
Esforço: 1–3 horas por módulo  
Classificação: fechado — era Médio/Alto  
Stack: `Vitest` · Tipo: `missing-sibling-coverage`

#### Por que isso é um problema?
Cobertura só indireta (via dispatch/handler) deixa regressões locais passar sem um teste apontando pro módulo certo. Fechado em duas rodadas: `codegraph/ensure|query` + registries do runner (`mcp-registry`/`rule-registry`/`thread-cwd`/`turn-control`) em `730c552`; `vcs/oauth-config.ts`/`mcps/catalog.ts`/`config/defaults.ts` nesta sessão.

```
// Não conforme
// config/defaults.ts exporta valor default consumido por dispatch.ts; defaults.test.ts ausente
```

```
// Conforme
// config/defaults.ts + config/defaults.test.ts
```

#### Exceções
Arquivos só de tipos; catálogos estáticos cobertos por handler com asserção de shape; wrappers de uma linha já assertados no consumidor.

---

<a id="rc-spawn-failed-unsanitized"></a>

### Spawn failed sem sanitize
Esforço: baixo  
Classificação: Crítico  
Stack: `Node.js`  
Tipo corrigido: `spawn-failed-unsanitized`

#### Por que isso é um problema?
`provider_spawn_failed` interpolava `err.message` cru (paths/tokens) enquanto o caminho `close` já usava `sanitizeProcessError`.

```
// Não conforme
reject(new ProviderError('provider_spawn_failed', `…: ${err.message}`))
```

```
// Conforme
reject(new ProviderError('provider_spawn_failed', sanitizeProcessError(`…: ${err.message}`)))
```

#### Exceções
Nenhuma para mensagem que chega à UI.

---

<a id="rc-silent-catch-regression"></a>

### Catch vazio em fetch (regressão)
Esforço: baixo  
Classificação: Crítico / Médio  
Stack: `React`  
Tipo corrigido: `silent-catch-regression`

#### Por que isso é um problema?
`.catch(() => {})` regrediu após C07: contagens/presets stale sem `role="alert"`.

```
// Não conforme
rulesService.counts().then(/*…*/).catch(() => {})
```

```
// Conforme
.catch((err) => {
  if (err instanceof DOMException && err.name === 'AbortError') return
  console.error('harness counts failed', err)
  setHarnessError('Não foi possível atualizar os vínculos.')
})
```

#### Exceções
Abort/unmount deliberado.

---

<a id="rc-unlock-body-unbounded"></a>

### Unlock sem teto de body
Esforço: baixo  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `unlock-body-unbounded`

#### Por que isso é um problema?
Unlock público concatenava chunks sem `MAX_BODY_BYTES` → DoS local.

```
// Conforme
body = await readBody(req) // 413 payload_too_large via sendTransportError
```

#### Exceções
Nenhuma.

---

<a id="rc-cli-env-inheritance"></a>

### CLI herda process.env inteiro
Esforço: médio  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `cli-env-inheritance`

#### Por que isso é um problema?
`{ ...process.env }` no spawn CLI vazava secrets do host; PTY já usava allowlist.

```
// Conforme
const env = buildPtyEnv(process.env)
if (envVar && input.apiKey) env[envVar] = input.apiKey
```

#### Exceções
Vars estritamente necessárias ao binário, documentadas.

---

<a id="rc-spawn-cleanup-gap"></a>

### Cleanup de permission settings no catch de spawn
Esforço: baixo  
Classificação: Médio  
Stack: `Node.js`  
Tipo corrigido: `spawn-cleanup-gap`

#### Por que isso é um problema?
Catch síncrono limpava mcp-config/temp images mas deixava `--settings` no disco.

```
// Conforme
} catch (err) {
  cleanupMcpConfig()
  cleanupPermissionSettings()
  cleanupTempImages()
  …
}
```

#### Exceções
Nenhuma quando o arquivo foi criado neste turno.

---

<a id="rc-missing-link-body-regression"></a>

### Falta regressão PUT link skills/rules
Esforço: baixo  
Classificação: Médio  
Stack: `Vitest`  
Tipo corrigido: `missing-link-body-regression`

#### Por que isso é um problema?
Narrowing em produção sem `it` 400 → regressão silenciosa.

#### Exceções
Nenhuma quando o narrowing já existe no handler.

---

<a id="rc-flaky-process-timeout"></a>

### Timeout flaky em teste com processo real
Esforço: baixo  
Classificação: Médio  
Stack: `Vitest`  
Tipo corrigido: `flaky-process-timeout`

#### Por que isso é um problema?
Git/spawn real sob default 5s falha sob carga sem ser regressão de produto.

```
// Conforme
it('test_parallel_two_children_disjoint_paths', async () => { … }, 30_000)
```

#### Exceções
Falha determinística nas duas execuções = bug de produto.

---

<a id="rc-stream-json-content-narrow"></a>

### Narrow seguro do `content` no stream-json
Esforço: baixo  
Classificação: fechado — era Crítico  
Stack: `Node.js` · Tipo: `stream-json-content-narrow`

#### Por que isso é um problema?
Payload do CLI é não confiável. Cast `as ContentBlock[]` + leitura de `block.type` num elemento `null`/primitivo lança, e o parse rodava fora do `try/catch` da linha em `cli-driver` — um item lixo no `content` derrubava o turno inteiro.

```ts
// Não conforme
const content = (Array.isArray(message?.content) ? message.content : []) as ContentBlock[]
for (const block of content) {
  if (block.type === 'tool_use' && …) { … }
}
```

```ts
// Conforme
const raw = Array.isArray(message?.content) ? message.content : []
for (const block of raw) {
  if (!isRecord(block)) continue
  if (block.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string') { … }
}
```

Duas coisas que **não** podem ser desfeitas junto com isso: o loop de parse/dispatch em `rl.on('line')` tem `try/catch` **próprio**, separado do `try` de baixo (lá `catch` significa "linha não é JSON de nível superior"; fundir perde o sinal de falha real), e esse catch **nunca loga a linha crua**, porque ela pode carregar `tool_input` com command/segredo. O erro sai por `sanitizeProcessError`.

#### Exceções
Nenhuma no caminho do `rl.on('line')`. Bloco novo no `content` entra com narrow por campo, não com cast.

---

<a id="rc-permission-thread-binding"></a>

### Binding `requestId` ↔ `threadId` na resolução de permissão
Esforço: baixo  
Classificação: fechado — era Alto  
Stack: `Node.js` · Tipo: `permission-thread-binding`

#### Por que isso é um problema?
`POST /api/threads/:threadId/permission` resolvia só por `requestId` global. Um request de outra thread com o path errado liberava a tool e emitia `permission.resolved` na thread da URL.

```ts
// Não conforme
const resolved = resolvePermissionRequest(data.requestId, data.allow, …)
emit(threadId, { type: 'permission.resolved', … })
```

```ts
// Conforme
const resolved = resolvePermissionRequest(threadId, data.requestId, data.allow, …)
// { ok: false, code: 'thread_mismatch' } → 409 permission_thread_mismatch
```

A validação de `entry.threadId` roda **antes** de consumir a entrada pendente; checar depois já teria destruído o pedido da thread legítima.

#### Exceções
Nenhuma em multi-thread.

---

<a id="rc-broker-body-unbounded"></a>

### Body do broker de permissão com teto fail-closed
Esforço: baixo  
Classificação: fechado — era Médio  
Stack: `Node.js` · Tipo: `broker-body-unbounded`  
Afim de [RC-http-body-size-unbounded](#rc-http-body-size-unbounded) (superfície efêmera do hook, não `_transport`).

#### Por que isso é um problema?
`POST /permission` do broker fazia `body += chunk` sem cap; `toolInput` grande, somado a replay WS e `GET …/permissions`, pressiona a memória do processo main.

```ts
// Conforme
if (bodyBytes > PERMISSION_BODY_MAX_BYTES) {   // 1 MiB, em buffer-cap.ts
  overCap = true
  /* 413 + req.destroy() */
}
// on('end') retorna cedo se overCap — nenhum pending é criado
```

Fail-closed é a parte que importa: no estouro **não** nasce entrada pendente. Um pending criado a partir de body truncado viraria um pedido de permissão sem params confiáveis na tela.

#### Exceções
Nenhuma com params persistidos na fila.

---

<a id="rc-hook-http-status-check"></a>

### Hook de permissão checa status HTTP antes de parsear
Esforço: baixo  
Classificação: fechado — era Baixo  
Stack: `Node.js` · Tipo: `hook-http-status-check`

#### Por que isso é um problema?
`await res.json()` sem `res.ok` transforma 403/404/413 (ou HTML) em erro de parse opaco. O fail-closed existia via `allow !== true`, mas a reason que chegava ao modelo era inútil para diagnóstico.

```js
// Conforme — dentro de SCRIPT_SOURCE
if (!res.ok) {
  return decide(false, 'broker respondeu ' + res.status)
}
```

#### Exceções
Nenhuma no `SCRIPT_SOURCE` do hook (vale para os dois grupos, `PreToolUse` e `PermissionRequest`).

---

<a id="rc-native-denial-ui-gap"></a>

### Negação nativa do CLI precisa de superfície na UI
Esforço: baixo  
Classificação: fechado — era Médio  
Stack: `React` · Tipo: `native-denial-ui-gap`

#### Por que isso é um problema?
O runner emitia `permission.native_denial` no wire e o hook do workspace tipava o evento sem renderizar nada. A tool morria sem modal e sem aviso: da tela, parecia que o agente simplesmente parou.

```ts
// Conforme — streamNotices.logic.ts
export type WorkspaceNotice =
  | { kind: 'mcp'; … }
  | { kind: 'native_denial'; toolName: string; code: string; message: string }
export const MAX_WORKSPACE_NOTICES = 20
```

O teto veio junto de propósito: a lista de avisos crescia sem limite numa thread longa.

#### Exceções
Nenhuma enquanto o evento continuar no wire. Evento novo de negação entra com aviso PT-BR nomeando a tool, não com o `code` cru.

---

<a id="rc-non-null-assertion-mask"></a>

### Non-null assertion mascara ausência em wiring de gate
Esforço: baixo  
Classificação: fechado — era Médio  
Stack: `TypeScript` · Tipo: `non-null-assertion-mask`

#### Por que isso é um problema?
`pendingPermission!` escondia a race em que o snapshot já sumiu; virava runtime error opaco em vez de early-return. Pior: sem a permissão, o fluxo caía nos branches de baixo em silêncio e o texto do usuário virava turno novo, e o agente então repetia o pedido em prosa.

```ts
// Conforme
const recovered = /* … */
if (!recovered) {
  /* early-return com erro visível na UI, nunca cair para enqueue/send */
}
```

#### Exceções
Nenhuma em wiring de grant de permissão.

---

<a id="rc-permission-mode-constant-drift"></a>

### Modo supervisionado vem da constante, não do literal
Esforço: baixo  
Classificação: fechado — era Médio  
Stack: `Node.js` · Tipo: `permission-mode-constant-drift`

#### Por que isso é um problema?
Contrato e spawn divergiam: `permission-contract.ts` checava `SUPERVISED_PERMISSION_MODE` enquanto `permissionModeFlag` devolvia `'auto'` hardcoded. Um rename futuro quebraria só um lado, e o lado quebrado é o que decide se o hook tem autoridade real de allow/deny.

```ts
// Não conforme
function permissionModeFlag(): string { return 'auto' }
```

```ts
// Conforme
if (hasPermissionHook) return SUPERVISED_PERMISSION_MODE
```

#### Exceções
Nenhuma no caminho supervised. Os outros retornos (`bypassPermissions`, `acceptEdits`, `manual`) são modos distintos do CLI, não sinônimos dessa constante.

---

## 5. Fora de escopo / dívida consciente

| Item | Estado 2026-08-13 |
|------|-------------------|
| C01–C57 | Permanecem válidos; esta passagem **não** revalidou full-base `src/` — só o lote uncommitted |
| `copy.md` F03 ainda fala “modal” | **Resolvido em 2026-08-13** — `copy.md` alinhado ao `ui.md` (card inline, clique preenche composer, Enviar concede) |
| Lote uncommitted ~50 arquivos / 5 sprints + correções C58–C69 | Dívida de fatiamento Conventional Commits (abaixo); não bloqueia por si só |
| F19 smoke “opcional” | Mantido (igual 2026-08-10) |
| PRD cross-feature F18 `[ ]` | Docs de produto — só sync se o usuário pedir |
| Polling Dashboard / OAuth pending vs hub WS | Justificado |
| PTY via IPC nomeado (F26) / `listen(0)` por turno | Por design |
| Gates `tsc -b` + suíte Vitest | **Executados em 2026-08-13**: `tsc -b` exit 0; `pnpm test` 1500/151 verdes. `biome` / `vite` / `electron-builder` seguem não executados |
| Smoke Electron ao vivo de F03 | **Executado em 2026-08-13** contra `claude` 2.1.231 — primeira validação nessa versão (contrato estava registrado contra 2.1.226/2.1.228). Resta o Cancel foreground |
| Suíte flaky sob carga | Ainda rode `pnpm test` duas vezes antes de chamar regressão |
| `.claude/agents/sprint-*` untracked | Fora do escopo `src/` desta auditoria |

### Fatiamento sugerido (remediação do uncommitted)

Ordem: 🔴 segurança/parse → 🔴 UX testável → 🔴 testes irmãos → 🟡 binding/broker → 🟡 hygiene/exports → docs/smoke. As correções de 2026-08-13 estão na branch `fix/f03-audit-close` **sem commit**; o fatiamento abaixo continua sendo a divisão sugerida na hora de commitar.

1. `fix(F03): narrow stream-json content blocks` — R01 + D05 (C58 + C59) ✅ código pronto
2. `fix(F03): extract composer/followups logic` — D01 + D02 (C60) ✅ código pronto
3. `test(F03): waiting_permission busy + runtime-metrics` — D03 + D04 + A01 (C59 + C61) ✅ código pronto
4. `fix(F03): bind permission resolve to threadId` — R02 (C62) ✅ código pronto
5. `fix(F03): broker body cap + hook status` — R04 + R06 (C63 + C64) ✅ código pronto
6. `fix(F03): native denial UI + drop non-null` — R03 + R05 (C65 + C66) ✅ código pronto
7. `refactor(F03): shared SUPERVISED_PERMISSION_MODE + local exports` — A03 + A04 + `stableJson` do A05 (C67–C69) ✅ código pronto. **A02 e `hasInflight` ficam de fora deste commit** — deferidos (§2)
8. `test(F03): permissions 401/423 + graph waiting_permission` — D06 + D07 (C59) ✅ código pronto
9. `docs(F03): smoke Cancel/export + copy inline` — `copy.md` sincronizado ✅; smoke ao vivo executado ✅; **resta Cancel foreground**
11. `fix(F03): copy da negacao nativa` — R08, achado novo do smoke. A copy precisa separar "CLI negou sem consultar o broker" de "broker concedeu e outro hook negou", e propagar o `systemMessage` do hook
10. `fix(F03): turnProcessCount semantics` — R07, achado novo. Commit próprio, porque exige mudar call site, setter e o teste que trava o comportamento atual de uma vez

---

## 6. Como atualizar este artefato

Use [`.claude/skills/audit-full-base/SKILL.md`](../.claude/skills/audit-full-base/SKILL.md): 3 reviews em sequência, preserve esta seção de remediação (texto canônico em [`.claude/skills/audit-full-base/references/remediation.md`](../.claude/skills/audit-full-base/references/remediation.md)), sincronize `coding-*/project.md`, mova Abertos→Corrigidos com evidência, atualize contagens/data. Agente de **fix** segue o protocolo desta seção; não invente outro fluxo.

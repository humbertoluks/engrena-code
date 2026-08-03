---
name: spec-writer
description: Gera especificação técnica de implementação e plano para uma ou mais features com base no PRD, análise do codebase e esclarecimento iterativo. Suporta modo lote para gerar múltiplas features da mesma onda em paralelo. Adaptado ao EngrenaCode — integra docs/PRD.md existente e trata ui.md/copy.md por feature como fonte de verdade de UX/copy.
---

# Feature Specs Writer

Gera especificações técnicas prontas para implementação com base no PRD do projeto e padrões existentes do codebase. A skill tem dois modos:

- **Modo de single-feature (padrão):** opera em uma feature por vez, identificada por seu ID de feature do PRD (F01, F02...), com entrevista interativa (Passos 1–6 abaixo).
- **Modo Lote:** opera em múltiplas features da mesma onda via **Two-phase batch** (Research 1× → N writers), auto-aceitando recomendações. Ativado automaticamente quando a entrada contém múltiplos IDs, referência a onda, ou uma mistura. Veja a seção **Modo Lote** perto do final deste arquivo.

**Saída:** DOIS arquivos são necessários:
1. `spec.md` - Especificação técnica (7 seções)
2. `plan.md` - Plano de implementação (fases e passos)

**Localização da saída:** `docs/<feature-id>-<kebab-name>/spec.md` e `docs/<feature-id>-<kebab-name>/plan.md`
- O `<kebab-name>` é derivado do nome da feature na Seção 6 do PRD (minúsculas, espaços → hífens, caracteres especiais removidos). Exemplo: `F03. Video Upload` → `docs/F03-video-upload/`.

## Adaptação ao EngrenaCode

- `docs/PRD.md` já existe neste repositório (PT-BR, 9 seções, features F01–F11). Use-o diretamente como o PRD — não pergunte onde encontrá-lo.
- Cada feature pasta (`docs/F<ID>-<kebab-name>/`) pode conter, além de `spec.md`/`plan.md`: `ui.md` (anatomia, tokens, aceite visual) e `copy.md` (catálogo de strings literais por id). Esses dois arquivos são escritos por um processo de design separado (ver `CLAUDE.md` → "Design · Processo") e, quando presentes, são a **fonte de verdade** para qualquer UX/copy que a spec descreva. A skill nunca redefine anatomia ou strings já documentadas ali — só cita os caminhos.
- Ao trabalhar em uma feature com UI: antes do Passo 2 (Entrevista), verifique se `docs/<feature-id>-*/ui.md` e `copy.md` já existem.
  - Se existirem, leia-os por completo e trate seu conteúdo (anatomia, tokens, tabela de copy, aceite visual) como respondido — não pergunte sobre isso na entrevista, referencie os ids de copy e a anatomia diretamente na spec.
  - Se não existirem, anote a lacuna em Assumptions/Decisions ("`ui.md`/`copy.md` ainda não escritos para esta feature") e prossiga com a spec técnica; não invente copy final nem anatomia de tela — descreva o contrato de dados/estado que a UI vai consumir e sinalize que o processo de design de UI é pré-requisito antes da implementação visual.
- Referências de template usadas por esta skill vivem em `references/feature-template.md` e `references/research-brief-template.md`, dentro desta mesma pasta de skill (não em `refrerences/` nem fora de `.claude/skills/spec-writer/`).

---

## Passos de Execução (6 Passos)

Nota: Estes são passos internos de execução do agente. O documento de plano OUTPUT terá 1-5 fases com base na complexidade da feature.

### Passo 1: Resolver Entrada e Pré-Análise

**1.1: Identificar o PRD e a feature-alvo**

Aceite entrada em formato livre do usuário. O usuário pode referenciar a feature por ID (`F03`), por nome (`Video Upload`), por caminho (`docs/PRD.md F03`), ou qualquer combinação. Resolva a referência:

- Localize o arquivo PRD a partir da referência do usuário ou procure por `docs/PRD.md` (neste repositório, é sempre esse — ver "Adaptação ao EngrenaCode"), `PRD.md`, ou locais convencionais similares. Se múltiplos PRDs plausíveis existem, pergunte ao usuário qual usar.
- Identifique a feature-alvo dentro do PRD por ID ou nome.
- Se a entrada for ambígua (ex.: "upload" bate em múltiplas features), confirme com o usuário antes de prosseguir.
- Se a feature referenciada não existir no PRD, liste as features disponíveis da Seção 8 e peça ao usuário para esclarecer.

**PRD é obrigatório.** Se nenhum PRD for encontrado no projeto, pare e instrua o usuário a gerar um primeiro com a skill `prd-writer`. Não recaia em uma entrevista não estruturada.

**1.2: Verificar disponibilidade de dependências e Features de Fundação (greenfield)**

Leia a Seção 8 do PRD (Grafo de Dependências). Para cada feature na coluna `Dependências` da feature-alvo, verifique se ela parece estar implementada no codebase (arquivos fonte existem correspondendo ao escopo da feature — em caso de dúvida, cheque também `docs/PROGRESS.md`, que é a fonte de status real F01–F11 deste repositório). Se alguma dependência não estiver implementada, avise o usuário: "F<X> depende de F<Y> (não implementada ainda). Continuar mesmo assim?" Prossiga apenas se confirmado.

Se o PRD contém uma subseção **Features de Fundação** na Seção 8, aplique estas verificações adicionais com base no estado de implementação de cada feature de Fundação:

- **Detecção de estado de Fundação (o sinal correto de greenfield):** para cada feature listada em Features de Fundação, verifique se ela parece estar implementada no codebase procurando por um ou mais arquivos de saída característicos que a feature deve criar — por exemplo, um arquivo de schema ORM ou de migração para uma Fundação de banco de dados, um módulo de sessão/middleware para uma Fundação de auth, um arquivo de layout/template raiz para uma Fundação de layout, ou qualquer artefato equivalente na stack sendo usada (framework web, serviço backend, app mobile, etc.). NÃO dependa apenas da mera presença de marcadores genéricos de projeto como uma pasta de fonte ou arquivo de package/manifest — qualquer ferramenta de scaffolding (`create-next-app`, `rails new`, `django-admin startproject`, etc.) já cria esses, ainda assim as Features de Fundação do PRD podem não estar implementadas.
  - **Greenfield** = zero Features de Fundação implementadas ainda.
  - **Fundação Parcial** = algumas Features de Fundação implementadas, outras ainda pendentes.
  - **Fundação completa** = toda Feature de Fundação está implementada.
- **Cenário 1 — greenfield + feature-alvo É uma Feature de Fundação:** prossiga sem aviso extra. Este é o caminho esperado para um projeto greenfield.
- **Cenário 2 — greenfield + feature-alvo NÃO está em Features de Fundação:** avise o usuário: "Isto parece ser um projeto greenfield (nenhuma feature de Fundação está implementada ainda). F<alvo> não é uma feature de Fundação. Features de Fundação (F<ID>, ...) configuram a infraestrutura compartilhada e devem ser implementadas primeiro. Recomendo começar com F<primeira-fundacao>. Continuar com F<alvo> mesmo assim?" Prossiga apenas se confirmado.
- **Cenário 3 — Fundação Parcial (algumas features de Fundação implementadas, outras pendentes) e alvo não é uma das Fundações restantes:** liste as features de Fundação pendentes e avise: "Features de Fundação F<ID1>, F<ID2>... não estão implementadas ainda. Implementar F<alvo> antes destas pode criar conflitos de arquivo no scaffolding. Continuar mesmo assim?" Prossiga apenas se confirmado.
- **Fundação completa (codebase maduro para fins de Fundação):** pule todas as verificações específicas de Fundação. A verificação normal de disponibilidade de dependências acima é suficiente. Este é o estado atual do EngrenaCode a partir de F01/F01.1 implementadas.

**Nota de Modo Lote:** Em Modo Lote, o orquestrador executa estas verificações de dependência e Fundação uma vez para todo o lote (B.2 e B.3) e filtra features antes do dispatch. Sub-agentes pulam todos os prompts "avise o usuário / Continuar mesmo assim?" neste passo — presuma que a verificação já foi resolvida pelo orquestrador e prossiga.

**1.3: Descoberta de Padrões do Codebase (duas camadas)**

Explore o codebase antes de escrever a spec (antes da entrevista em modo single-feature; antes de aplicar a Política de Auto-Aceitar em Modo Lote) para extrair padrões. Isto é obrigatório sempre que o codebase não está vazio — não espere o usuário fornecer caminhos.

**Camada 1 — Baseline (piso, não teto):** no mínimo, extraia padrões observáveis nessas categorias. Exemplos são ilustrativos em múltiplas stacks — as categorias são a intenção agnóstica de stack.
- Runtime e linguagem (qualquer — Node, Python, Ruby, Go, Java, .NET, Rust, PHP, etc.)
- Framework e layout do projeto (qualquer — Next.js/Remix, Django/Flask/FastAPI, Rails, Spring, Phoenix, etc.)
- Banco de dados e acesso a dados (qualquer — Postgres/MySQL/Mongo/SQLite; Prisma/SQLAlchemy/ActiveRecord/GORM/Entity Framework; SQL puro)
- Estratégia de autenticação e biblioteca
- Estilo de API ou ponto de entrada (REST, GraphQL, RPC, CLI, fila de jobs, manipulador de eventos — seja o que o projeto usar) e formato de resposta/erro
- Abordagem de validação (schemas tipados, validadores em tempo de execução, verificações manuais — seja o que o codebase prefere)
- Framework de testes e estilo (unitários e integração)
- Tratamento de erros (exceções, tipos Result, códigos de erro, panic/recover, etc.)
- Estrutura de pastas e convenções de nomenclatura

**Camada 2 — Exploração ampla (também obrigatória):** além do baseline, capture qualquer padrão adicional que você observe que pudesse informar a implementação — decisões arquiteturais, idiomas do codebase, abstrações recorrentes, logging/observabilidade, gerenciamento de config, convenções de deploy, internacionalização, acessibilidade, qualquer coisa. Não restrinja a si mesmo à lista de baseline. Um relatório minucioso em um projeto médio típicamente tem 8-15 padrões.

**Nota de Modo Lote (Two-phase):** Em Modo Lote, Camada 1 + Camada 2 amplas rodam **uma vez** no agente Research (B.5a), que grava `docs/_shared/codebase-patterns.md`. Writers **não** reexecutam Camada 2 ampla: leem o brief (read-only) e fazem exploração **delta** só no escopo da feature. Se o brief estiver ausente ou stale (`git_sha` ≠ HEAD, Fundação mudou, ou usuário pediu refresh), o writer **não improvisa** Camada 2 — falha de volta ao orquestrador para regenerar Research. Em single-feature: se um brief fresco já existir, delta-only também é permitido; caso contrário execute 1.3 completo inline.

**1.4: Manipulação de codebase vazio**

Se o codebase estiver vazio ou apenas com scaffolding (ex.: apenas `package.json` com defaults, nenhuma implementação `src/` ainda), pule a descoberta Camada 1/Camada 2 e em vez disso planeje perguntar questões de stack transversais inline durante o Passo 2 (estas questões serão perguntadas apenas uma vez — na primeira feature. Features subsequentes encontrarão as respostas no codebase). No EngrenaCode este caso não se aplica mais — a Fundação (F01/F01.1) já está implementada; use-a como referência de padrões.

**Nota de Modo Lote:** Em Modo Lote não há entrevista do Passo 2. Aplique a linha "Empty codebase bootstrap" da Política de Auto-Aceitar: recaia em melhores práticas da indústria para a stack detectada (ou para o scaffolding que existe, se houver), e documente cada escolha de bootstrap explicitamente sob a seção Assumptions/Decisions da spec.

**1.5: Ler dados da feature do PRD**

Extraia a definição completa da feature-alvo do PRD e carregue como contexto para a spec (usado pela entrevista em modo single-feature, e pela Política de Auto-Aceitar em Modo Lote):
- Nome e ID da feature
- Bloco Consome (se presente)
- Bloco Provê (se presente)
- Bloco Escopo Central (se presente)
- Bloco Adições ao Escopo Completo (se presente)
- Capacidades
- Experiência
- Tratamento de Erros (se presente)
- Seção 9 critérios de aceitação por feature
- Seção 9 critérios de Integração Cross-Feature que referenciam esta feature (como consumidor ou provedor)

**1.5b: Ler UI da feature, quando existir**

Se a feature tem qualquer superfície visual (a Experiência do PRD descreve telas/fluxos de usuário), verifique `docs/<feature-id>-*/ui.md` e `docs/<feature-id>-*/copy.md`:
- Se existirem: leia-os por completo. `ui.md` fornece anatomia, tokens/classes, estados e checklist de aceite visual; `copy.md` fornece o catálogo de strings literais por id. Ambos entram como contexto primário da spec — a spec cita os caminhos e os ids, nunca redescreve o conteúdo.
- Se não existirem: registre a lacuna para a Seção 3.3 (Assumptions) da spec.

**1.6: Apresentar entendimento ao usuário**

```
Com base na minha análise, entendo que você quer implementar:

**Feature:** F<ID>. <Nome>
**Sumário Técnico:** [1-2 frases derivadas de Capacidades + Experiência do PRD]
**Padrões de codebase observados:** [sumário de achados Camada 1 + Camada 2, ou "codebase vazio — será feito bootstrap"]
**UI documentada:** [ui.md + copy.md encontrados e carregados | ui.md/copy.md ainda não existem — spec cobrirá só contrato de dados]
**Contexto PRD carregado:** Consome, Provê, Escopo Central, Escopo Completo, Capacidades, Experiência, Tratamento de Erros, critérios de aceitação
```

Preciso esclarecer algumas decisões técnicas que o PRD e codebase não responderam ainda.
```

**Nota de Modo Lote:** Sub-agentes pulam este passo — não há usuário interativo para apresentar. O plano consolidado do orquestrador (B.4) cobre entendimento compartilhado para o lote.

### Passo 2: Entrevista

**Sobrescrita de Modo Lote:** Em Modo Lote, este passo inteiro é substituído pela Política de Auto-Aceitar (veja seção Modo Lote). Sub-agentes pulam o Passo 2 e prosseguem diretamente ao Passo 3 com os padrões de Auto-Aceitar aplicados. Toda instrução "pergunte ao usuário" abaixo se torna "aplique o padrão de Auto-Aceitar e documente a escolha nas assumptions da spec".

Entreviste o usuário implacavelmente sobre cada aspecto deste plano até alcançarmos entendimento compartilhado. Caminhe para baixo cada branch da árvore de design, resolvendo dependências entre decisões uma por uma. Para cada pergunta, forneça sua resposta recomendada.

Faça as perguntas uma por vez.

Se uma pergunta puder ser respondida explorando o codebase ou lendo o PRD, explore ou leia em vez de perguntar.

**Pergunta de Escopo (pergunte primeiro, quando aplicável):** Se a feature tem blocos `Escopo Central` e `Adições ao Escopo Completo` no PRD, pergunte: "A spec deve cobrir apenas Escopo Central, ou Central + Adições ao Escopo Completo?". Se apenas um dos blocos está presente, ou nenhum está presente, pule esta pergunta e presuma o escopo completo da feature.

**Regra anti-redundância:** NÃO pergunte sobre nada já observável em:
- Definição da feature no PRD (Consome, Provê, Escopo Central, Capacidades, Experiência, Tratamento de Erros)
- Critérios de aceitação do PRD para esta feature
- Padrões do codebase descobertos no Passo 1.3
- `ui.md`/`copy.md` da feature quando já existem (Passo 1.5b) — anatomia, tokens, estados e strings literais já estão respondidos ali
- Um `spec.md` ou `plan.md` gerado anteriormente para outra feature no mesmo projeto (quando esses existem e são relevantes)

Concentre a entrevista em decisões que o PRD e codebase **não** responderam ainda: arquitetura interna, detalhes de schema de banco de dados (colunas, índices, constraints), assinaturas de endpoint, regras de validação não especificadas em Capacidades, nomenclatura de novos arquivos, escolha entre bibliotecas quando padrões não estão estabelecidos, casos extremos não cobertos por Tratamento de Erros.

**Especificações PRD parciais:** Quando o PRD menciona uma capacidade mas omite um detalhe específico (ex.: "chunked upload" sem tamanho de chunk), pergunte pelo detalhe faltante em vez de presumir um padrão.

**Bootstrap de codebase vazio:** Se o Passo 1.4 sinalizou codebase vazio, pergunte questões de stack transversais inline durante este passo (framework, ORM, auth, estilo de API, validação, testes, tratamento de erros, estrutura de pastas). Uma vez a primeira feature implementada, o codebase se torna a referência para features subsequentes.

### Passo 3: Sumário e Assumptions

Após receber respostas:
- Resuma decisões técnicas tomadas
- Liste assumptions derivadas do PRD, padrões do codebase, e respostas da entrevista
- Anote explicitamente quais blocos PRD informaram quais partes da spec (rastreabilidade)
- Se `ui.md`/`copy.md` não existiam para uma feature com UI (Passo 1.5b), anote isso como assumption/lacuna explícita

**Nota de Modo Lote:** Em Modo Lote não há respostas de entrevista. Trate cada padrão de Auto-Aceitar que foi aplicado como se fosse uma resposta da entrevista — liste sob assumptions, nomeie a linha da política que a produziu, e sinalize para o usuário poder revisar e sobrescrever depois. Rastreabilidade com blocos PRD funciona do mesmo jeito que em modo single-feature.

### Passo 4: Gerar Documentos

**Anuncie:** "Gerando DOIS documentos: SPEC e PLAN..."

**Orientação de escalabilidade por complexidade:**
- trivial: 1-2 fases, 2-4 passos
- simples: 2-3 fases, 5-8 passos
- médio: 3-4 fases, 10-15 passos
- complexo: 4-5 fases, 15-25 passos

Nota: Profundidade do documento SPEC (schemas, índices, migrações) escala com complexidade. Passos do PLAN são sempre alto-nível independentemente de complexidade.

**4.1: Gerar SPEC**:
- Escale seções com base em COMPLEXITY_LEVEL:
  - trivial/simples: Pule API Contracts e Data Model se não aplicável
  - médio/complexo: Todas as 7 seções necessárias
- Escale profundidade dentro de seções com base em complexidade
- Inclua exemplos JSON, migrações SQL, especificações de teste
- **Se FEATURE_CROSS_CUTTING existe:** Inclua preocupações cross-cutting integradas na seção Scope:
  ```
  **Incluído:**
  - Funcionalidade central da feature
  - Integrado de preocupações cross-cutting:
  ```

**Mapeamento PRD → SPEC (aplique consistentemente em todas as specs):**

| Bloco PRD / doc | Destino Spec.md |
|-----------|-----------------|
| Consome | Scope (contratos de entrada) + API Contracts (quando entrada chega via API) |
| Provê | Scope (contratos de saída) + API Contracts (quando saída é exposta via API) |
| Escopo Central | Scope → "Incluído" |
| Adições ao Escopo Completo | Scope → "Adiado" (quando usuário escolheu apenas Central) ou "Incluído" (quando usuário escolheu Central + Completo) |
| Capacidades | Requisitos / Regras de Negócio |
| Experiência | Requisitos / Fluxos de UX |
| Tratamento de Erros | Seção Tratamento de Erros |
| `ui.md` (quando existir) | Visão Geral Técnica (citação do path) + Testing Strategy → smoke de aceite visual |
| `copy.md` (quando existir) | Fluxos de UX (referência a ids de copy, nunca strings recopiadas) |
| Seção 9 critérios de aceitação por feature | Testing Strategy → testes de aceitação |
| Seção 9 Critérios de Integração Cross-Feature (referenciando esta feature) | Testing Strategy → testes de integração |

**4.2: Gerar PLAN**:
- Seção Prerequisites
- Fases com passos numerados (1-3 frases cada, alto-nível)
- Descreva O QUÊ fazer, referencie spec para COMO

Use o seguinte template para gerar os arquivos: `references/feature-template.md`.

**4.3: Fase final obrigatória no PLAN — Validação e fechamento**

`spec.md` detalha COMO testar (arquivos, funções, asserts, smoke). `plan.md` **não** implementa testes passo a passo, mas **deve** terminar com uma fase **Validação e fechamento** que define a ORDEM/gate de saída:

- médio/complexo: fase dedicada (1+ passos)
- trivial/simples: pelo menos 1 passo final de validação

Passo permitido (exemplo): `**N. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + smoke). Confirmar critérios de aceitação do PRD. Features com UI: light/dark e copy vs ui.md/copy.md quando existirem.`

Passo proibido: signatures, asserts, mocks, snippets, nomes de funções de teste no plan.

Se o codebase ainda não tem runner de testes: um passo alto-nível no plan (“Bootstrap do runner de testes do projeto”) + assumption explícita na spec.

**Anuncie:** "Ambos documentos prontos. Prosseguindo para salvar..."

### Passo 5: Validar e Salvar

**Valide antes de salvar:**

Documento SPEC:
- [ ] Seções obrigatórias presentes (todas 7 para médio/complexo, pule API/DB se N/A para trivial/simples)
- [ ] Component overview tem caminhos de arquivo completos
- [ ] API contracts têm exemplos JSON (se incluído)
- [ ] Data model tem tipos de coluna, índices, constraints (se incluído)
- [ ] Testing strategy tem funções de teste específicas (ou assumption + bootstrap do runner se ainda não houver stack de teste)
- [ ] Testing strategy inclui bloco Smoke / Aceitação manual (fluxo feliz + 2–3 erros)
- [ ] Cross-feature: testes de integração presentes, ou marcados *deferred* se a dependência ainda não existe
- [ ] Blocos PRD mapeados corretamente per a tabela PRD → SPEC
- [ ] Consome/Provê do PRD refletidos em Scope ou API Contracts
- [ ] Critérios de Integração Cross-Feature do PRD Seção 9 que referenciam esta feature aparecem como testes de integração (ou deferred)
- [ ] Em Modo Lote: Seção 3.1 cita o brief; 3.3 lista Assumptions Auto-Aceitar; Camada 1 do brief **não** foi recopiada
- [ ] Features com UI: `ui.md`/`copy.md` citados por path (quando existem) e nunca recopiados; lacuna registrada em Assumptions quando não existem

Documento PLAN:
- [ ] Passos numerados através de fases
- [ ] Formato: **N. Componente** - Parágrafo alto-nível (1-3 frases)
- [ ] Passos descrevem O QUÊ, não COMO (spec tem detalhes)
- [ ] Fase final **Validação e fechamento** presente (gate: smoke, aceitação, build/test)
- [ ] Sem estimativas de tempo
- [ ] Features com UI: fechamento menciona light/dark, anatomia vs `ui.md` e copy vs `copy.md` quando esses arquivos existirem

**Salve ambos arquivos em `docs/<feature-id>-<kebab-name>/spec.md` e `docs/<feature-id>-<kebab-name>/plan.md`.** Crie a pasta se não existir. Verifique ambos arquivos com a ferramenta Read.

### Passo 6: Resultado de Saída

Informe o caminho dos arquivos spec e plan, o nível de complexidade da feature, e quantas fases estão no plano. Se a feature tem UI e `ui.md`/`copy.md` ainda não existem, destaque isso como pendência antes de implementar.

---

## Modo Lote

Gera specs para múltiplas features da mesma onda em paralelo, auto-aceitando todas as recomendações da entrevista. Este modo usa **Two-phase batch**: (Phase A) um agente Research produz `docs/_shared/codebase-patterns.md` uma vez; (Phase B) N writers geram spec/plan com exploração delta. O orquestrador resolve entrada, valida, despacha Research depois writers, e relata.

### Ativação

A skill entra em Modo Lote automaticamente quando a entrada corresponde a qualquer uma dessas formas:
- Múltiplos IDs de feature: `F01 F02 F03`
- Referência a onda: `onda 3`
- Mistura dentro da mesma onda: `onda 3 F04`
- Múltiplos nomes de feature, ou nomes misturados com IDs, contanto que todos resolvam para a mesma onda

Entrada single-feature (ex.: `F03`, `Video Upload`) continua usando o fluxo interativo (Passos 1–6).

### Regra same-wave

Todas as features em um lote único devem pertencer à mesma onda (per Seção 8 do PRD).

- Entrada cross-wave (ex.: `onda 3 onda 4`, ou `F04 F05` onde F04 é onda 3 e F05 é onda 4) é rejeitada. Mensagem: "Features de ondas diferentes não podem ser geradas no mesmo lote. Specs de ondas posteriores são mais ricas quando geradas após ondas anteriores serem implementadas, então o codebase tem mais padrões para observar. Execute a onda N primeiro."
- Misturar `onda N` com nomes/IDs de features extras é permitido apenas se toda feature listada pertence à onda N. Qualquer outlier dispara a mesma rejeição.
- Número de onda desconhecido → rejeite, listando ondas disponíveis da Seção 8.
- ID/nome de feature desconhecida → rejeite, listando features disponíveis.

### Fluxo de Orquestração

O Passo 1 (Resolver Entrada e Pré-Análise) é adaptado para o contexto de lote conforme descrito abaixo. Passos 2–6 NÃO são executados pelo orquestrador — eles rodam nos writers (Phase B), um por feature, per a Política de Auto-Aceitar. A Descoberta ampla (1.3 Camada 1+2) roda no Research (B.5a), não em cada writer.

**B.1: Resolver o lote**

- **Localize o PRD** usando regras do Passo 1.1 (`docs/PRD.md` neste repositório). Se nenhum PRD for encontrado, pare e dirija o usuário para `prd-writer`. Se múltiplos PRDs plausíveis existem, pergunte ao usuário qual usar ANTES de continuar — esta é a primeira possível pausa interativa no orquestrador.
- Analise entrada em uma lista de features-alvo (expanda ondas, mescle listas, deduplicat).
- Se o PRD não tem subseção `Ondas de Execução` na Seção 8 e a entrada referencia uma onda (ex.: `onda 3`), rejeite com: "Referências de onda exigem uma subseção 'Ondas de Execução' na Seção 8 do PRD, que este PRD não tem. Use IDs de feature diretamente ou atualize o PRD." Não tente sintetizar ondas.
- Se qualquer nome de feature na entrada for ambíguo (bate múltiplas features no PRD, ex.: "upload" bate F03 e F11), liste os candidatos ao usuário e peça desambiguação ANTES de prosseguir para o resto de B.1. Esta é a segunda possível pausa interativa antes do plano consolidado.
- Se qualquer ID ou nome de feature não existir no PRD, rejeite com a lista de features disponíveis.
- Valide a regra same-wave.
- Para cada alvo, verifique se `docs/<feature-id>-<kebab-name>/spec.md` já existe. Marque tais features como "already has spec". Verifique também se `ui.md`/`copy.md` já existem por feature (usado em B.5a para popular o brief).

**B.2: Classificação Greenfield e Fundação**

Aplique a detecção de estado de Fundação do Passo 1.2 uma vez para todo o lote. Classifique cada feature-alvo como:
- **Fundação, não implementada** → deve rodar sequencialmente (scaffolding compartilhado impede paralelismo).
- **Não-Fundação, ou Fundação já implementada** → elegível para pool paralelo.

**B.3: Disponibilidade de Dependência**

Para cada feature-alvo, verifique suas dependências PRD (Seção 8). Se uma dependência não está implementada E não está ela própria no lote atual, marque a feature como "dependency missing — will abort". Dependências satisfeitas por outras features no mesmo lote são aceitáveis (serão especificadas juntas; ordem de implementação é decisão do usuário).

**B.4: Apresentar plano consolidado e aguardar confirmação**

Mostre o plano e aguarde confirmação explícita. Template padrão:

```
Plano de lote para <entrada>:
- F04 Video Library (Central only) — novo
- F07 Background Processing Pipeline (escopo completo) — já tem spec (pular / regenerar?)
- F12 Administration Panel (escopo completo — sem divisão Central/Completo) — novo

Modo: Two-phase — Research 1x depois paralelo (N writers)   # ou "sequencial (Fundação detectada)" quando aplicável
Estado do codebase: Fundação completa   # ou greenfield / Fundação Parcial
Brief: docs/_shared/codebase-patterns.md (Phase A)
Auto-aceitar: todas as recomendações de spec-writer serão aplicadas
Destino: docs/F04-video-library/, docs/F07-background-processing-pipeline/, docs/F12-administration-panel/

OK para prosseguir? (sim/não)
```

Tag de escopo por feature (escolha o certo per formato PRD):
- `(Central only)` — feature PRD tem blocos `Escopo Central` e `Adições ao Escopo Completo` (Auto-Aceitar escolhe Central).
- `(escopo completo)` — feature PRD tem apenas um dos blocos de escopo, então Central e Completo são iguais.
- `(escopo completo — sem divisão Central/Completo)` — feature PRD não tem nenhum bloco; feature inteira está em escopo.

Tags de status por feature: `novo`, `já tem spec (pular / regenerar?)`, `dependency missing — will abort`, `Fundação, rodará sequencialmente`, `já implementado (Fundação), pulando`.

Prossiga apenas com "sim" explícito. Em "não" ou qualquer resposta negativa/ambígua, aborte limpamente sem dispatch de sub-agentes e sem criar arquivos. Se o usuário quiser mudar o plano, reinvoca a skill com entrada atualizada. Features marcadas "já tem spec" são puladas por padrão; o usuário pode solicitar regeneração na resposta de confirmação (ex.: "sim, regenerar F07").

**B.5a: Research (Phase A) — uma vez**

Antes de qualquer writer:

1. Despache **um** agente Research (não paralelo com writers).
2. Prompt do Research:
   - Path do PRD, lista de features do lote, `foundation_state` de B.2
   - Instrução: executar Passo 1.3 completo (Camada 1 + Camada 2) **uma vez**
   - Preferir docs canônicos do repo e specs `docs/F*/` existentes antes de varredura ampla
   - Resolver conflitos de padrão (mais frequente / mais recente) e fixá-los no brief
   - Escrever `docs/_shared/codebase-patterns.md` seguindo `references/research-brief-template.md`
   - Header obrigatório: wave, generated_at, git_sha, foundation_state, features_in_batch, status=fresh
   - Caps: Camada 2 ≤ 15 bullets; sem colar arquivos inteiros
   - Registrar na seção 5 do brief, por feature, se `ui.md`/`copy.md` já existem
   - Writers nunca escrevem neste arquivo (Research é o único writer)
3. Aguarde o brief válido no disco. Se Research falhar ou o arquivo estiver incompleto/stale: **não** despache writers; reporte e aborte o lote (ou regenere Research se o usuário pedir).
4. Codebase vazio: Research ainda grava o brief com bootstrap/industry defaults (linha Auto-Aceitar Empty codebase).

**B.5: Dispatch de writers (Phase B)**

- **Fase sequencial (Apenas Fundações, quando greenfield ou Fundação Parcial):** dispatch de writers de Fundação um de cada vez, esperando cada um completar antes de iniciar o próximo, na ordem que aparecem na Seção 8 do PRD.
- **Fase paralela:** dispatch de todos os writers restantes em uma única mensagem com múltiplas chamadas de ferramenta Agent, sem cap de concorrência.
- Cada prompt de writer usa o **Writer Contract** abaixo (não “releia SKILL inteira”):

```
Writer Contract — spec-writer Phase B
- Feature ID: F<ID>
- PRD path: <path> (leia só o bloco desta feature + Seção 9 que a referencia)
- Brief path: docs/_shared/codebase-patterns.md (READ-ONLY; autoridade Camada 1/2)
- Template: references/feature-template.md
- UI da feature: se brief seção 5 indica ui.md/copy.md existentes, leia docs/<feature-id>-*/ui.md e copy.md (READ-ONLY; fonte de verdade de UX/copy)
- Auto-Aceitar: [colar política ou path da seção]
- Passos: 1.5 → 1.5b → (pular 1.1/1.2 avisos) → 1.3 delta-only → 3 → 4 → 5 → 6
- 1.3: ler brief; explorar só código do escopo da feature; PROIBIDO Camada 2 ampla
- Se brief ausente/stale: FALHAR (não improvisar); orquestrador regenera Research
- Salvar docs/<feature-id>-<kebab>/spec.md e plan.md
- Spec Seção 3.1 herda brief; 3.3 documenta Assumptions Auto-Aceitar (inclui ui.md/copy.md ausente, se for o caso); NÃO recopiar Camada 1 nem anatomia/copy já documentados
```

Writers compartilham o brief do Research; não executam Descoberta ampla independente.

**B.6: Coletar e Relatar**

Aguarde todos os writers. Reporte resultado consolidado:

```
Lote completo: 3/4 features geradas com sucesso
Brief: docs/_shared/codebase-patterns.md
✓ F04 → docs/F04-video-library/
✓ F07 → docs/F07-background-processing-pipeline/
✓ F12 → docs/F12-administration-panel/
✗ F05 → falhou: <razão>
```

Falhas de writer são isoladas — outros writers continuam. Features falhadas podem ser re-executadas individualmente. Se o Brief falhou na Phase A, nenhum writer foi despachado.

### Política de Auto-Aceitar

Cada sub-agente pula a entrevista interativa (Passo 2) e aplica estes padrões para as decisões que a entrevista teria identificado:

| Decisão | Padrão |
|---|---|
| Escopo (Central vs Central+Completo, quando ambos blocos existem) | Central only |
| Decisões técnicas com recomendação clara de spec-writer | Aplique a recomendação |
| Dependência não implementada ainda (aviso Passo 1.2) | Orquestrador trata em B.3 — sub-agente nunca recebe feature com dependência externa não satisfeita; pule o aviso Passo 1.2 inteiramente |
| Avisos de Fundação Greenfield (Cenários 2/3 Passo 1.2) | Orquestrador trata em B.2 — sub-agente pula esses cenários |
| Feature exige nova tecnologia não presente no codebase | Auto-confirme; documente a nova dependência em decisions/assumptions da spec |
| Múltiplos padrões conflitantes no codebase | Research (B.5a) escolhe o mais frequente (ou mais recente quando empatado) e fixa no brief; writer herda — não reescolhe; cite em Assumptions se relevante para a feature |
| Referência de feature ambígua | Não pode ocorrer — orquestrador pede ao usuário desambiguar em B.1 antes do dispatch |
| Bootstrap de codebase vazio (Passo 1.4) | Research grava defaults no brief; writer herda e documenta assumptions explicitamente |
| Especificações PRD parciais (Passo 2 — capacidade mencionada mas detalhe técnico omitido, ex.: "chunked upload" sem tamanho de chunk) | Aplique um padrão da indústria para o detalhe faltante; documente como assumption explícita na spec. NÃO bloqueie. |
| Descrição muito vaga (definição de feature deixa muitas decisões abertas) | Aplique padrões de best-practice para cada decisão aberta e documente como assumptions explícitas na spec; nunca infira silenciosamente |
| Sem padrões de codebase encontrados (codebase não vazio mas Descoberta de Padrão retornou nada) | Research documenta industry defaults no brief; writer herda |
| Brief ausente ou stale no writer | NÃO improvisar Camada 2 — falhar; orquestrador regenera Research (B.5a) |
| `ui.md`/`copy.md` ausentes para uma feature com UI | Documente a lacuna como assumption explícita; spec cobre só contrato de dados/estado, sem inventar anatomia ou copy |

Todas as outras regras de spec-writer (conteúdo driven by PRD, aderência a padrões de codebase, validação SPEC/PLAN, nomenclatura kebab-case, estrutura de arquivo) aplicam inalteradas.

**Requisito de documentação:** toda vez que um sub-agente aplica um padrão de Auto-Aceitar para uma decisão que o PRD não respondeu, ele DEVE registrar essa decisão sob uma subseção "Assumptions" ou "Decisions" da spec, para o usuário poder revisar e corrigir depois.

---

## Regras

**Precedência:** Quando uma feature está rodando em Modo Lote, os grupos de regra `(Modo Lote)` abaixo sobrescrevem qualquer regra conflitante nas listas gerais `Always`/`Never` — notavelmente, Modo Lote sobrescreve regras relacionadas a entrevista ("Preserve iterative interview style", "Skip interview questions...", etc.). Todas as regras não-conflitantes ainda se aplicam.

**Sempre:**
- Gere DOIS arquivos (spec e plan) em `docs/<feature-id>-<kebab-name>/`
- Valide ambos documentos antes de salvar
- Execute Codebase Pattern Discovery em duas camadas (baseline + broad) antes da entrevista — em Modo Lote isso é satisfeito pelo Research (B.5a); writers fazem delta-only sobre o brief
- Leia a feature-alvo do PRD e use Consome/Provê/Escopo Central/Escopo Completo/Capacidades/Experiência/Tratamento de Erros/critérios de aceitação como contexto primário
- Verifique e leia `ui.md`/`copy.md` da feature quando existirem (Passo 1.5b), e trate-os como fonte de verdade de UX/copy
- Pule perguntas da entrevista cujas respostas já estão no PRD, no codebase, no brief, em `ui.md`/`copy.md`, ou em specs anteriores
- Aplique o mapeamento PRD → SPEC consistentemente em todas as features
- Preserve o estilo iterativo de entrevista: uma pergunta por vez, caminhe pela árvore de decisão, forneça uma resposta recomendada
- Termine o plan com fase **Validação e fechamento** (O QUÊ verificar / gate de saída; detalhes de teste ficam na spec)
- Features com UI: o fechamento do plan inclui verificação light/dark, anatomia vs `ui.md` e copy vs `copy.md` quando esses arquivos existirem
- Spec § Estratégia de Testes inclui unitário/integração com funções nomeadas, smoke/aceitação manual, e cross-feature (ou *deferred* / peer no lote)

**Nunca:**
- Coloque código real em spec (descreva apenas estrutura)
- Coloque decisões arquiteturais em plan
- Inclua estimativas de tempo
- Detalhe implementação de testes no plan (signatures, asserts, mocks, snippets, nomes de funções de teste) — use a fase Validação e fechamento só como gate/ordem
- Inclua metadados de Feature ID/Data/Versão
- Inclua detalhes de implementação em passos do plan (tipos de dados, colunas, métodos)
- Prossiga sem um PRD — sempre exija um e dirija o usuário para `prd-writer` se ausente
- Re-pergunte questões cujas respostas são observáveis no codebase, no brief, em `ui.md`/`copy.md`, ou já mencionadas no PRD
- Restrinja exploração do codebase ao checklist de baseline — o baseline é piso, não teto (exceto writers em lote com brief fresco, que fazem só delta)
- Omita a fase Validação e fechamento do plan (exceto se o usuário pedir explicitamente só a spec)
- Recopie o checklist Camada 1 do brief na spec — cite o path e documente só o delta
- Recopie a anatomia/tokens de `ui.md` ou a tabela de strings de `copy.md` na spec — cite os caminhos

**Sempre (Modo Lote):**
- Valide a regra same-wave antes do dispatch; rejeite lotes cross-wave
- Apresente um plano consolidado e aguarde confirmação explícita antes de dispatch
- Execute B.5a Research **antes** de B.5 writers; writers só partem com brief fresco em `docs/_shared/codebase-patterns.md`
- Writers consomem o brief read-only; Camada 2 completa só no Research (ou single-feature sem brief)
- Use o Writer Contract no prompt de cada writer (não mandar releitura integral da SKILL)
- Pule features cujo `spec.md` já existe a menos que o usuário solicite explicitamente regeneração
- Execute features de Fundação sequencialmente quando o codebase for greenfield ou Fundação Parcial
- Aplique a Política de Auto-Aceitar dentro de cada writer em vez de executar a entrevista interativa

**Nunca (Modo Lote):**
- Misture features de ondas diferentes no mesmo lote
- Dispatch de features de Fundação em paralelo quando qualquer Fundação ainda não estiver implementada
- Cancele writers em execução porque outro writer falhou
- Despache writers sem brief fresco válido
- Deixe writers reexecutarem Camada 2 ampla ou escreverem em `docs/_shared/codebase-patterns.md`
- Deixe writers improvisarem Camada 2 se o brief estiver ausente/stale

---

## Casos de Borda

**Precedência Modo Lote:** Em Modo Lote, qualquer caso de borda abaixo que instrua o sub-agente a "pergunte ao usuário", "confirme com o usuário", ou "vá mais fundo na entrevista" é sobrescrito pela linha correspondente da Política de Auto-Aceitar (seção Modo Lote). Sub-agentes nunca fazem pausa para perguntar; casos de borda no nível do orquestrador ("Múltiplos arquivos PRD", "Referência de feature ambígua", avisos de dependência) são resolvidos uma vez em B.1–B.3 antes do dispatch.

**Nenhum PRD encontrado:** Pare e instrua o usuário a gerar um primeiro com `prd-writer`. Não execute a skill sem um PRD. Neste repositório, isso só deveria acontecer se `docs/PRD.md` tiver sido removido.

**Feature não encontrada no PRD:** Liste as features disponíveis da Seção 8 do PRD e pergunte ao usuário qual foi a intenção.

**Referência de feature ambígua:** Se a entrada do usuário bate múltiplas features (ex.: "upload" bate F03 e F11), liste os candidatos e peça ao usuário desambiguar.

**Múltiplos arquivos PRD no projeto:** Pergunte ao usuário qual PRD usar.

**Dependência não ainda implementada:** Avise o usuário (ex.: "F08 depende de F07, que não está implementada ainda. Continuar mesmo assim?") e prossiga apenas se confirmado. A spec ainda pode ser gerada — ordem de implementação é decisão do usuário.

**Codebase vazio/apenas scaffolding (primeira feature):** Em single-feature, pule Descoberta de Padrão e pergunte questões de stack transversais inline no Passo 2. Em Modo Lote, Research grava bootstrap no brief; writers herdam. Features subsequentes lerão o codebase/brief. Não aplicável ao estado atual do EngrenaCode (Fundação já implementada).

**PRD sem blocos Escopo Central / Adições ao Escopo Completo para a feature:** Pule a pergunta de escopo; presuma escopo de feature completo.

**PRD tem apenas Escopo Central (sem Adições ao Escopo Completo):** Presuma escopo = Central; não pergunte.

**Descrição muito vaga:** Se a definição de feature no PRD é inusitadamente fina e deixa muitas decisões abertas, vá mais fundo na entrevista — não presuma padrões silenciosamente.

**Sem padrões de codebase encontrados (mas codebase não vazio):** Pergunte ao usuário confirmar usando best-practices da indústria ou forneça uma referência.

**Feature exige novas tecnologias não presentes no codebase:** Liste as novas dependências, pergunte ao usuário para confirmar, documente em decisions.

**Múltiplos padrões conflitantes no codebase:** Em single-feature, apresente ambos, pergunte qual seguir, documente a escolha. Em Modo Lote, Research fixa a escolha no brief (mais frequente / mais recente); writers herdam.

**Sanitizar nome de feature para kebab-case:** minúsculas no nome, substitua espaços por hífens, remova caracteres fora de `[a-z0-9-]`. Exemplo: `F07. Background Video Processing Pipeline` → `F07-background-video-processing-pipeline`.

**Entrada de lote cross-wave:** Rejeite com mensagem apontando Seção 8 do PRD e explicando que ondas rodam sequencialmente para o codebase acumular padrões entre ondas. Não auto-divida em dois lotes — o usuário deve executar onda anterior primeiro, implementar, depois executar a próxima.

**Referência de onda desconhecida:** Liste ondas disponíveis da Seção 8 do PRD e peça ao usuário esclarecer.

**Lote contém feature já spec'd:** O plano consolidado a sinaliza como "já tem spec"; padrão é pular. Usuário pode solicitar regeneração explicitamente na resposta de confirmação.

**Lote contém feature cuja dependência externa não está implementada:** Marque a feature como "dependency missing — will abort" no plano; gere specs para as features restantes e reporte a que foi abortada no resultado final. Dependências satisfeitas por outra feature no mesmo lote não contam como faltando.

**Lote com múltiplas features de Fundação em projeto greenfield:** Fundações rodam sequencialmente na ordem que aparecem na Seção 8 do PRD (após B.5a Research). O plano afirma isto explicitamente ("Mode: Two-phase — sequential Foundation writers"). Features não-Fundação no mesmo lote ainda rodam em paralelo após Fundações terminarem.

**Falha do Research (B.5a):** Não despache writers. Reporte a falha; regenere Research ou aborte o lote. Não caia no caminho antigo de N× Descoberta ampla.

**Brief stale ou ausente no writer:** Writer falha imediatamente sem improvisar Camada 2. Orquestrador regenera Research e redispacha o writer afetado.

**Falha de writer em lote:** Outros writers continuam até conclusão. Relatório final lista sucessos e falhas com razões. Features falhadas podem ser re-executadas individualmente ou como lote menor (Research só precisa rerodar se o brief estiver stale).

**PRD sem subseção "Ondas de Execução" em modo lote:** Referências de onda (`onda N`) exigem esta subseção para expandir em features. Rejeite com: "Referências de onda exigem uma subseção 'Ondas de Execução' na Seção 8 do PRD. Este PRD não tem uma. Use IDs de feature diretamente ou atualize o PRD." Não tente sintetizar ondas.

**Usuário recusa o plano consolidado (responde "não" em B.4):** Aborte limpamente. Sem sub-agentes dispatch, sem arquivos criados, sem estado parcial deixado para trás. Usuário reinvoca a skill com entrada ajustada.

**Feature tem UI mas `ui.md`/`copy.md` ainda não existem:** Não bloqueie a geração da spec técnica. Documente a lacuna em Assumptions e sinalize no relatório final que o processo de design de UI é pré-requisito antes de implementar a superfície visual (ver `CLAUDE.md` → "Design · Processo").

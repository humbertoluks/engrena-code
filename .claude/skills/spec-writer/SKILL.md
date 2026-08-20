---
name: spec-writer
description: Gera especificação técnica de implementação e plano para uma ou mais features com base no PRD, análise do codebase e esclarecimento iterativo. Trata ui.md/copy.md por feature como fonte de verdade de UX e copy quando existem.
---

# Feature Specs Writer

Gera especificações técnicas prontas para implementação com base no PRD do projeto e padrões existentes do codebase.

Opera em **uma feature por vez**, identificada por seu ID de feature do PRD (F01, F02...), com entrevista interativa (Passos 1–6 abaixo).

> Houve um "Modo Lote" que gerava várias features da mesma onda em paralelo, via um agente Research
> que gravava um brief compartilhado. Foi removido em 2026-08-20: o brief envelhecia em silêncio (o
> que estava no repo declarava `status: fresh` com um `git_sha` anterior à conversão monorepo) e o
> modo dependia de despachar sub-agentes. Se a geração paralela voltar a fazer sentido, volta como
> skill própria — não como modo enterrado nesta.

**Saída:** DOIS arquivos são necessários:
1. `spec.md` - Especificação técnica (7 seções)
2. `plan.md` - Plano de implementação (fases e passos)

**Localização da saída:** `<raiz de docs>/<feature-id>-<kebab-name>/{spec.md,plan.md}` — a raiz está em [`project.md`](project.md)
- O `<kebab-name>` é derivado do nome da feature na Seção 6 do PRD (minúsculas, espaços → hífens, caracteres especiais removidos). Exemplo: `F03. Video Upload` → `<raiz de docs>/F03-video-upload/`.

## Bindings do projeto

Esta skill é method puro. Tudo que é deste repo — caminho do PRD, raiz de docs, pasta por feature,
gates de tipo/teste/lint, arquivos que são fonte de verdade de UI e copy, precedência de fontes —
vive em [`project.md`](project.md). É o único arquivo a reescrever ao levar a skill para outro
projeto.

Dois pontos que valem repetir aqui porque mudam o comportamento da skill:

- **`ui.md` / `copy.md` da feature, quando existem, são fonte de verdade.** Leia-os antes da
  entrevista (Passo 1.5b) e trate anatomia, tokens, estados e strings como já respondidos — a spec
  cita os caminhos e os ids, nunca redescreve. Quando não existem, registre a lacuna em Assumptions
  e siga com o contrato de dados; não invente copy final nem layout.
- **Precedência de fontes:** o status real de implementação vem do arquivo de progresso, mas a
  composição das ondas e as dependências vêm sempre do PRD. Se o espelho de ondas divergir do PRD,
  use o PRD e reporte a divergência.

## Passos de Execução (6 Passos)

Nota: Estes são passos internos de execução do agente. O documento de plano OUTPUT terá 1-5 fases com base na complexidade da feature.

### Passo 1: Resolver Entrada e Pré-Análise

**1.1: Identificar o PRD e a feature-alvo**

Aceite entrada em formato livre do usuário. O usuário pode referenciar a feature por ID (`F03`), por nome (`Video Upload`), por caminho (`docs/PRD.md F03`), ou qualquer combinação. Resolva a referência:

- Localize o arquivo PRD a partir da referência do usuário, do caminho declarado em `project.md`, ou de locais convencionais (`docs/PRD.md`). Se múltiplos PRDs plausíveis existem, pergunte ao usuário qual usar.
- Identifique a feature-alvo dentro do PRD por ID ou nome.
- Se a entrada for ambígua (ex.: "upload" bate em múltiplas features), confirme com o usuário antes de prosseguir.
- Se a feature referenciada não existir no PRD, liste as features disponíveis da Seção 8 e peça ao usuário para esclarecer.

**PRD é obrigatório.** Se nenhum PRD for encontrado no projeto, pare e instrua o usuário a gerar um primeiro com a skill `prd-writer`. Não recaia em uma entrevista não estruturada.

**1.2: Verificar disponibilidade de dependências e Features de Fundação (greenfield)**

Leia a Seção 8 do PRD (Grafo de Dependências). Para cada feature na coluna `Dependências` da feature-alvo, verifique se ela parece estar implementada no codebase (arquivos fonte existem correspondendo ao escopo da feature — em caso de dúvida, cheque o arquivo de progresso declarado em `project.md`). Se alguma dependência não estiver implementada, avise o usuário: "F<X> depende de F<Y> (não implementada ainda). Continuar mesmo assim?" Prossiga apenas se confirmado.

Se o PRD contém uma subseção **Features de Fundação** na Seção 8, aplique estas verificações adicionais com base no estado de implementação de cada feature de Fundação:

- **Detecção de estado de Fundação (o sinal correto de greenfield):** para cada feature listada em Features de Fundação, verifique se ela parece estar implementada no codebase procurando por um ou mais arquivos de saída característicos que a feature deve criar — por exemplo, um arquivo de schema ORM ou de migração para uma Fundação de banco de dados, um módulo de sessão/middleware para uma Fundação de auth, um arquivo de layout/template raiz para uma Fundação de layout, ou qualquer artefato equivalente na stack sendo usada (framework web, serviço backend, app mobile, etc.). NÃO dependa apenas da mera presença de marcadores genéricos de projeto como uma pasta de fonte ou arquivo de package/manifest — qualquer ferramenta de scaffolding (`create-next-app`, `rails new`, `django-admin startproject`, etc.) já cria esses, ainda assim as Features de Fundação do PRD podem não estar implementadas.
  - **Greenfield** = zero Features de Fundação implementadas ainda.
  - **Fundação Parcial** = algumas Features de Fundação implementadas, outras ainda pendentes.
  - **Fundação completa** = toda Feature de Fundação está implementada.
- **Cenário 1 — greenfield + feature-alvo É uma Feature de Fundação:** prossiga sem aviso extra. Este é o caminho esperado para um projeto greenfield.
- **Cenário 2 — greenfield + feature-alvo NÃO está em Features de Fundação:** avise o usuário: "Isto parece ser um projeto greenfield (nenhuma feature de Fundação está implementada ainda). F<alvo> não é uma feature de Fundação. Features de Fundação (F<ID>, ...) configuram a infraestrutura compartilhada e devem ser implementadas primeiro. Recomendo começar com F<primeira-fundacao>. Continuar com F<alvo> mesmo assim?" Prossiga apenas se confirmado.
- **Cenário 3 — Fundação Parcial (algumas features de Fundação implementadas, outras pendentes) e alvo não é uma das Fundações restantes:** liste as features de Fundação pendentes e avise: "Features de Fundação F<ID1>, F<ID2>... não estão implementadas ainda. Implementar F<alvo> antes destas pode criar conflitos de arquivo no scaffolding. Continuar mesmo assim?" Prossiga apenas se confirmado.
- **Fundação completa (codebase maduro para fins de Fundação):** pule todas as verificações específicas de Fundação. A verificação normal de disponibilidade de dependências acima é suficiente. É o estado de qualquer repo cuja Fundação já esteja no lugar.

**1.3: Descoberta de Padrões do Codebase (duas camadas)**

Explore o codebase antes da entrevista, para extrair padrões. Isto é obrigatório sempre que o codebase não está vazio — não espere o usuário fornecer caminhos.

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

**1.4: Manipulação de codebase vazio**

Se o codebase estiver vazio ou apenas com scaffolding (ex.: apenas `package.json` com defaults, nenhuma implementação `src/` ainda), pule a descoberta Camada 1/Camada 2 e em vez disso planeje perguntar questões de stack transversais inline durante o Passo 2 (estas questões serão perguntadas apenas uma vez — na primeira feature. Features subsequentes encontrarão as respostas no codebase). Em repo com Fundação já implementada este caso não se aplica; use o código existente como referência de padrões.

**1.5: Ler dados da feature do PRD**

Extraia a definição completa da feature-alvo do PRD e carregue como contexto para a entrevista e para a spec:
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

Se a feature tem qualquer superfície visual (a Experiência do PRD descreve telas/fluxos de usuário), verifique `ui.md` e `copy.md` na pasta da feature (ver `project.md`):
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

### Passo 2: Entrevista

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
- [ ] Features com UI: `ui.md`/`copy.md` citados por path (quando existem) e nunca recopiados; lacuna registrada em Assumptions quando não existem

Documento PLAN:
- [ ] Passos numerados através de fases
- [ ] Formato: **N. Componente** - Parágrafo alto-nível (1-3 frases)
- [ ] Passos descrevem O QUÊ, não COMO (spec tem detalhes)
- [ ] Fase final **Validação e fechamento** presente (gate: smoke, aceitação, build/test)
- [ ] Sem estimativas de tempo
- [ ] Features com UI: fechamento menciona light/dark, anatomia vs `ui.md` e copy vs `copy.md` quando esses arquivos existirem

**Salve ambos arquivos na pasta da feature declarada em `project.md`.** Crie a pasta se não existir. Verifique ambos arquivos com a ferramenta Read.

### Passo 6: Resultado de Saída

Informe o caminho dos arquivos spec e plan, o nível de complexidade da feature, e quantas fases estão no plano. Se a feature tem UI e `ui.md`/`copy.md` ainda não existem, destaque isso como pendência antes de implementar.

---

## Regras

**Sempre:**
- Gere DOIS arquivos (spec e plan) na pasta da feature (ver `project.md`)
- Valide ambos documentos antes de salvar
- Execute Codebase Pattern Discovery em duas camadas (baseline + broad) antes da entrevista
- Leia a feature-alvo do PRD e use Consome/Provê/Escopo Central/Escopo Completo/Capacidades/Experiência/Tratamento de Erros/critérios de aceitação como contexto primário
- Verifique e leia `ui.md`/`copy.md` da feature quando existirem (Passo 1.5b), e trate-os como fonte de verdade de UX/copy
- Pule perguntas da entrevista cujas respostas já estão no PRD, no codebase, em `ui.md`/`copy.md`, ou em specs anteriores
- Aplique o mapeamento PRD → SPEC consistentemente em todas as features
- Preserve o estilo iterativo de entrevista: uma pergunta por vez, caminhe pela árvore de decisão, forneça uma resposta recomendada
- Termine o plan com fase **Validação e fechamento** (O QUÊ verificar / gate de saída; detalhes de teste ficam na spec)
- Features com UI: o fechamento do plan inclui verificação light/dark, anatomia vs `ui.md` e copy vs `copy.md` quando esses arquivos existirem
- Spec § Estratégia de Testes inclui unitário/integração com funções nomeadas, smoke/aceitação manual, e cross-feature (ou *deferred* quando a dependência ainda não existe)

**Nunca:**
- Coloque código real em spec (descreva apenas estrutura)
- Coloque decisões arquiteturais em plan
- Inclua estimativas de tempo
- Detalhe implementação de testes no plan (signatures, asserts, mocks, snippets, nomes de funções de teste) — use a fase Validação e fechamento só como gate/ordem
- Inclua metadados de Feature ID/Data/Versão
- Inclua detalhes de implementação em passos do plan (tipos de dados, colunas, métodos)
- Prossiga sem um PRD — sempre exija um e dirija o usuário para `prd-writer` se ausente
- Re-pergunte questões cujas respostas são observáveis no codebase, em `ui.md`/`copy.md`, ou já mencionadas no PRD
- Restrinja exploração do codebase ao checklist de baseline — o baseline é piso, não teto
- Omita a fase Validação e fechamento do plan (exceto se o usuário pedir explicitamente só a spec)
- Recopie a anatomia/tokens de `ui.md` ou a tabela de strings de `copy.md` na spec — cite os caminhos

## Casos de Borda

**Nenhum PRD encontrado:** Pare e instrua o usuário a gerar um primeiro com `prd-writer`. Não execute a skill sem um PRD. Num repo que já tinha PRD, isso significa que ele foi removido — confirme antes de gerar outro.

**Feature não encontrada no PRD:** Liste as features disponíveis da Seção 8 do PRD e pergunte ao usuário qual foi a intenção.

**Referência de feature ambígua:** Se a entrada do usuário bate múltiplas features (ex.: "upload" bate F03 e F11), liste os candidatos e peça ao usuário desambiguar.

**Múltiplos arquivos PRD no projeto:** Pergunte ao usuário qual PRD usar.

**Dependência não ainda implementada:** Avise o usuário (ex.: "F08 depende de F07, que não está implementada ainda. Continuar mesmo assim?") e prossiga apenas se confirmado. A spec ainda pode ser gerada — ordem de implementação é decisão do usuário.

**Codebase vazio/apenas scaffolding (primeira feature):** Pule Descoberta de Padrão e pergunte questões de stack transversais inline no Passo 2. Features subsequentes lerão o codebase.

**PRD sem blocos Escopo Central / Adições ao Escopo Completo para a feature:** Pule a pergunta de escopo; presuma escopo de feature completo.

**PRD tem apenas Escopo Central (sem Adições ao Escopo Completo):** Presuma escopo = Central; não pergunte.

**Descrição muito vaga:** Se a definição de feature no PRD é inusitadamente fina e deixa muitas decisões abertas, vá mais fundo na entrevista — não presuma padrões silenciosamente.

**Sem padrões de codebase encontrados (mas codebase não vazio):** Pergunte ao usuário confirmar usando best-practices da indústria ou forneça uma referência.

**Feature exige novas tecnologias não presentes no codebase:** Liste as novas dependências, pergunte ao usuário para confirmar, documente em decisions.

**Múltiplos padrões conflitantes no codebase:** Apresente ambos, pergunte qual seguir, documente a escolha.

**Sanitizar nome de feature para kebab-case:** minúsculas no nome, substitua espaços por hífens, remova caracteres fora de `[a-z0-9-]`. Exemplo: `F07. Background Video Processing Pipeline` → `F07-background-video-processing-pipeline`.

**Feature tem UI mas `ui.md`/`copy.md` ainda não existem:** Não bloqueie a geração da spec técnica. Documente a lacuna em Assumptions e sinalize no relatório final que o processo de design de UI é pré-requisito antes de implementar a superfície visual (ver `CLAUDE.md` → "Design · Processo").

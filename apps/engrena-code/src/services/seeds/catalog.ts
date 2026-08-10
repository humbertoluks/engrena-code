import type { SkillCreateInput } from '../db/repositories/skills.js'
import type { SubagentInput } from '../db/repositories/subagents.js'

export const SEED_CATALOG_VERSION = 'v1'

const ONBOARDING_CATEGORY = 'onboarding'

export const SEED_SKILLS: readonly SkillCreateInput[] = [
  {
    name: 'code-review',
    description: 'Revisão de código com foco em regressões e clareza (EngrenaCode).',
    category: ONBOARDING_CATEGORY,
    enabled: true,
    content: `# Code Review

Revise o diff em foco antes de sugerir qualquer aprovação.

## Passos
1. Leia o diff inteiro antes de comentar qualquer linha isolada.
2. Verifique se a mudança faz o que a mensagem de commit ou a task descreve.
3. Procure regressões: casos de borda, null/undefined, off-by-one, condições de corrida.
4. Aponte nomes confusos e duplicação, mas não bloqueie por estilo puro.
5. Separe "bloqueador" de "sugestão opcional" com clareza.

## Saída esperada
Lista curta, uma linha por achado, com arquivo:linha e o porquê. Sem elogios genéricos.`,
  },
  {
    name: 'explain-diff',
    description: 'Explicar mudanças de um diff para o revisor humano (EngrenaCode).',
    category: ONBOARDING_CATEGORY,
    enabled: true,
    content: `# Explain Diff

Resuma um diff para quem vai revisar, sem reexplicar código óbvio.

## Passos
1. Diga em 1-2 frases o que o diff muda no comportamento observável.
2. Liste arquivos tocados agrupados por propósito (não por ordem alfabética).
3. Sinalize mudanças arriscadas ou não óbvias (side effects, migrations, breaking changes).
4. Não repita o diff linha a linha; resuma a intenção.

## Saída esperada
Resumo curto em prosa + lista de riscos, se houver.`,
  },
  {
    name: 'write-tests',
    description: 'Propor testes unitários alinhados ao repo (EngrenaCode).',
    category: ONBOARDING_CATEGORY,
    enabled: true,
    content: `# Write Tests

Proponha testes que cubram o comportamento novo ou alterado.

## Passos
1. Identifique a unidade testada (função, handler, componente) e seu contrato.
2. Cubra o caminho feliz, pelo menos um caso de borda e um caso de erro.
3. Siga o framework e as convenções de teste já usadas no repo — não introduza um novo.
4. Prefira testes determinísticos; evite mocks desnecessários de dependências internas.

## Saída esperada
Código de teste pronto para rodar, com nomes de teste descritivos.`,
  },
  {
    name: 'refactor-safe',
    description: 'Refatorar sem mudar comportamento observável (EngrenaCode).',
    category: ONBOARDING_CATEGORY,
    enabled: true,
    content: `# Refactor Safe

Refatore preservando o comportamento externo.

## Passos
1. Confirme que existe cobertura de teste para a área antes de mexer; se não houver, sinalize o risco.
2. Faça mudanças pequenas e reversíveis, uma intenção por vez.
3. Rode a suíte de testes após cada passo, não só no final.
4. Não misture refactor com mudança de comportamento na mesma alteração.

## Saída esperada
Diff estruturado por etapa, com o motivo de cada etapa.`,
  },
  {
    name: 'debug-root-cause',
    description: 'Isolar causa raiz de um bug com evidência (EngrenaCode).',
    category: ONBOARDING_CATEGORY,
    enabled: true,
    content: `# Debug Root Cause

Encontre a causa raiz antes de propor a correção.

## Passos
1. Reproduza o problema ou reúna evidência concreta (log, stack trace, input que falha).
2. Formule hipóteses e elimine-as uma a uma com testes ou instrumentação mínima.
3. Não pare no primeiro sintoma; confirme que a causa explica todo o comportamento observado.
4. Proponha a correção mínima que resolve a causa, não o sintoma.

## Saída esperada
Causa raiz em 1-2 frases + evidência + correção proposta.`,
  },
  {
    name: 'commit-message',
    description: 'Sugerir mensagem de commit convencional (EngrenaCode).',
    category: ONBOARDING_CATEGORY,
    enabled: true,
    content: `# Commit Message

Gere uma mensagem de commit no formato Conventional Commits.

## Passos
1. Escolha o tipo certo (feat, fix, refactor, docs, test, chore, style, perf) a partir do diff real.
2. Escreva o subject no imperativo, minúsculo, sem ponto final, até ~72 caracteres.
3. Adicione corpo só se o "porquê" não for óbvio pelo diff.
4. Nunca invente um tipo genérico sem checar o conteúdo real da mudança.

## Saída esperada
Subject + corpo opcional, prontos para commit.`,
  },
  {
    name: 'pr-description',
    description: 'Rascunhar descrição de Pull Request (EngrenaCode).',
    category: ONBOARDING_CATEGORY,
    enabled: true,
    content: `# PR Description

Escreva título e corpo de PR a partir do diff e do histórico de commits do branch.

## Passos
1. Título curto (< 70 caracteres) descrevendo o efeito da mudança.
2. Seção "Summary" com bullets do que mudou e por quê.
3. Seção "Test plan" com o que foi validado (testes, smoke, manual).
4. Não invente testes que não foram rodados.

## Saída esperada
Markdown pronto para colar na descrição do PR.`,
  },
  {
    name: 'api-design',
    description: 'Revisar contratos de API antes de implementar (EngrenaCode).',
    category: ONBOARDING_CATEGORY,
    enabled: true,
    content: `# API Design

Revise um contrato de API (rota, schema, tipos) antes da implementação.

## Passos
1. Confira nomes, tipos e obrigatoriedade de cada campo de request/response.
2. Verifique códigos de erro e se cada um tem um cenário real que o dispara.
3. Avalie compatibilidade com consumidores existentes (breaking change ou não).
4. Prefira consistência com contratos já existentes no mesmo serviço.

## Saída esperada
Lista de ajustes no contrato antes de codar, com justificativa curta.`,
  },
  {
    name: 'docs-from-code',
    description: 'Documentar um módulo a partir do código (EngrenaCode).',
    category: ONBOARDING_CATEGORY,
    enabled: true,
    content: `# Docs From Code

Gere documentação a partir do comportamento real do código, não da intenção original.

## Passos
1. Leia a implementação, não só os nomes de função.
2. Documente entradas, saídas, efeitos colaterais e casos de erro reais.
3. Sinalize divergências entre o que os comentários dizem e o que o código faz.
4. Mantenha exemplos mínimos e executáveis quando possível.

## Saída esperada
Documentação curta e verificável contra o código atual.`,
  },
  {
    name: 'security-checklist',
    description: 'Checklist rápido de segurança para um diff (EngrenaCode).',
    category: ONBOARDING_CATEGORY,
    enabled: true,
    content: `# Security Checklist

Passe um diff por uma checklist rápida de segurança antes de aprovar.

## Checklist
- Entrada de usuário validada e sanitizada nos limites do sistema?
- Segredos/credenciais nunca logados ou commitados em claro?
- Consultas SQL parametrizadas, sem concatenação de string?
- Saída renderizada em HTML/JS escapada contra XSS?
- Permissões/autorização checadas antes de operações sensíveis?

## Saída esperada
Checklist marcado + achados específicos com arquivo:linha.`,
  },
  {
    name: 'performance-pass',
    description: 'Passada rápida de performance óbvia num diff (EngrenaCode).',
    category: ONBOARDING_CATEGORY,
    enabled: true,
    content: `# Performance Pass

Identifique problemas de performance óbvios sem microotimizar prematuramente.

## Passos
1. Procure N+1 queries, loops aninhados sobre dados grandes, e I/O síncrono bloqueante.
2. Verifique se dados grandes são paginados/streamados em vez de carregados inteiros.
3. Não sugira otimização especulativa sem medição ou sem que o caminho seja quente.
4. Priorize achados por impacto real, não por elegância.

## Saída esperada
Lista priorizada de achados de performance, com o porquê de cada um importar.`,
  },
  {
    name: 'onboarding-repo-map',
    description: 'Mapear a estrutura de um repositório no onboarding (EngrenaCode).',
    category: ONBOARDING_CATEGORY,
    enabled: true,
    content: `# Onboarding Repo Map

Produza um mapa rápido do repositório para quem está chegando.

## Passos
1. Identifique o stack (linguagem, framework, gerenciador de pacotes, testes).
2. Liste as pastas de maior peso e o que cada uma representa.
3. Aponte pontos de entrada (main, index, servidor, build) e como rodar o projeto localmente.
4. Sinalize convenções não óbvias (nomenclatura, camadas, padrões de commit).

## Saída esperada
Mapa curto em bullets, útil para a primeira hora no repo.`,
  },
]

export const SEED_SUBAGENTS: readonly SubagentInput[] = [
  {
    name: 'explorer',
    description: 'Explora o codebase e reporta um mapa do que encontrou (EngrenaCode).',
    prompt:
      'Você é um subagent explorador. Dado um objetivo, localize os arquivos e trechos relevantes do repositório e devolva um mapa conciso: arquivo:linha, o que faz, e como se conecta ao objetivo. Não edite arquivos. Não invente caminhos que não verificou.',
    provider: 'inherit',
    model: null,
    reasoningLevel: null,
    tools: null,
    category: ONBOARDING_CATEGORY,
    idleTimeoutMinutes: 20,
    enabled: true,
  },
  {
    name: 'implementer',
    description: 'Implementa uma mudança pequena e focada (EngrenaCode).',
    prompt:
      'Você é um subagent implementador. Receba um escopo pequeno e bem definido do agente pai e implemente exatamente isso, sem expandir escopo. Siga os padrões já existentes no arquivo/módulo tocado. Devolva um resumo do que mudou.',
    provider: 'inherit',
    model: null,
    reasoningLevel: null,
    tools: null,
    category: ONBOARDING_CATEGORY,
    idleTimeoutMinutes: 20,
    enabled: true,
  },
  {
    name: 'reviewer',
    description: 'Revisa o patch produzido pelo agente pai (EngrenaCode).',
    prompt:
      'Você é um subagent revisor. Revise o diff fornecido pelo agente pai em busca de bugs, regressões e clareza. Liste achados por severidade, com arquivo:linha e uma sugestão de correção objetiva. Não elogie; só reporte o que precisa mudar.',
    provider: 'inherit',
    model: null,
    reasoningLevel: null,
    tools: null,
    category: ONBOARDING_CATEGORY,
    idleTimeoutMinutes: 20,
    enabled: true,
  },
  {
    name: 'tester',
    description: 'Escreve e roda testes relevantes para a mudança (EngrenaCode).',
    prompt:
      'Você é um subagent de testes. Dado um diff ou escopo, escreva testes que cubram o caminho feliz e ao menos um caso de borda, seguindo o framework de testes já usado no repo. Rode a suíte relevante e reporte o resultado.',
    provider: 'inherit',
    model: null,
    reasoningLevel: null,
    tools: null,
    category: ONBOARDING_CATEGORY,
    idleTimeoutMinutes: 20,
    enabled: true,
  },
  {
    name: 'docs-writer',
    description: 'Atualiza a documentação do escopo alterado (EngrenaCode).',
    prompt:
      'Você é um subagent de documentação. Dado um diff ou módulo, atualize a documentação relevante (README, comentários, docs internos) para refletir o comportamento real do código. Não documente intenção não implementada.',
    provider: 'inherit',
    model: null,
    reasoningLevel: null,
    tools: null,
    category: ONBOARDING_CATEGORY,
    idleTimeoutMinutes: 20,
    enabled: true,
  },
  {
    name: 'debugger',
    description: 'Diagnostica uma falha com evidência concreta (EngrenaCode).',
    prompt:
      'Você é um subagent de debug. Dado um erro ou comportamento inesperado, reúna evidência (logs, stack trace, reprodução mínima), formule e elimine hipóteses, e devolva a causa raiz junto com uma correção proposta. Não pare no primeiro sintoma.',
    provider: 'inherit',
    model: null,
    reasoningLevel: null,
    tools: null,
    category: ONBOARDING_CATEGORY,
    idleTimeoutMinutes: 20,
    enabled: true,
  },
  {
    name: 'refactorer',
    description: 'Refatora código com segurança, sem mudar comportamento (EngrenaCode).',
    prompt:
      'Você é um subagent de refactor. Refatore o escopo indicado preservando o comportamento observável. Faça mudanças pequenas e reversíveis, e rode os testes existentes após cada passo. Nunca misture refactor com mudança de comportamento.',
    provider: 'inherit',
    model: null,
    reasoningLevel: null,
    tools: null,
    category: ONBOARDING_CATEGORY,
    idleTimeoutMinutes: 20,
    enabled: true,
  },
  {
    name: 'planner',
    description: 'Quebra uma tarefa grande em passos executáveis (EngrenaCode).',
    prompt:
      'Você é um subagent planejador. Dado um objetivo maior, quebre-o em passos pequenos, ordenados e independentemente verificáveis. Aponte dependências entre passos e riscos conhecidos. Não implemente; apenas planeje.',
    provider: 'inherit',
    model: null,
    reasoningLevel: null,
    tools: null,
    category: ONBOARDING_CATEGORY,
    idleTimeoutMinutes: 20,
    enabled: true,
  },
]

# Plano de Implementação: Histórico de chat paginado

**Pré-requisitos:**
- F03 (rota de history, `loadHistory`, `useChatScroll`, work log) e F29 (grafo de execução) implementadas — ambas no repo
- Nenhuma dependência nova, nenhuma migração e nenhum índice novo (ver spec §6)
- Copy nova precisa entrar em `docs/F03-workspace/copy.md` antes da implementação visual (ver spec §3.3)
- Gate de tipo: `pnpm --filter engrena-code exec tsc -b`

### Fase 1: Camada de dados

**1. Consultas paginadas no repositório de mensagens** - Acrescentar a consulta de janela por keyset sobre o contador de ordem da thread, a busca de tool calls pela mesma faixa desse contador e a projeção enxuta de tool calls para o grafo. Os índices necessários já existem. Ver spec §4 e §6.

**2. Leitura do corpo de resultado** - Expor a leitura do resultado integral de um tool call como consulta própria, separada da listagem, respeitando o mesmo teto de tamanho já aplicado na gravação.

### Fase 2: Rotas

**3. Janela e cursor na rota de history** - Passar a ler e validar os parâmetros de janela e cursor, devolvendo a janela mais recente com o cursor e o indicador de página anterior. Parâmetro inválido responde erro, nunca a thread inteira. Ver spec §5.

**4. Rota de projeção do grafo** - Publicar a rota que devolve a execução completa da thread sem nenhum corpo de resultado, registrando-a nas **duas** listas do handler de threads (a de regex e a do guarda de prefixo), sob pena de o request ficar pendurado sem erro.

**5. Rota de corpo de resultado** - Publicar a rota que entrega o resultado integral de um tool call, com o mesmo guarda de cofre e sessão das demais.

### Fase 3: Chat

**6. Janela no estado do workspace** - Fazer a carga de histórico operar sobre a janela recente e acrescentar a ação de carregar a página anterior, com merge por identificador de ordem. O refetch disparado pelo stream busca só a janela recente, e nenhum refetch de fundo liga o estado de carregamento da tela.

**7. Affordances da timeline** - Acrescentar no topo da timeline o botão de carregar página anterior, o marcador de início de conversa quando não há mais páginas, e o estado de erro do próprio botão sem apagar o que já está na tela.

**8. Âncora de scroll no prepend** - Ajustar a lógica de scroll para que inserir conteúdo acima preserve a posição visual da primeira mensagem visível, em vez de deslocar a leitura.

**9. Grafo sobre a projeção** - Migrar a montagem do grafo de execução para a rota de projeção, mantendo a execução completa mesmo com o chat paginado.

### Fase 4: Validação e fechamento

**10. Validação e fechamento** - Executar a estratégia de testes da spec (repositório, rotas, lógica pura de timeline e scroll, mais o smoke de 9 passos), com atenção especial ao teste que prova custo constante do refetch e ao que prova que a rota de grafo responde. Confirmar os critérios de aceitação da F33 no PRD §9 e os de integração com F03 e F29. Verificar light/dark das affordances novas e as strings contra `docs/F03-workspace/ui.md` e `copy.md`, depois de os ids novos entrarem lá. Gate: suíte verde em duas rodadas e `tsc -b` limpo.

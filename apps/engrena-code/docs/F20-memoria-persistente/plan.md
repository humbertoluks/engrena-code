# Plano de Implementação: F20. Memória Persistente (Memory)

**Pré-requisitos:**
- Herdar stack/tooling de `docs/_shared/codebase-patterns.md` (Electron/TS ESM, SQLite `node:sqlite`, vault AES, Vitest) — nenhuma ferramenta/biblioteca nova exigida por esta feature
- Sem variáveis de ambiente novas
- Sem arquivos de configuração novos

### Fase 1: Vault, toggle e formatação do bloco

**1. Migração e toggle por projeto** - Adicionar a coluna de toggle "Memória" na tabela `projects` (nova migração numerada, registrada no client de DB) e estender o repositório de projetos para expor e gravar esse toggle.

**2. Camada de journal sobre o vault** - Criar o serviço que lê/escreve o `journal.md` do projeto como um único secret cifrado no vault, incluindo o cap de tamanho (truncamento das entradas mais antigas) e o tratamento de conteúdo corrompido/ilegível como journal vazio.

**3. Formatação do bloco de memória** - Criar a função de composição do bloco a ser injetado no prompt (preâmbulo + seção delimitada + rodapé, seguindo o mesmo padrão sanitizado do bloco de Rules), truncando a cauda do journal ao teto de tokens definido na spec.

### Fase 2: Wiring no ciclo de turno

**4. Fachada de leitura para o dispatch** - Criar o registry que resolve o bloco de memória de um projeto respeitando o toggle, espelhando o papel já existente do registry de Rules no ciclo de turno.

**5. Servidor loopback por turno e tool MCP** - Criar o servidor HTTP efêmero por turno que recebe a entrada de journal, e estender o MCP interno `engrenacode` com a nova tool de escrita, exposta condicionalmente quando o servidor está ativo (mesmo padrão condicional já usado pelas tools existentes do MCP interno).

**6. Integração no dispatch** - Injetar o bloco de memória no system prompt do turno; abrir o servidor loopback e registrar a nova tool na montagem do MCP interno quando a memória estiver ligada para o projeto; fechar o servidor ao fim do turno; emitir o evento de stream sinalizando nova entrada.

**7. Tratamento de erro sem falhar o turno** - Garantir que falha de escrita da entrada, journal corrompido, e erro no servidor loopback sejam registrados como log e nunca interrompam ou reprovem o turno em andamento.

### Fase 3: Endpoints e contrato para o painel

**8. Endpoints REST de memória** - Criar o handler HTTP com os endpoints de status (contagem/última entrada/toggle), alternância do toggle, e leitura somente-visualização do journal, registrado no server loopback único do app com o mesmo guard de sessão dos demais handlers.

**9. Evento de atualização sem reload** - Estender a união de eventos de stream com o novo tipo de evento de nova entrada de memória, e tratar esse evento no hook de workspace para disparar a atualização do status sem exigir reload da tela.

**10. Cliente HTTP do frontend** - Criar o serviço de frontend que consome os três endpoints de memória, seguindo o mesmo padrão dos serviços já existentes para Rules/Skills, para servir de base à seção do painel quando a UI for desenhada.

### Fase 4: Validação e fechamento

**11. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração + smoke). Confirmar os 4 critérios de aceitação de F20 (`docs/PRD.md:1342-1347`) e o critério cross-feature de precedência do bloco de memória no system prompt do Workspace (`docs/PRD.md:1414`). Registrar explicitamente que a fase visual (seção "Memória" no Repo Harness, com light/dark, anatomia e copy) fica bloqueada até `ui.md`/`copy.md` de F20 existirem — não fechar essa parte nesta rodada. Gate: suite e build verdes.

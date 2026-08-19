# Plano de Implementação: Estado honesto de thread interrompida

**Pré-requisitos:**
- F03 (máquina de estado, superfície do chat, sidebar) e F08 (`log_entries`) implementadas — ambas no repo
- Nenhuma migração: `threads.state` é `TEXT NOT NULL` sem `CHECK` de enum (verificado em `002_workspace_core.ts`)
- Copy do separador e do badge precisa entrar em `docs/F03-workspace/copy.md` antes da implementação visual (ver spec §3.3)
- Gate de tipo: `pnpm --filter engrena-code exec tsc -b` — a ampliação da união vai apontar cada `switch` que precisa decidir

### Fase 1: Estado

**1. Estado novo na união e na máquina** - Acrescentar o estado à união de estados de thread e declará-lo terminal na máquina de estado, garantindo que nenhuma transição de turno vivo o produza. Nada a fazer no banco. Deixar o compilador apontar cada ponto de decisão exaustiva e resolver um por um. Ver spec §4.

**2. Conjuntos terminais do renderer** - Incluir o estado novo no conjunto de estados assentados, do qual o conjunto de reconciliação de turno deriva, para a fila do composer drenar exatamente como já drena no caso de cancelamento. Ficar de fora deste conjunto é o erro que já congelou a fila neste repo.

### Fase 2: Recuperação de boot

**3. Recuperação gravando o estado novo** - Trocar o estado gravado pela recuperação de boot, mantendo o único UPDATE em lote, e devolver o estado de origem de cada thread para quem chamou. Ver spec §4 e §6.

**4. Ordem no unlock e registro** - Fazer o unlock fechar os gates abertos antes de assentar os estados, ainda negando fail-closed, e registrar em seguida o estado de origem de cada thread recuperada. Falha no registro não pode impedir o assentamento.

### Fase 3: Superfície

**5. Separador na timeline e badge na sidebar** - Exibir na timeline o separador que diz que o turno foi interrompido, e na sidebar um badge discreto em vez do registro visual de falha, mantendo a thread com falha real visualmente distinta. O composer abre normal, sem passo de limpar erro.

### Fase 4: Validação e fechamento

**6. Validação e fechamento** - Executar a estratégia de testes da spec (recuperação de boot, terminalidade, conjuntos terminais, superfície do composer, mais o smoke de 8 passos), com atenção à idempotência da varredura, à ordem gate-antes-de-estado e ao fail-closed. Confirmar os critérios de aceitação da F35 no PRD §9 e os de integração com F03/F08. Verificar light/dark do separador e do badge e as strings contra `docs/F03-workspace/ui.md` e `copy.md`, depois de os ids entrarem lá. Gate: suíte verde em duas rodadas e `tsc -b` limpo.

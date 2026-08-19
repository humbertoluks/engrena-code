# Plano de Implementação: Prazo do pedido de permissão

**Pré-requisitos:**
- F03 (gate), F08 (`log_entries`) e F30 (relógio + copy de expiry) implementadas — todas já no repo
- Nenhuma dependência nova; sem migração de banco
- Gate de tipo: `pnpm --filter engrena-code exec tsc -b`

### Fase 1: Derivação do prazo

**1. Margem e derivação no contrato do hook** - Introduzir a margem nomeada junto do teto do hook, em `permission-contract.ts`, e expor a função que devolve o prazo derivado. Os dois números passam a morar lado a lado, porque só fazem sentido juntos. Ver spec §3.2 e §4.

**2. Gate consumindo o derivado** - Trocar o literal de `gate.ts` pelo valor derivado, garantindo que a abertura do gate, o expiry e a varredura de gate órfão leiam a mesma fonte. Nenhum caminho fica com número próprio.

### Fase 2: Instrumentação

**3. Registro do fechamento do gate** - Gravar em `log_entries`, no fechamento de todo gate, o desfecho e quantos segundos ele ficou aberto, usando a porta de auditoria existente. É esse dado que dirá depois se 8 minutos bastam, sem precisar abrir o código.

### Fase 3: Validação e fechamento

**4. Validação e fechamento** - Executar a estratégia de testes da spec (unitário do contrato e do gate, mais o smoke de 6 passos), com atenção ao invariante de que o prazo cabe no teto do hook e ao fail-closed no expiry. Confirmar os critérios de aceitação da F32 no PRD §9 e a não-regressão visual do relógio da F30 em light e dark, contra `docs/F03-workspace/ui.md` e `copy.md`. Gate: suíte verde em duas rodadas e `tsc -b` limpo.

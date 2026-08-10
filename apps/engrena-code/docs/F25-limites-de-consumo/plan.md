# Plano de Implementação: F25. Limites de Consumo (UsageLimits)

**Pré-requisitos:**
- Herdar stack de `docs/_shared/codebase-patterns.md` (Camada 1) e padrões F11 (`consumo-handler`, `usage-events`, `ConsumoScreen`)
- F01.1 e F11 implementados (deps PRD)
- `ui.md` / `copy.md` de F25 existem — fases de UI consomem anatomia e ids `limits.*`; strings ainda TODO no catálogo usam provisório da spec §3.3 até o design fechar
- Sem dependência npm nova
- Sem variáveis de ambiente novas

---

### Fase 1: Persistência e avaliação

**1. Migração e repositório de limites** - Criar a migração de `usage_limits` e o repositório de upsert/list/clear conforme a spec. Registrar a migração no client SQLite.

**2. Soma mensal e avaliador** - Expor a soma de `cost_usd` no mês civil (com filtro opcional de projeto) reusando a regra F11 de ignorar custo null. Implementar o avaliador de níveis/bloqueio com fail-open e combinação global+projeto.

### Fase 2: HTTP e gate de turno

**3. Rotas de usage-limits** - Estender o handler de consumo com listagem, upsert e status. Manter o guard 423/401 e a validação de payload da spec.

**4. Gate no dispatch** - Chamar o avaliador antes do lease em criação de thread e follow-up; mapear o erro de limite estourado no handler de threads para o código HTTP da spec. Garantir que modo Avisar não recusa turno e que mudança mid-turno só vale no próximo.

### Fase 3: UI Consumo e workspace

**5. Card em `#consumo`** - Montar o card Limites de consumo (escopo, USD, modo, barra, salvar) na posição definida na spec, consumindo `ui.md`/`copy.md`. Incluir select de projeto quando o escopo for projeto.

**6. Banners no workspace** - Consumir o status por projeto ativo para aviso 80%/100% e mensagem de bloqueio com link para ajustar, sem reinventar copy fora dos ids documentados.

### Fase 4: Validação e fechamento

**7. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração + smoke). Confirmar os 4 ACs de F25 e o AC cross-feature com F11. Features com UI: light/dark, anatomia vs `ui.md` e strings vs `copy.md` (ou provisório §3.3). Gate: suite e build verdes.

# Plano de Implementação: Rascunho persistente do composer

**Pré-requisitos:**
- F03 (composer, ciclo de vida da thread) e F16 (anexos, imagens, model/reasoning) implementadas — ambas no repo
- Nenhuma dependência nova; nenhuma mudança de backend nem de banco
- Copy da linha de imagens não guardadas precisa entrar em `docs/F03-workspace/copy.md` antes da implementação visual (ver spec §3.3)
- Gate de tipo: `pnpm --filter engrena-code exec tsc -b`

### Fase 1: Persistência

**1. Serialização do rascunho** - Acrescentar à lógica pura do rascunho a leitura e a escrita do formato versionado, com o prefixo de chave na mesma convenção da fila de mensagens, e as regras de teto de tamanho, rascunho vazio e evicção por último toque. Toda a interação com o storage fica no chamador, como a fila já faz. Ver spec §4 e §5.

**2. Hidratação e gravação com debounce** - Fazer o hook do rascunho hidratar o composer na troca de thread, gravar com atraso curto durante a digitação e remover a chave no envio bem-sucedido e no apagamento da thread. Falha de cota não pode travar o composer.

### Fase 2: Superfície

**3. Aviso de imagens não guardadas** - Exibir no composer, quando o rascunho restaurado registrou imagens perdidas, uma linha discreta dizendo quantas foram, que desaparece ao primeiro toque no campo. É o que torna a perda honesta em vez de silenciosa.

### Fase 3: Validação e fechamento

**4. Validação e fechamento** - Executar a estratégia de testes da spec (lógica pura de serialização, tetos, evicção e entrada corrompida, mais o smoke de 9 passos), com atenção aos casos de cota estourada e chave adulterada. Confirmar os critérios de aceitação da F34 no PRD §9 e os de integração com F03/F16, incluindo que a restauração após recusa do backend continua vindo da memória. Verificar light/dark da linha nova e a string contra `docs/F03-workspace/ui.md` e `copy.md`, depois de o id entrar lá. Gate: suíte verde em duas rodadas e `tsc -b` limpo.

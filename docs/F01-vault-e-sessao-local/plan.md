# Plano de Implementação: Vault e Sessão Local

**Pré-requisitos:**
- PRD `docs/prd-engrenacode.md` (F01) e esta pasta `docs/F01-vault-e-sessao-local/spec.md`
- Monorepo instalável (`pnpm install`); Node ≥ 20; Electron rebuild conforme `docs/DEVELOPMENT.md`
- Cofre de desenvolvimento existente opcional em userData (`vault.enc`) — não apagar sem backup

**Nota:** F01 já está implementada no núcleo. Este plano é de **convergência EngrenaCode**: copy PRD, identidade de contratos internos (`engrenacode`), critérios de aceitação e documentação — não bootstrap greenfield. O arquivo `vault.enc` permanece; canais IPC, header de sessão e demais identificadores legados no escopo F01 devem ser renomeados para `engrenacode`.

### Fase 1: Alinhamento de produto (copy)

**1. LoginScreen EngrenaCode** - Substituir todas as strings user-facing do gate `#login` pelas mensagens da spec/PRD (produto EngrenaCode, acentuação pt-BR). Manter códigos de erro e fluxo de unlock intactos; detalhes na spec seção 7 (copy checklist).

**2. Branding mínimo do shell no gate** - Ajustar títulos/textos do shell visíveis no fluxo de unlock para EngrenaCode (copy PRD).

### Fase 2: Contratos internos e verificação

**3. Renomear contratos internos F01** - Substituir identidade legada por `engrenacode` no escopo F01: canais IPC `engrenacode:vault:*` (ex.: `session-token`, `locked`), header `X-EngrenaCode-Session`, e demais constantes/types/referências em shell, preload, renderer e middleware de sessão. Não alterar `vault.enc` nem lógica criptográfica.

**4. Conferência vault, middleware, IPC e sessão** - Validar crypto, store, unlock, backoff, rate limit global e middlewares contra a spec (seções 5 e 6). Confirmar token só via IPC, header `X-EngrenaCode-Session` nas rotas protegidas, e evento `engrenacode:vault:locked` voltando ao `#login`. Registrar desvios como gaps explícitos.

### Fase 3: Aceitação e handoff

**5. Bateria de aceitação F01** - Executar os cenários da estratégia de testes da spec (primeiro unlock, senha inválida, backoff, rate limit, vault locked, corrompido, rede, IPC). Fechar gaps de copy e contratos encontrados.

**6. Handoff para Onda 2** - Marcar F01 como contrato estável para F02/F05/F06/F07: armazenamento cifrado disponível pós-unlock; documentar no PRD/spec que dependentes consomem o vault com identidade `engrenacode` sem alterar F01.

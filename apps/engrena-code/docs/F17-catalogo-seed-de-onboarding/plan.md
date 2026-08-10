# Plano de Implementação: Catálogo Seed de Onboarding

**Feature:** F17  
**Complexidade:** médio  
**Fases:** 4  
**Status:** Pronto para dev  
**Spec:** `docs/F17-catalogo-seed-de-onboarding/spec.md`

---

## Pré-requisitos

- Herdar stack/tooling de `docs/_shared/codebase-patterns.md` (Electron/Vite/Vitest, vault secrets, HTTP unlock loopback, `skillsRepository`, subagents SQLite).
- Dependências de produto já no repo: F01 (unlock/vault), F01.1 (sem UI dedicada), F05 (CRUD skills), F07 (CRUD subagents), F04 (dashboard counts via repos existentes).
- **UI:** `ui.md`/`copy.md` não existem e **não são pré-requisito** — o PRD não exige wizard; seeds aparecem nas telas F05/F07 já existentes.
- Isolamento de teste: `ENGRENACODE_USER_DATA` / `ENGRENACODE_DB_PATH` (padrão do brief); nunca tocar userData real.
- Nenhuma variável de ambiente nova; nenhuma dependência npm nova.
- Delta de ficheiros: módulo `src/services/seeds/*`, hook em `unlock-handler.ts`, testes co-localizados (ver spec §4).

---

### Fase 1: Catálogo versionado

**1. Módulo de catálogo** - Criar o pacote estático v1 com skills e subagents tipados conforme a spec, contagens e names canônicos, conteúdo curado EngrenaCode-only. Referenciar spec §6.

**2. Contrato do pacote** - Cobrir contagens nos ranges do PRD, unicidade de names, shape dos campos e ausência de marca Lion* na suite unitária da spec.

---

### Fase 2: Aplicador idempotente

**3. Serviço de apply** - Implementar a passagem que lê a flag do vault, insere via repositórios F05/F07 com skip em conflito de name, registra falhas parciais sem abortar, e grava `seeds:catalog:v1` ao final. Garantir zero auto-vínculo a projetos. Detalhes na spec §3 e §5.3.

**4. Testes do aplicador** - Validar insert único, noop com flag, skip de names existentes, continuação após falha parcial e ausência de links de projeto, conforme a estratégia de testes da spec.

---

### Fase 3: Hook no unlock

**5. Wiring no unlock HTTP** - Após unlock bem-sucedido e antes da resposta com session token, invocar o aplicador de forma que erros parciais de seed nunca alterem o status HTTP do unlock. Referenciar spec §5.1.

**6. Testes de integração no unlock** - Cobrir primeiro unlock com seeds listáveis, re-unlock sem duplicatas e unlock bem-sucedido sob falha parcial simulada.

---

### Fase 4: Validação e fechamento

**7. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração + smoke §7.2). Confirmar critérios de aceitação PRD §9 F17 e o critério cross-feature Seeds↔Dashboard/F05/F07/F01. Sem `ui.md`/`copy.md` dedicados: smoke nas telas existentes `#skills`, `#subagents` e `#dashboard` (light/dark já cobertos por F01.1/F05/F07). Gate: suite e `pnpm build` verdes.

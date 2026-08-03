# Spec SDD: MCPs

> Selo 🟡 PLANEJADO. Componente do EngrenaCode.

**Componente:** mcps
**Feature:** F09
**Versão alvo:** 1.0
**Data:** 2026-07-31T10:45:00Z

## 1. Problema
🟡 Tools externas (Slack, Linear, etc.) ficam fora do fluxo do agente; falta catálogo local com secrets/OAuth e vínculo por projeto sem abortar o turno quando um server falha.

## 2. Objetivos
🟡 Catálogo first-party + CRUD custom (stdio/http/sse), secrets no vault, OAuth PKCE, vínculo por projeto e tools `mcp__&lt;server&gt;__&lt;tool&gt;` no turno com omit on failure.

## 3. Não-objetivos
🟡 Marketplace sem curadoria; MCP no subagent filho no MVP/1.0 inicial; HTTP remoto não-HTTPS; secret em header stdio.

## 4. Requisitos funcionais
- 🟡 **RF-01:** Catálogo first-party (~14 presets) + CRUD custom.
- 🟡 **RF-02:** Nome `^[a-z0-9][a-z0-9_-]*$`; `engrenacode` reservado.
- 🟡 **RF-03:** Transports: stdio, http, sse; HTTPS obrigatório em remoto; HTTP só loopback.
- 🟡 **RF-04:** Secrets via refs no vault; secret em header stdio rejeitado; GET só nomes de chaves.
- 🟡 **RF-05:** OAuth PKCE loopback; status público no DB; tokens só no vault.
- 🟡 **RF-06:** Recomendação ≤ 8 MCPs vinculados por projeto; Codex MCP exige full-access (aviso UI).
- 🟡 **RF-07:** Falha de resolve → MCP em `omitted[]` com reason; turno continua.
- 🟡 **RF-08:** Tools expostas como `mcp__&lt;server&gt;__&lt;tool&gt;` quando vinculado e resolvido.

## 5. Comportamentos
🟡 Tela `#mcps` para catálogo; vínculo no Workspace; pills de status.
🟡 Connect OAuth / Converter para OAuth opt-in.
🟡 Secret ausente → omitido + pill âmbar.

## 6. Casos de borda
- 🟡 Nome inválido/duplicado → 422/409.
- 🟡 URL http externa → rejeitada.
- 🟡 OAuth falhou → “Não foi possível conectar. Tente novamente.”
- 🟡 Secret ausente: turno não aborta.

## 7. Critérios de aceite
- 🟡 **Dado** preset ou custom válido, **Quando** salva, **Então** aparece no catálogo.
- 🟡 **Dado** MCP vinculado e resolvido, **Quando** o turno roda, **Então** tools `mcp__…` estão disponíveis.
- 🟡 **Dado** secret ausente, **Quando** o turno roda, **Então** o MCP vai a `omitted[]` e o turno segue.
- 🟡 **Dado** URL http não-loopback, **Quando** valida, **Então** é rejeitada.

## 8. Questões em aberto
- 🟡 ⚠️ ABERTO: lista exata dos ~14 presets first-party a fechar na implementação.

## 9. Relatório de avaliação
```
SCORE TOTAL: 84/100
```
Breakdown:
  Completude: 85/100 (peso 30%)
  Testabilidade: 85/100 (peso 25%)
  Clareza: 80/100 (peso 20%)
  Escopo: 85/100 (peso 15%)
  Edge Cases: 85/100 (peso 10%)
Gaps críticos:
  - Catálogo first-party ainda genérico (~14)
Sugestões:
  1. Anexar lista nomeada de presets no plano
```

---
Gerado por reversa-spec-sdd em 2026-07-31T10:45:00Z
Fonte: prd.md

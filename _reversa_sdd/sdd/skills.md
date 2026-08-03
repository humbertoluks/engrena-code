# Spec SDD: Skills

> Selo 🟡 PLANEJADO. Componente do EngrenaCode.

**Componente:** skills
**Feature:** F05
**Versão alvo:** MVP
**Data:** 2026-07-31T10:45:00Z

## 1. Problema
🟡 Padrões e playbooks são colados de novo a cada conversa; não há catálogo local reutilizável que o agente carregue sob demanda.

## 2. Objetivos
🟡 Permitir CRUD de skills globais em markdown, vínculo ordenado por projeto e entrega de content via `load_skill` no turno.

## 3. Não-objetivos
🟡 Skill executar código; marketplace de terceiros; triggers além de `auto` no MVP; versionamento remoto.

## 4. Requisitos funcionais
- 🟡 **RF-01:** CRUD global com `name` único, `description` (orientação ~200 chars), `content` markdown (teto prático ~1 MiB), `category` opcional, `enabled`.
- 🟡 **RF-02:** Name duplicado é rejeitado com conflito.
- 🟡 **RF-03:** Vínculo por projeto controla presença no catálogo do turno com `enabled` e ordem.
- 🟡 **RF-04:** Trigger MVP apenas `auto`.
- 🟡 **RF-05:** Agente vê catálogo (nome/description) e obtém content só via `load_skill`.
- 🟡 **RF-06:** Skill não executa código; apenas orienta o agente.
- 🟡 **RF-07:** Recomendação ≤ 30 skills vinculadas por projeto (orientação, não hard fail obrigatório no MVP).

## 5. Comportamentos
🟡 Tela `#skills` para CRUD; vínculo no modal Repo Harness do workspace.
🟡 Skill desvinculada ou disabled ausente do catálogo do turno.
🟡 Content acima do limite de body: rejeição no save.

## 6. Casos de borda
- 🟡 Name duplicado → conflito.
- 🟡 Content enorme → rejeição.
- 🟡 Skill disabled globalmente → não aparece mesmo se vinculada.
- 🟡 Cofre travado → sem resolução de catálogo no turno.

## 7. Critérios de aceite
- 🟡 **Dado** name único, **Quando** cria skill, **Então** aparece no catálogo global.
- 🟡 **Dado** skill vinculada ao projeto, **Quando** o turno inicia, **Então** o agente vê a entrada no catálogo.
- 🟡 **Dado** `load_skill`, **Quando** o agente solicita, **Então** recebe o content markdown.
- 🟡 **Dado** name duplicado, **Quando** salva, **Então** operação é rejeitada.

## 8. Questões em aberto
- 🟡 ⚠️ ABERTO: hard cap de 30 vínculos ou só recomendação na UI.

## 9. Relatório de avaliação
```
SCORE TOTAL: 84/100
```
Breakdown:
  Completude: 85/100 (peso 30%)
  Testabilidade: 85/100 (peso 25%)
  Clareza: 85/100 (peso 20%)
  Escopo: 85/100 (peso 15%)
  Edge Cases: 75/100 (peso 10%)
Gaps críticos:
  - Nenhum bloqueador
Sugestões:
  1. Fechar política de hard cap vs soft warning
```

---
Gerado por reversa-spec-sdd em 2026-07-31T10:45:00Z
Fonte: prd.md

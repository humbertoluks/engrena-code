# Spec SDD: Configuração MVP

> Selo 🟡 PLANEJADO. Componente do EngrenaCode.

**Componente:** configuracao-mvp
**Feature:** F02
**Versão alvo:** MVP
**Data:** 2026-07-31T10:45:00Z

## 1. Problema
🟡 Setup repetitivo de providers, prompt base e token GitHub atrasa o primeiro turno útil e faz falhas de auth aparecerem no meio da tarefa.

## 2. Objetivos
🟡 Centralizar auth Claude por assinatura, status/teste das CLIs Claude/Codex/Kimi, system prompt global e PAT GitHub, com cofre aberto.

## 3. Não-objetivos
🟡 API keys de providers (F10); Minimax/GLM/Grok; ping remoto ao GitHub no save do token; caminho manual de binário (escopo completo opcional).

## 4. Requisitos funcionais
- 🟡 **RF-01:** Tela `#configuracao` só acessível com cofre desbloqueado.
- 🟡 **RF-02:** Card Claude detecta login Claude Code e “Testar conexão” distingue sucesso, sem login e rate limit.
- 🟡 **RF-03:** Card CLIs lista Claude, Codex e Kimi com estados instalado/logado e teste em lote “X/3 CLIs logados”.
- 🟡 **RF-04:** Prompt global permite salvar custom, restaurar padrão EngrenaCode ou esvaziar para desligar injeção; vale no próximo turno.
- 🟡 **RF-05:** Token GitHub rejeita espaços, comprimento &lt; 8 e prefixo inválido; aceita `ghp_`, `github_pat_`, `gho_`, `ghu_`, `ghs_`, `ghr_`.
- 🟡 **RF-06:** Save do PAT não valida remotamente com o GitHub; feedback “Token salvo localmente (não validado com o GitHub).”
- 🟡 **RF-07:** Providers MVP limitados a Claude, Codex e Kimi nesta feature.

## 5. Comportamentos
🟡 Cards: Claude, CLIs, Prompt global, GitHub.
🟡 Assinatura sem login orienta uso do `claude` no terminal.
🟡 Formato de token inválido: “Formato inválido. Esperado: ghp_… ou github_pat_…”.
🟡 Falha ao carregar paths das CLIs bloqueia save e pede “Testar conexões”.

## 6. Casos de borda
- 🟡 Rate limit no teste Claude: mensagem de limite com retry.
- 🟡 Prompt &gt; 8–10k chars: aviso de performance (escopo completo); MVP não bloqueia.
- 🟡 CLI não instalada: status explícito instalado=não.
- 🟡 Cofre travado: tela inacessível / 423.

## 7. Critérios de aceite
- 🟡 **Dado** cofre aberto, **Quando** o usuário abre `#configuracao`, **Então** vê os quatro cards.
- 🟡 **Dado** Claude logado, **Quando** testa conexão, **Então** recebe feedback de sucesso da assinatura.
- 🟡 **Dado** as 3 CLIs, **Quando** “Testar conexões”, **Então** vê contagem X/3 logados.
- 🟡 **Dado** PAT com prefixo inválido, **Quando** salva, **Então** é rejeitado com mensagem de formato.
- 🟡 **Dado** prompt salvo, **Quando** o próximo turno inicia, **Então** a injeção usa o valor novo (ou ausente se desligado).

## 8. Questões em aberto
- 🟡 ⚠️ ABERTO: caminho manual de binário entra no MVP ou só no escopo completo.

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
  - Decisão do caminho manual de binário
Sugestões:
  1. Fechar se path override é MVP ou pós-MVP
```

---
Gerado por reversa-spec-sdd em 2026-07-31T10:45:00Z
Fonte: prd.md

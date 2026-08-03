# Spec SDD: API Keys dos Providers

> Selo 🟡 PLANEJADO. Componente do EngrenaCode.

**Componente:** api-keys-providers
**Feature:** F10
**Versão alvo:** 1.0
**Data:** 2026-07-31T10:45:00Z

## 1. Problema
🟡 Assinatura/CLI não cobrem todos os cenários; o usuário precisa de API keys no cofre (Claude/Codex/Minimax) sem sobrescrever o modo assinatura sem escolha explícita.

## 2. Objetivos
🟡 Alternar Claude assinatura ↔ API key, salvar keys no vault e disponibilizar Minimax como provider de thread na 1.0.

## 3. Não-objetivos
🟡 Validação remota obrigatória no save; Grok/GLM; key vencendo assinatura automaticamente; multi-provider na mesma thread.

## 4. Requisitos funcionais
- 🟡 **RF-01:** Toggle Claude Assinatura ↔ API key; key não vence assinatura sozinha.
- 🟡 **RF-02:** Prefixos: Claude `sk-ant-`; Codex `sk-` / `sk-codex-`; Minimax validator loose.
- 🟡 **RF-03:** Sem espaços; ≥ 8 chars; save parcial vazio preserva key anterior.
- 🟡 **RF-04:** Save sem validar remotamente; teste Claude via “Testar conexão”; Minimax valida no primeiro turno.
- 🟡 **RF-05:** Minimax disponível como provider de thread na 1.0 quando key válida.
- 🟡 **RF-06:** Modo API key sem key: avisa “Nenhuma key salva: os turnos vão falhar” / bloqueia conforme mensagem definida.
- 🟡 **RF-07:** Keys persistem só no vault (F01).

## 5. Comportamentos
🟡 Bloco “API keys dos providers” em `#configuracao`.
🟡 Composer mostra indisponível com motivo se faltar key no modo certo.
🟡 Teste/turno falho distingue rate limit vs credencial inválida quando possível.

## 6. Casos de borda
- 🟡 Save parcial com campo vazio: preserva key anterior.
- 🟡 Formato inválido: mensagem de prefixo esperado.
- 🟡 Alternar para assinatura sem apagar key armazenada.
- 🟡 Minimax sem key: provider indisponível no composer.

## 7. Critérios de aceite
- 🟡 **Dado** Claude em modo API key com key válida, **Quando** testa conexão, **Então** distingue sucesso vs falha de credencial/rate limit.
- 🟡 **Dado** save com campo vazio, **Quando** confirma, **Então** a key anterior permanece.
- 🟡 **Dado** Minimax com key, **Quando** cria thread, **Então** Minimax aparece como provider.
- 🟡 **Dado** modo API key sem key, **Quando** tenta turno, **Então** bloqueia/avisar conforme mensagem definida.

## 8. Questões em aberto
- 🟡 ⚠️ ABERTO: regras exatas do validator “loose” do Minimax.

## 9. Relatório de avaliação
```
SCORE TOTAL: 83/100
```
Breakdown:
  Completude: 85/100 (peso 30%)
  Testabilidade: 85/100 (peso 25%)
  Clareza: 80/100 (peso 20%)
  Escopo: 85/100 (peso 15%)
  Edge Cases: 75/100 (peso 10%)
Gaps críticos:
  - Validator Minimax ainda aberto
Sugestões:
  1. Documentar regex/regras Minimax no plano
```

---
Gerado por reversa-spec-sdd em 2026-07-31T10:45:00Z
Fonte: prd.md

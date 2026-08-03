# Spec SDD: Vault e Sessão Local

> Selo 🟡 PLANEJADO. Componente do EngrenaCode.

**Componente:** vault-sessao-local
**Feature:** F01
**Versão alvo:** MVP
**Data:** 2026-07-31T10:45:00Z

## 1. Problema
🟡 Credenciais de providers e integrações não podem ficar em claro no disco; o app precisa de um gate de unlock antes de expor rotas protegidas, sem recuperação de senha e sem servidor remoto da Lukse.

## 2. Objetivos
🟡 Criar e desbloquear um cofre cifrado local com workspace + senha, emitir sessão e bloquear APIs protegidas quando o cofre estiver travado.

## 3. Não-objetivos
🟡 Recuperação de senha, sync de cofre na nuvem, multi-usuário/RBAC, biometria, 2FA remoto.

## 4. Requisitos funcionais
- 🟡 **RF-01:** No primeiro uso, o sistema cria um cofre cifrado em disco a partir de uma senha não vazia e um workspace (identificador local) não vazio.
- 🟡 **RF-02:** Unlock com workspace + senha válidos emite sessão local e libera rotas protegidas.
- 🟡 **RF-03:** Credenciais inválidas exibem mensagem genérica (“Workspace ou senha inválidos.”) sem revelar qual campo falhou.
- 🟡 **RF-04:** Após 5 falhas consecutivas, o botão de submit fica bloqueado com backoff visível de até 60s.
- 🟡 **RF-05:** Com cofre travado, APIs protegidas respondem 401/423 e a UI retorna ao gate `#login`.
- 🟡 **RF-06:** Credenciais nunca são persistidas em claro no SQLite; segredos ficam apenas no cofre.
- 🟡 **RF-07:** Cofre corrompido/ilegível mostra mensagem orientando backup/recriação.
- 🟡 **RF-08:** Server local indisponível mostra “Verifique se o EngrenaCode está em execução.”

## 5. Comportamentos
🟡 Boot → gate `#login` → submit → unlock HTTP → token via IPC → navegação ao destino.
🟡 Botão desabilitado se faltar campo, durante submit ou em backoff.
🟡 Travamento durante uso devolve imediatamente ao gate.

## 6. Casos de borda
- 🟡 Workspace ou senha vazios: submit bloqueado na UI.
- 🟡 5ª falha consecutiva: inicia backoff; tentativas durante backoff permanecem bloqueadas.
- 🟡 Esquecer a senha: sem recuperação; usuário deve recriar workspace/credenciais.
- 🟡 Cofre danificado: mensagem específica, sem unlock.
- 🟡 Server loopback fora do ar: mensagem de disponibilidade, sem falso positivo de credencial.

## 7. Critérios de aceite
- 🟡 **Dado** primeiro uso, **Quando** o usuário define workspace+senha válidos, **Então** o cofre é criado e aberturas seguintes exigem unlock.
- 🟡 **Dado** cofre existente, **Quando** workspace+senha corretos, **Então** sessão é emitida e rotas protegidas liberam.
- 🟡 **Dado** senha inválida, **Quando** submit, **Então** mensagem genérica e nenhum detalhe de qual campo falhou.
- 🟡 **Dado** 5 falhas, **Quando** o usuário tenta de novo, **Então** o botão permanece bloqueado até o fim do backoff.
- 🟡 **Dado** cofre travado, **Quando** uma API protegida é chamada, **Então** retorna 401/423 e a UI volta ao gate.

## 8. Questões em aberto
- 🟡 Nenhuma crítica para o MVP (algoritmo de cifra concreto fica para o plano técnico).

## 9. Relatório de avaliação
```
SCORE TOTAL: 86/100
```
Breakdown:
  Completude: 90/100 (peso 30%)
  Testabilidade: 90/100 (peso 25%)
  Clareza: 85/100 (peso 20%)
  Escopo: 80/100 (peso 15%)
  Edge Cases: 80/100 (peso 10%)
Gaps críticos:
  - Nenhum bloqueador
Sugestões:
  1. Detalhar algoritmo/KDF no plano técnico (fora do escopo comportamental da spec)
```

---
Gerado por reversa-spec-sdd em 2026-07-31T10:45:00Z
Fonte: prd.md

# Spec SDD: Design System

> Selo 🟡 PLANEJADO. Componente do EngrenaCode.

**Componente:** design-system
**Feature:** F01.1
**Versão alvo:** MVP
**Data:** 2026-07-31T10:45:00Z

## 1. Problema
🟡 Telas do renderer precisam de identidade visual consistente (cores, spacing, radii, tipografia e tema) sem hexes soltos nem flash no boot Electron.

## 2. Objetivos
🟡 Expor tokens semânticos light/dark, runtime de tema `light` | `dark` | `system` com persistência e anti-flash, e padrões de superfície para todas as UIs do renderer.

## 3. Não-objetivos
🟡 Type scale / shadows / z-index / motion tokenizados; breakpoints desktop formalizados além do Tailwind default; MUI/Chakra/Emotion/CSS Modules/Storybook obrigatório; packs de tema custom; identidade tipográfica definitiva LionLabs Grotesk.

## 4. Requisitos funcionais
- 🟡 **RF-01:** Tokens CSS `:root` / `.dark` cobrem bg, surface, surface-2, border, fg, muted, accent, accent-2, green, amber, red (+ scrollbar) com hexes do Design Lock.
- 🟡 **RF-02:** Accent `#ff6b00` e accent-2 `#ff8c2e` idênticos nos dois modos; dark bg `#0a0a0b`; light bg `#f7f7f8`.
- 🟡 **RF-03:** Spacing `xs|sm|md|lg|xl` = 4|8|16|24|40 px e radii `sm|md|lg` = 5|8|12 px expostos aos utilitários Tailwind.
- 🟡 **RF-04:** Tema runtime aceita exatamente `light` | `dark` | `system`; `system` segue `prefers-color-scheme`; dark aplica `.dark` em `<html>`.
- 🟡 **RF-05:** Preferência persiste em `localStorage` sob `engrenacode:theme`; ausente/inválida faz fail-soft para `system`.
- 🟡 **RF-06:** Troca de tema aplica anti-flash (`.no-transitions` / duração 0s).
- 🟡 **RF-07:** Splash do shell usa `#0a0a0b`; Shiki `github-light` / `github-dark` conforme tema resolvido; xterm consome `--bg`, `--fg`, `--accent`, `--border` + mono JetBrains.
- 🟡 **RF-08:** Stack: Tailwind 3 + CSS variables + React; sem dependência obrigatória de MUI/Chakra/Emotion/Storybook.

## 5. Comportamentos
🟡 Boot → splash `#0a0a0b` → lê `engrenacode:theme` → resolve system se necessário → aplica/remove `.dark`.
🟡 Superfícies tipadas: card, input, badge, modal, focus, markdown chat usam classes canônicas (`bg-bg`, `bg-surface`, `text-fg`, `border-border`, `bg-accent`, etc.).

## 6. Casos de borda
- 🟡 Preferência inválida: fail-soft `system` sem bloquear UI.
- 🟡 Troca rápida de tema: anti-flash impede flash perceptível.
- 🟡 Experimento Grotesk não sobrescreve mono.
- 🟡 Cores de diff/provider brands fora do Design Lock não quebram tokens semânticos.

## 7. Critérios de aceite
- 🟡 **Dado** app no boot, **Quando** splash renderiza, **Então** fundo é `#0a0a0b`.
- 🟡 **Dado** tema `dark`, **Quando** a UI carrega, **Então** `<html>` tem `.dark` e tokens dark aplicados.
- 🟡 **Dado** usuário escolhe `light`, **Quando** reabre o app, **Então** a preferência em `engrenacode:theme` é restaurada.
- 🟡 **Dado** valor inválido no localStorage, **Quando** o runtime inicia, **Então** usa `system` sem erro bloqueante.
- 🟡 **Dado** troca de tema, **Quando** a classe muda, **Então** `.no-transitions` evita flash.

## 8. Questões em aberto
- 🟡 ⚠️ ABERTO: se LionLabs Grotesk permanece como alias experimental ou é removido na 1.0.

## 9. Relatório de avaliação
```
SCORE TOTAL: 88/100
```
Breakdown:
  Completude: 95/100 (peso 30%)
  Testabilidade: 90/100 (peso 25%)
  Clareza: 85/100 (peso 20%)
  Escopo: 85/100 (peso 15%)
  Edge Cases: 75/100 (peso 10%)
Gaps críticos:
  - Nenhum bloqueador
Sugestões:
  1. Fechar destino do experimento Grotesk
```

---
Gerado por reversa-spec-sdd em 2026-07-31T10:45:00Z
Fonte: prd.md

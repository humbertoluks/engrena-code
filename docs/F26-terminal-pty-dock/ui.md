# Spec de UI: #principal (Terminal PTY — dock na coluna Histórico)

**Feature:** F26-terminal-pty-dock
**Destino:** EngrenaCode
**Fonte:** LionCodeLabs `TerminalDock` (posição/abas/resize) + pedido de produto (maximizar ∧/∨)
**Componentes implementados:** `TerminalDock.tsx`, `TerminalPane.tsx`, `useTerminalDock.ts`, `terminalDock.logic.ts`, montados em `PrincipalScreen.tsx` **dentro** da coluna central (abaixo do composer)
**Última atualização:** 2026-08-10

## Escopo

**Cobre:**
- Dock no rodapé da coluna Histórico/Diff (não full-width abaixo do grid 3 colunas)
- Toggle abrir/fechar (chevron + glifo + “Terminal”)
- Abas com `+` / `×`, alça de resize por drag, botão direito ∧ maximizar / ∨ restaurar
- Pane de sessão (`TerminalPane`) — 4 estados; todas as abas montadas, só a ativa visível
- Atalho `Ctrl+\``

## Anatomia (topo → base da coluna central)

1. Tabs Histórico | Diff
2. Área de chat/diff (`flex-1`) — oculta quando o terminal está maximizado
3. TaskComposer
4. `TerminalDock`
   1. Alça de resize (só aberto e não maximizado): `role="separator"`, arraste para cima aumenta altura (72–680px, default 220)
   2. Header: toggle (chevron) · abas · `+` · spacer · ∧/∨
   3. Corpo: xterm / empty / no-project; `hidden` quando colapsado (mantém montado após 1ª abertura)

## Aceite visual

- [x] Dock contido na coluna do histórico (chat → composer → terminal)
- [x] Abas + fechar (só se >1) + nova aba
- [x] Resize por drag
- [x] Maximizar/restaurar no canto direito (∧ / ∨)
- [x] Scrollback preservado ao trocar aba e ao recolher/reabrir

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F26-terminal-pty-dock/spec.md` | Contrato técnico IPC |
| `docs/F26-terminal-pty-dock/copy.md` | Microcopy |
| `docs/design-system/` | Tokens |
